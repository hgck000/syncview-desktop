from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional, Any
import webview
from PIL import Image, ExifTags
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
        
    # def _exif_to_dict(self, img: Image.Image) -> Dict:
    #     """Chuyển EXIF của Pillow sang dict khoẻ mạnh (keys human-readable)"""
    #     out = {}
    #     try:
    #         raw = img.getexif() or {}
    #     except Exception:
    #         raw = {}
    #     tagmap = {v: k for k, v in ExifTags.TAGS.items()}
    #     def get(tag):
    #         key = tagmap.get(tag)
    #         return raw.get(key) if key is not None else None

    #     out["Make"] = get("Make")
    #     out["Model"] = get("Model")
    #     out["DateTimeOriginal"] = get("DateTimeOriginal") or get("DateTime")
    #     out["FNumber"] = self._ratio_to_float(get("FNumber"))
    #     out["ExposureTime"] = self._ratio_to_float(get("ExposureTime"))
    #     out["ISOSpeedRatings"] = get("ISOSpeedRatings") or get("PhotographicSensitivity")
    #     out["FocalLength"] = self._ratio_to_float(get("FocalLength"))
    #     out["LensModel"] = get("LensModel")
    #     out["Orientation"] = get("Orientation")
    #     try:
    #         out["ImageWidth"], out["ImageHeight"] = img.size
    #     except Exception:
    #         pass
    #     return out

    def _ratio_to_float(self, v):
        try:
            if v is None: return None
            if isinstance(v, tuple) and len(v) == 2:
                num, den = v
                return float(num) / float(den) if den else None
            return float(v)
        except Exception:
            return None

    # def read_exif_from_path(self, path: str) -> Optional[Dict]:
    #     try:
    #         p = Path(path)
    #         if not p.exists():
    #             print(f"[Bridge][EXIF] not found: {path}")
    #             return None
    #         with Image.open(p) as im:
    #             info = self._exif_to_dict(im)
    #         print(f"[Bridge][EXIF] path OK: {path}")
    #         return info
    #     except Exception as e:
    #         print(f"[Bridge][EXIF][ERROR] path: {e}")
    #         return None

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


    
    # def read_exif_from_path(self, path: str) -> Optional[Dict]:
    #     try:
    #         p = Path(path)
    #         if not p.exists():
    #             print(f"[Bridge][EXIF] not found: {path}")
    #             return None

    #         with Image.open(p) as im:
    #             info = self._exif_to_dict(im)
    #         try:
    #             info.setdefault("FileSize", p.stat().st_size)
    #         except Exception as e:
    #             print(f"[Bridge][EXIF][WARN] stat error for {path}: {e}")

    #         print(f"[Bridge][EXIF] path OK: {path}")
    #         return info

    #     except Exception as e:
    #         print(f"[Bridge][EXIF][ERROR] path: {e}")
    #         return None
        
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

