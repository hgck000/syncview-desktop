from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional, Any
import webview
from PIL import Image, ExifTags, ImageOps
from pillow_heif import register_heif_opener
import io, base64, hashlib, json, os, sys, mimetypes, tempfile, threading, time
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# Register HEIF/HEIC once so every Image.open() path below (full image,
# thumbnails and EXIF) uses the same decoder. Embedded HEIF thumbnails are not
# needed because SyncView creates its own comparison-rail thumbnails.
register_heif_opener(thumbnails=False)

SESSION_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tif",
    ".tiff",
    ".heic",
    ".heif",
    ".hif",
}
SESSION_IMAGE_MIME_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff",
    "image/heic": ".heic",
    "image/heif": ".heif",
}
SESSION_IMAGE_FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "GIF": ".gif",
    "BMP": ".bmp",
    "TIFF": ".tiff",
    "HEIF": ".heic",
    "HEIC": ".heic",
}


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
        self._media_token = os.getenv("SYNCVIEW_MEDIA_TOKEN", "")
        self._staged_image_dir_handle = tempfile.TemporaryDirectory(
            prefix="syncview-dropped-images-"
        )
        self._staged_image_dir = Path(self._staged_image_dir_handle.name)
        self._staged_image_lock = threading.Lock()
        self._session_image_dir = self.app_data_dir / "session-images"
        self._session_image_dir.mkdir(parents=True, exist_ok=True)
        self._session_image_lock = threading.Lock()
        self._geocode_lock = threading.Lock()
        self._last_geocode_request = 0.0
        self._geocode_cache = self._read_geocode_cache()
        
    def attach_window(self, window):
        self.window = window

    def open_dialog(self, pane: str) -> Optional[List[str]]:
        print(f"[Bridge] open_dialog pane={pane}")
        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                directory=str(Path.home()),
                allow_multiple=True,
                file_types=(
                    'Images (*.jpg;*.jpeg;*.png;*.webp;*.heic;*.heif;*.hif)',
                )
            )
            print(f"[Bridge] dialog result={result}")
        except Exception as e:
            print(f"[Bridge][ERROR] create_file_dialog: {e}")
            return None
        if not result:
            return None
        paths = [str(Path(item).resolve()) for item in result]
        for path in reversed(paths):
            self._remember(pane, path)
        print(f"[Bridge] selected paths={paths}")
        return paths

    def get_image_url(self, path: str) -> Optional[str]:
        """Return a short authenticated URL instead of bridging a huge DataURL."""
        try:
            if not self._media_token:
                return None

            image_path = Path(path).resolve(strict=True)
            if not image_path.is_file():
                return None

            query = urlencode(
                {
                    "path": str(image_path),
                    "token": self._media_token,
                    "v": image_path.stat().st_mtime_ns,
                }
            )
            # Keep media same-origin with the page. In production FastAPI
            # handles this path directly; Vite proxies /api during development.
            return f"/api/image?{query}"
        except Exception as e:
            print(f"[Bridge][IMG-URL][ERROR] {path}: {e}")
            return None

    @staticmethod
    def _decode_dataurl_payload(dataurl: str) -> tuple[str, bytes]:
        if not isinstance(dataurl, str) or "," not in dataurl:
            raise ValueError("Invalid image DataURL")

        header, encoded = dataurl.split(",", 1)
        if (
            not header.lower().startswith("data:")
            or ";base64" not in header.lower()
        ):
            raise ValueError("Only base64 image DataURLs are supported")

        max_raw_bytes = 256 * 1024 * 1024
        if len(encoded) > ((max_raw_bytes + 2) // 3) * 4:
            raise ValueError("Image exceeds the 256 MB limit")

        raw = base64.b64decode(encoded, validate=True)
        if not raw or len(raw) > max_raw_bytes:
            raise ValueError("Image is empty or too large")
        return header, raw

    @staticmethod
    def _session_image_extension(
        header: str,
        raw: bytes,
        suggested_name: str | None,
    ) -> str:
        # Trust the actual bytes first. File names and clipboard MIME types are
        # frequently missing or inaccurate, especially for HEIC on Windows.
        try:
            with Image.open(io.BytesIO(raw)) as source:
                detected = SESSION_IMAGE_FORMAT_EXTENSIONS.get(
                    str(source.format or "").upper()
                )
            if detected:
                return detected
        except Exception:
            pass

        if suggested_name:
            suffix = Path(suggested_name).suffix.lower()
            if suffix in SESSION_IMAGE_EXTENSIONS:
                return suffix

        mime = header[5:].split(";", 1)[0].strip().lower()
        mime_extension = SESSION_IMAGE_MIME_EXTENSIONS.get(mime)
        if mime_extension:
            return mime_extension

        raise ValueError("Unsupported image format")

    def persist_image_dataurl(
        self,
        dataurl: str,
        suggested_name: str | None = None,
    ) -> Optional[str]:
        """Store the exact dropped/pasted bytes and return a stable local path."""
        try:
            header, raw = self._decode_dataurl_payload(dataurl)
            extension = self._session_image_extension(
                header,
                raw,
                suggested_name,
            )
            digest = hashlib.sha256(raw).hexdigest()
            image_path = self._session_image_dir / f"{digest}{extension}"

            with self._session_image_lock:
                if not image_path.exists():
                    temporary_path = image_path.with_name(
                        f"{image_path.name}.{threading.get_ident()}.tmp"
                    )
                    try:
                        temporary_path.write_bytes(raw)
                        temporary_path.replace(image_path)
                    finally:
                        temporary_path.unlink(missing_ok=True)

            print(
                "[Bridge][SESSION-IMAGE] persisted "
                f"{len(raw)} bytes -> {image_path.name}"
            )
            return str(image_path.resolve())
        except Exception as e:
            print(f"[Bridge][SESSION-IMAGE][ERROR] {e}")
            return None

    def stage_image_dataurl(self, dataurl: str) -> Optional[str]:
        """Decode a dropped browser-incompatible image and return its media URL.

        WebView2 does not expose a local path for every drag/drop operation.
        FileReader then labels HEIC as application/octet-stream and Chromium
        cannot decode that DataURL. Decode it once with Pillow and serve the
        resulting PNG through the same local media endpoint as opened files.
        """
        try:
            _, raw = self._decode_dataurl_payload(dataurl)

            digest = hashlib.sha256(raw).hexdigest()
            staged_path = self._staged_image_dir / f"{digest}.png"

            with self._staged_image_lock:
                if not staged_path.exists():
                    temporary_path = staged_path.with_suffix(".tmp")
                    try:
                        with Image.open(io.BytesIO(raw)) as source:
                            oriented = ImageOps.exif_transpose(source)
                            has_alpha = (
                                "A" in oriented.getbands()
                                or "transparency" in oriented.info
                            )
                            decoded = oriented.convert(
                                "RGBA" if has_alpha else "RGB"
                            )
                            # PNG stays pixel-perfect at every compression
                            # level. Level 1 is substantially faster to encode
                            # than Pillow's default while remaining compact.
                            decoded.save(
                                temporary_path,
                                format="PNG",
                                compress_level=1,
                            )
                        temporary_path.replace(staged_path)
                    finally:
                        temporary_path.unlink(missing_ok=True)

            media_url = self.get_image_url(str(staged_path))
            if media_url:
                print(
                    "[Bridge][DROP] staged image "
                    f"{len(raw)} bytes -> {staged_path.name}"
                )
            return media_url
        except Exception as e:
            print(f"[Bridge][DROP][ERROR] unable to decode dropped image: {e}")
            return None
    
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

    def read_image_thumbnail(
        self,
        path: str,
        max_width: int = 384,
        max_height: int = 384,
    ) -> Optional[str]:
        """Tạo thumbnail JPEG nhẹ cho các rail so sánh, không gửi ảnh gốc sang UI."""
        try:
            p = Path(path)
            if not p.exists():
                return None

            width = max(64, min(512, int(max_width)))
            height = max(64, min(512, int(max_height)))

            with Image.open(p) as source:
                thumb = ImageOps.exif_transpose(source)
                thumb.thumbnail((width, height), Image.Resampling.LANCZOS)

                rgba = thumb.convert("RGBA")
                background = Image.new("RGB", rgba.size, (18, 18, 18))
                background.paste(rgba, mask=rgba.getchannel("A"))

                buffer = io.BytesIO()
                background.save(
                    buffer,
                    format="JPEG",
                    quality=76,
                    optimize=True,
                )

            encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
            return f"data:image/jpeg;base64,{encoded}"
        except Exception as e:
            print(f"[Bridge][THUMB][ERROR] {path}: {e}")
            return None

    def recent_files(self) -> Dict[str, List[str]]:
        return self.recent

    def _remember(self, pane: str, path: str) -> None:
        items = self.recent.get(pane, [])
        if path in items:
            items.remove(path)
        items.insert(0, path)
        self.recent[pane] = items[:10]

    def _geocode_cache_path(self) -> Path:
        return self.app_data_dir / "geocode_cache.json"

    def _read_geocode_cache(self) -> Dict[str, Dict[str, str]]:
        try:
            data = json.loads(self._geocode_cache_path().read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return {
                    str(key): value
                    for key, value in data.items()
                    if isinstance(value, dict) and isinstance(value.get("name"), str)
                }
        except FileNotFoundError:
            pass
        except Exception as e:
            print(f"[Bridge][GEOCODE][WARN] read cache: {e}")
        return {}

    def _write_geocode_cache(self) -> None:
        try:
            path = self._geocode_cache_path()
            temp_path = path.with_suffix(".tmp")
            temp_path.write_text(
                json.dumps(self._geocode_cache, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            temp_path.replace(path)
        except Exception as e:
            print(f"[Bridge][GEOCODE][WARN] write cache: {e}")

    def _format_location_name(self, result: Dict[str, Any]) -> Optional[str]:
        address = result.get("address")
        if not isinstance(address, dict):
            address = {}

        locality = next(
            (
                address.get(key)
                for key in (
                    "city",
                    "town",
                    "municipality",
                    "village",
                    "hamlet",
                    "county",
                )
                if address.get(key)
            ),
            None,
        )
        region = address.get("state") or address.get("state_district")
        country = address.get("country")

        parts: List[str] = []
        seen = set()
        for value in (locality, region, country):
            if not isinstance(value, str):
                continue
            text = value.strip()
            key = text.casefold()
            if text and key not in seen:
                parts.append(text)
                seen.add(key)

        if parts:
            return ", ".join(parts)

        display_name = result.get("display_name")
        return display_name.strip() if isinstance(display_name, str) else None

    def reverse_geocode(self, latitude: float, longitude: float) -> Optional[Dict[str, str]]:
        """Đổi GPS thành địa danh ngắn gọn; cache kết quả và giới hạn 1 request/giây."""
        try:
            lat = float(latitude)
            lon = float(longitude)
        except (TypeError, ValueError):
            return None

        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return None

        cache_key = f"{lat:.5f},{lon:.5f}"
        cached = self._geocode_cache.get(cache_key)
        if cached:
            return cached

        with self._geocode_lock:
            cached = self._geocode_cache.get(cache_key)
            if cached:
                return cached

            wait_seconds = 1.05 - (time.monotonic() - self._last_geocode_request)
            if wait_seconds > 0:
                time.sleep(wait_seconds)

            endpoint = os.getenv(
                "SYNCVIEW_GEOCODER_URL",
                "https://nominatim.openstreetmap.org/reverse",
            )
            query = urlencode(
                {
                    "format": "jsonv2",
                    "lat": lat,
                    "lon": lon,
                    "zoom": 10,
                    "addressdetails": 1,
                    "accept-language": "vi,en",
                }
            )
            request = Request(
                f"{endpoint}?{query}",
                headers={
                    "User-Agent": (
                        "SyncView/2.3.0 "
                        "(https://github.com/hgck000/syncview-desktop)"
                    ),
                    "Accept": "application/json",
                },
            )

            self._last_geocode_request = time.monotonic()
            try:
                with urlopen(request, timeout=6) as response:
                    payload = json.loads(response.read(1024 * 1024).decode("utf-8"))
            except Exception as e:
                print(f"[Bridge][GEOCODE][WARN] request: {e}")
                return None

            if not isinstance(payload, dict):
                return None

            name = self._format_location_name(payload)
            if not name:
                return None

            resolved = {
                "name": name,
                "attribution": "© OpenStreetMap contributors",
            }
            self._geocode_cache[cache_key] = resolved
            self._write_geocode_cache()
            return resolved

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

    def _write_session_data(self, data: dict) -> None:
        path = self._last_session_path()
        temporary_path = path.with_suffix(".tmp")
        try:
            temporary_path.write_text(
                json.dumps(
                    data,
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                encoding="utf-8",
            )
            temporary_path.replace(path)
        finally:
            temporary_path.unlink(missing_ok=True)

    def _migrate_session_dataurls(self, data: dict) -> bool:
        changed = False
        tabs = data.get("tabs")
        if not isinstance(tabs, list):
            return False

        for tab in tabs:
            if not isinstance(tab, dict):
                continue
            files = tab.get("files")
            if not isinstance(files, dict):
                files = {}
                tab["files"] = files
            dataurls = tab.get("dataURL")
            if not isinstance(dataurls, dict):
                continue
            names = tab.get("names")
            if not isinstance(names, dict):
                names = {}

            for pane, dataurl in list(dataurls.items()):
                if files.get(pane):
                    dataurls.pop(pane, None)
                    changed = True
                    continue
                if not isinstance(dataurl, str) or not dataurl:
                    continue

                image_path = self.persist_image_dataurl(
                    dataurl,
                    names.get(pane),
                )
                if image_path:
                    files[pane] = image_path
                    dataurls.pop(pane, None)
                    changed = True

        return changed

    def _cleanup_session_images(self, data: dict) -> None:
        referenced: set[Path] = set()
        try:
            session_root = self._session_image_dir.resolve()
            for tab in data.get("tabs", []):
                if not isinstance(tab, dict):
                    continue
                files = tab.get("files")
                if not isinstance(files, dict):
                    continue
                for value in files.values():
                    if not isinstance(value, str) or not value:
                        continue
                    try:
                        image_path = Path(value).resolve()
                        if image_path.parent == session_root:
                            referenced.add(image_path)
                    except OSError:
                        continue

            with self._session_image_lock:
                for image_path in self._session_image_dir.iterdir():
                    if image_path.is_file() and image_path.resolve() not in referenced:
                        image_path.unlink(missing_ok=True)
        except OSError as e:
            print(f"[Bridge][SESSION-IMAGE][WARN] cleanup: {e}")

    def read_last_session(self) -> dict | None:
        try:
            p = self._last_session_path()
            if not p.exists():
                print("[Bridge] last_session not found")
                return None
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, dict) and self._migrate_session_dataurls(data):
                self._write_session_data(data)
                self._cleanup_session_images(data)
                print("[Bridge] migrated session DataURLs to local files")
            print("[Bridge] read_last_session OK")
            return data
        except Exception as e:
            print(f"[Bridge][ERROR] read_last_session: {e}")
            return None

    def write_last_session(self, data: dict) -> bool:
        try:
            if not isinstance(data, dict):
                raise ValueError("Session payload must be an object")
            self._migrate_session_dataurls(data)
            self._write_session_data(data)
            self._cleanup_session_images(data)
            print(f"[Bridge] write_last_session -> {self._last_session_path()}")
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

        # Tiêu cự thực tế và tiêu cự quy đổi full-frame/35 mm
        focal_length = flat.get("FocalLength")
        if focal_length is not None:
            out["FocalLength"] = focal_length

        focal_length_35mm = (
            flat.get("FocalLengthIn35mmFilm")
            or flat.get("FocalLengthIn35mmFormat")
            or flat.get("FocalLength35efl")
        )
        if focal_length_35mm is not None:
            out["FocalLengthIn35mmFilm"] = focal_length_35mm

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
