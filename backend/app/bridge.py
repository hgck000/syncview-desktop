from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional, Any
from PIL import Image, ExifTags
from datetime import datetime
import webview
import shutil
import re
import io, base64, json, os, sys, mimetypes

def default_app_data() -> Path:
    # Windows: %LOCALAPPDATA%\SyncView
    if sys.platform.startswith("win"):
        root = os.getenv("LOCALAPPDATA") or Path.home()
        return Path(root) / "SyncView"

    # macOS: ~/Library/Application Support/SyncView
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "SyncView"

    # Linux: ~/.local/share/SyncView (hoặc XDG_DATA_HOME)
    xdg = os.getenv("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "SyncView"
    return Path.home() / ".local" / "share" / "SyncView"

def _pick_first_path(result):
    if not result:
        return None
    if isinstance(result, (list, tuple)):
        return result[0] if result else None
    if isinstance(result, str):
        return result
    return None

class Bridge:
    def __init__(self, app_data_dir: Path | None = None, window=None):
        self.app_data_dir = Path(app_data_dir) if app_data_dir else default_app_data()
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.recent: Dict[str, List[str]] = {"A": [], "B": [], "C": [], "D": []}
        self.window = window
        
    def attach_window(self, window):
        self.window = window

    def open_dialog(self, pane: str) -> Optional[str]:
        print(f"[Bridge] open_dialog pane={pane}")
        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                directory=str(Path.home()),
                allow_multiple=True,
                file_types=('Images (*.jpg;*.jpeg;*.png;*.webp;*.heic)',)
            )
            print(f"[Bridge] dialog result={result}")
        except Exception as e:
            print(f"[Bridge][ERROR] create_file_dialog: {e}")
            return None
        if not result:
            return None
        path = str(Path(result[0]).resolve())
        self._remember(pane, path)
        print(f"[Bridge] selected path={path}")
        return path
    
    def open_folder_dialog(self):
        """Chọn 1 folder (không đệ quy). Trả về path hoặc None."""
        try:
            result = self.window.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory=str(Path.home()),
            )
        except Exception as e:
            print(f"[Bridge][ERROR] open_folder_dialog: {e}")
            return None

        folder = _pick_first_path(result)
        if not folder:
            return None

        folder = str(Path(folder).resolve())
        print(f"[Bridge] selected folder={folder}")
        return folder

    def list_images_in_folder(self, folder: str) -> List[str]:
        """
        List ảnh trong folder (không đệ quy), trả về danh sách full paths
        theo thứ tự tên file (ổn định, giống “thứ tự trong folder”).
        """
        print(f"[Bridge] list_images_in_folder folder={folder}")
        if not folder:
            return []
        p = Path(folder)
        if not p.exists() or not p.is_dir():
            return []

        # Các loại file preview được bằng Pillow/hiện tại app đang handle tốt.
        exts = {
            ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff", ".heic",
        }

        items = []
        try:
            for f in p.iterdir():
                if not f.is_file():
                    continue
                if f.suffix.lower() in exts:
                    items.append(str(f.resolve()))
        except Exception as e:
            print(f"[Bridge][ERROR] list_images_in_folder: {e}")
            return []

        items.sort(key=lambda s: Path(s).name.lower())
        print(f"[Bridge] found {len(items)} images")
        return items

    def choose_export_folder(self):
        try:
            result = self.window.create_file_dialog(
                webview.FOLDER_DIALOG,
                directory=str(Path.home()),
            )
        except Exception as e:
            print(f"[Bridge][ERROR] choose_export_folder: {e}")
            return None

        folder = _pick_first_path(result)
        if not folder:
            return None
        return str(Path(folder).resolve())

    def export_copy_files(self, paths: List[str], out_dir: str, copy_xmp: bool = True) -> Dict[str, Any]:
        """
        Copy nguyên file gốc (100% quality). Nếu copy_xmp=True thì copy sidecar .xmp cùng basename.
        Trả về thống kê: ok, fail.
        """
        outp = Path(out_dir)
        outp.mkdir(parents=True, exist_ok=True)

        ok = 0
        fail: List[str] = []

        for src in paths or []:
            try:
                sp = Path(src)
                if not sp.exists() or not sp.is_file():
                    fail.append(src)
                    continue

                dst = outp / sp.name

                # copy2 giữ metadata cơ bản (mtime, …)
                import shutil
                shutil.copy2(str(sp), str(dst))
                ok += 1

                if copy_xmp:
                    xmp = sp.with_suffix(".xmp")
                    if xmp.exists() and xmp.is_file():
                        shutil.copy2(str(xmp), str(outp / xmp.name))
            except Exception as e:
                print(f"[Bridge][ERROR] export_copy_files {src}: {e}")
                fail.append(src)

        return {"ok": ok, "fail": fail}

    def read_image_dataurl(self, path: str) -> Optional[str]:
        """Đọc file ảnh local và trả DataURL PNG để FE load vào <img/canvas>"""
        try:
            p = Path(path)
            if not p.exists():
                print(f"[Bridge][ERROR] not found: {path}")
                return None
            
            ext = p.suffix.lower()
            if ext in {".jpg", ".jpeg", ".png", ".webp"}:
                mime = mimetypes.guess_type(p.name)[0] or "image/jpeg"
                with p.open("rb") as f:
                    raw = f.read()
                b64 = base64.b64encode(raw).decode("ascii")
                return f"data:{mime};base64,{b64}"
            
            from PIL import Image
            with Image.open(p) as im:
                im = im.convert("RGBA")
                from io import BytesIO
                buf = BytesIO()
                im.save(buf, format="PNG")
                b64 = base64.b64encode(buf.getvalue()).decode("ascii")
                return "data:image/png;base64," + b64
        except Exception as e:
            print(f"[Bridge][IMG][ERROR] {path}: {e}")
            return None

    def recent_files(self) -> Dict[str, List[str]]:
        return self.recent

    def _remember(self, pane: str, path: str) -> None:
        items = self.recent.get(pane, [])
        if path in items:
            items.remove(path)
        items.insert(0, path)
        self.recent[pane] = items[:10]

    def _ratio_to_float(self, v):
        try:
            if v is None: return None
            if isinstance(v, tuple) and len(v) == 2:
                num, den = v
                return float(num) / float(den) if den else None
            return float(v)
        except Exception:
            return None

    def read_exif_from_dataurl(self, dataurl: str) -> Optional[Dict]:
        try:
            head, b64 = dataurl.split(",", 1)
            buf = io.BytesIO(base64.b64decode(b64))
            with Image.open(buf) as im:
                info = self._exif_to_dict(im)
            print(f"[Bridge][EXIF] dataURL OK")
            return info
        except Exception as e:
            print(f"[Bridge][EXIF][ERROR] dataURL: {e}")
            return None

    def _last_session_path(self) -> Path:
        return self.app_data_dir / "last_session.json"

    def read_last_session(self) -> dict | None:
        try:
            p = self._last_session_path()
            if not p.exists():
                print("[Bridge] last_session not found")
                return None
            data = json.loads(p.read_text(encoding="utf-8"))
            print("[Bridge] read_last_session OK")
            return data
        except Exception as e:
            print(f"[Bridge][ERROR] read_last_session: {e}")
            return None

    def write_last_session(self, data: dict) -> bool:
        try:
            p = self._last_session_path()
            p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[Bridge] write_last_session -> {p}")
            return True
        except Exception as e:
            print(f"[Bridge][ERROR] write_last_session: {e}")
            return False
        
    def _json_safe(self, v):
        # helper nhỏ: convert mọi thứ sang kiểu ghi JSON được
        try:
            if isinstance(v, bytes):
                try:
                    return v.decode("utf-8", "replace").strip("\x00")
                except Exception:
                    return v.hex()
            if isinstance(v, (int, float, str)) or v is None:
                return v
            if isinstance(v, (list, tuple)):
                return [self._json_safe(x) for x in v]
            # IFDRational, Fraction, v.v. → float nếu có numerator/denominator
            if hasattr(v, "numerator") and hasattr(v, "denominator"):
                # d = float(v.numerator) / float(v.denominator) if v.denominator else 0.0
                # return d
                den = float(v.denominator) if v.denominator else 1.0
                return float(v.numerator) / den
        except Exception:
            return None
        # fallback
        return str(v)

    def _exif_to_dict(self, img: Image.Image) -> Dict[str, Any]:
        """
        Chuyển EXIF của Pillow sang dict phẳng, JSON-safe.
        Đọc cả main IFD, Exif IFD (Exposure/ISO/Aperture...) và GPS IFD.
        """
        out: Dict[str, Any] = {}

        try:
            exif = img.getexif() or {}
        except Exception:
            exif = {}

        if not exif:
            # vẫn cố set kích thước ảnh
            try:
                w, h = img.size
                out["ImageWidth"] = w
                out["ImageHeight"] = h
            except Exception:
                pass
            return out

        tagmap = ExifTags.TAGS
        flat: Dict[str, Any] = {}

        # --- 1) Main IFD ---
        for tag_id, value in exif.items():
            name = tagmap.get(tag_id, f"Tag_{tag_id}")
            flat[name] = self._json_safe(value)

        # --- 2) Exif IFD (chứa ExposureTime, FNumber, ISO...) ---
        try:
            from PIL.ExifTags import IFD
            exif_ifd = exif.get_ifd(IFD.Exif)
        except Exception:
            exif_ifd = None

        if exif_ifd:
            for tag_id, value in exif_ifd.items():
                name = tagmap.get(tag_id, f"Exif_{tag_id}")
                # nếu TAGS có tên thân thiện thì dùng luôn
                if tag_id in tagmap:
                    name = tagmap[tag_id]
                if name not in flat:
                    flat[name] = self._json_safe(value)

        # --- 3) GPS IFD (chứa GPSLatitude/GPSLongitude...) ---
        gps_ifd = None
        try:
            from PIL.ExifTags import IFD
            gps_ifd = exif.get_ifd(IFD.GPSInfo)
        except Exception:
            # fallback: dùng GPSInfo tag ID tìm bằng tagmap
            gps_info_tag = None
            for tid, tname in tagmap.items():
                if tname == "GPSInfo":
                    gps_info_tag = tid
                    break
            if gps_info_tag is not None:
                try:
                    gps_ifd = exif.get_ifd(gps_info_tag)
                except Exception:
                    gps_ifd = None

        if gps_ifd:
            for gid, gval in gps_ifd.items():
                gname = ExifTags.GPSTAGS.get(gid, f"GPS_{gid}")
                flat[gname] = self._json_safe(gval)

        # Debug (tạm): xem tất cả flat tags sau khi merge IFD
        # print("[Bridge][EXIF][FLAT TAGS]:", flat)

        # --- Copy flat vào out ---
        out.update(flat)

        # --- Một số alias cho Pane dễ đọc ---

        # Date/Time
        dt_orig = flat.get("DateTimeOriginal")
        dt      = flat.get("DateTime")
        if dt_orig:
            out["DateTimeOriginal"] = dt_orig
            out.setdefault("CreateDate", dt_orig)
        elif dt:
            out["DateTimeOriginal"] = dt
            out.setdefault("CreateDate", dt)
        if dt:
            out["DateTime"] = dt

        # Make/Model
        if "Make" in flat:
            out["Make"] = flat["Make"]
        if "Model" in flat:
            out["Model"] = flat["Model"]

        # Khẩu
        fnum = flat.get("FNumber") or flat.get("ApertureValue") or flat.get("Aperture")
        if fnum is not None:
            out["FNumber"] = fnum
            out.setdefault("Aperture", fnum)

        # Shutter
        et = flat.get("ExposureTime") or flat.get("ShutterSpeedValue") or flat.get("ShutterSpeed")
        if et is not None:
            out["ExposureTime"] = et
            out.setdefault("ShutterSpeed", et)

        # ISO
        iso = (
            flat.get("ISO")
            or flat.get("ISOSpeedRatings")
            or flat.get("PhotographicSensitivity")
        )
        if iso is not None:
            out["ISOSpeedRatings"] = iso
            out.setdefault("ISO", iso)

        # Kích thước ảnh
        try:
            w, h = img.size
            out.setdefault("ImageWidth", w)
            out.setdefault("ImageHeight", h)
        except Exception:
            pass

        return out
        
    def read_exif_from_path(self, path: str) -> Optional[Dict[str, Any]]:
        try:
            p = Path(path)
            if not p.exists():
                print(f"[Bridge][EXIF] not found: {path}")
                return None

            with Image.open(p) as im:
                info = self._exif_to_dict(im)

            # Bổ sung FileSize bằng stat
            try:
                info.setdefault("FileSize", p.stat().st_size)
            except Exception as e:
                print(f"[Bridge][EXIF][WARN] stat error for {path}: {e}")

            print(f"[Bridge][EXIF] path OK: {path}")
            return info
        except Exception as e:
            print(f"[Bridge][EXIF][ERROR] path: {e}")
            return None

    def save_png_dialog(self, dataurl: str, suggested_name: str = "SyncView.png") -> Optional[str]:
        try:
            if not self.window:
                print("[Bridge][ERROR] window not attached")
                return None

            # đảm bảo có .png
            name = suggested_name or "SyncView.png"
            if not name.lower().endswith(".png"):
                name += ".png"

            result = self.window.create_file_dialog(
                webview.SAVE_DIALOG,
                directory=str(Path.home()),
                save_filename=name,
                file_types=("PNG (*.png)",)
            )
            if not result:
                return None

            # pywebview có thể trả string hoặc list
            path = result[0] if isinstance(result, list) else result
            p = Path(path)
            if p.suffix.lower() != ".png":
                p = p.with_suffix(".png")
            p = p.expanduser().resolve()

            # parse data URL
            b64 = dataurl.split(",", 1)[1] if dataurl.startswith("data:") else dataurl
            raw = base64.b64decode(b64)

            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(raw)
            print(f"[Bridge] saved png -> {p}")
            return str(p)

        except Exception as e:
            print(f"[Bridge][ERROR] save_png_dialog: {e}")
            return None

    def _sanitize_filename(self, name: str) -> str:
        name = (name or "image").strip()
        # bỏ ký tự cấm trên Windows
        name = re.sub(r'[<>:"/\\|?*\x00-\x1F]', "_", name)
        name = re.sub(r"\s+", " ", name).strip()
        return name[:180] if len(name) > 180 else name

    def export_starred_dialog(self, items: List[Dict[str, Any]], folder_name: str = "") -> Dict[str, Any]:
        """
        items: list các QueueItem từ FE (kind=file/dataURL, path/name/originIndex/dataURL...)
        - file: copy2 giữ metadata (lossless)
        - dataURL: decode và ghi ra (best-effort)
        """
        out = {
            "ok": False,
            "out_dir": None,
            "copied": 0,
            "skipped": 0,
            "errors": [],
        }

        parent = self.choose_export_folder()
        if not parent:
            out["errors"].append("cancelled")
            return out

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        folder_name = (folder_name or "").strip()
        if not folder_name:
            folder_name = f"SyncView_Starred_{ts}"
        folder_name = self._sanitize_filename(folder_name)

        out_dir = (Path(parent) / folder_name).resolve()
        out_dir.mkdir(parents=True, exist_ok=True)

        def unique_path(p: Path) -> Path:
            if not p.exists():
                return p
            stem = p.stem
            suf = p.suffix
            k = 2
            while True:
                cand = p.with_name(f"{stem}_{k}{suf}")
                if not cand.exists():
                    return cand
                k += 1

        for i, it in enumerate(items or []):
            try:
                kind = (it.get("kind") or "").lower()
                idx = i + 1

                if kind == "file":
                    src = Path(it.get("path") or "")
                    if not src.exists():
                        out["skipped"] += 1
                        out["errors"].append(f"missing: {src}")
                        continue

                    # giữ thứ tự: prefix 0001_
                    base = self._sanitize_filename(src.name)
                    dst = out_dir / f"{idx:04d}_{base}"
                    dst = unique_path(dst)

                    shutil.copy2(str(src), str(dst))
                    out["copied"] += 1
                    continue

                if kind == "dataurl":
                    dataurl = it.get("dataURL") or it.get("dataurl") or ""
                    if not isinstance(dataurl, str) or "," not in dataurl:
                        out["skipped"] += 1
                        out["errors"].append(f"bad dataURL at {idx}")
                        continue

                    head, b64 = dataurl.split(",", 1)
                    raw = base64.b64decode(b64)

                    # đoán ext từ mime
                    ext = ".png"
                    if "image/jpeg" in head:
                        ext = ".jpg"
                    elif "image/webp" in head:
                        ext = ".webp"

                    nm = self._sanitize_filename(it.get("name") or "pasted")
                    dst = out_dir / f"{idx:04d}_{nm}{ext}"
                    dst = unique_path(dst)

                    dst.write_bytes(raw)
                    out["copied"] += 1
                    continue

                # unknown kind
                out["skipped"] += 1
                out["errors"].append(f"unknown kind at {idx}: {kind}")

            except Exception as e:
                out["skipped"] += 1
                out["errors"].append(str(e))

        out["ok"] = True
        out["out_dir"] = str(out_dir)
        print(f"[Bridge] export_starred_dialog -> {out['out_dir']} copied={out['copied']} skipped={out['skipped']}")
        try:
            log_path = out_dir / "export_log.txt"
            lines = []
            lines.append(f"ok: {out['ok']}")
            lines.append(f"out_dir: {out['out_dir']}")
            lines.append(f"copied: {out['copied']}")
            lines.append(f"skipped: {out['skipped']}")
            if out["errors"]:
                lines.append("")
                lines.append("errors:")
                for e in out["errors"]:
                    lines.append(f"- {e}")
            log_path.write_text("\n".join(lines), encoding="utf-8")
        except Exception as e:
            print(f"[Bridge][WARN] write export_log failed: {e}")

        return out
