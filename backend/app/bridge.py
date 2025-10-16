from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional
import webview
from PIL import Image, ExifTags
import io, base64, json

class Bridge:
    """
    JS gọi: window.pywebview.api.open_dialog(pane)
    v5: dùng window.create_file_dialog; expose từng hàm.
    """
    def __init__(self, app_data_dir: Path, window: "webview.Window"):
        self.app_data_dir = app_data_dir
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.recent: Dict[str, List[str]] = {"A": [], "B": [], "C": [], "D": []}
        self.window = window

    # ===== HÀM SẼ EXPOSE =====
    def open_dialog(self, pane: str) -> Optional[str]:
        print(f"[Bridge] open_dialog pane={pane}")
        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                directory=str(Path.home()),
                allow_multiple=False,
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
            im = Image.open(p).convert("RGBA")
            buf = io.BytesIO()
            im.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            dataurl = f"data:image/png;base64,{b64}"
            print(f"[Bridge] read_image_dataurl OK w={im.width} h={im.height} path={path}")
            return dataurl
        except Exception as e:
            print(f"[Bridge][ERROR] read_image_dataurl: {e}")
            return None

    def recent_files(self) -> Dict[str, List[str]]:
        return self.recent

    # ===== internal =====
    def _remember(self, pane: str, path: str) -> None:
        items = self.recent.get(pane, [])
        if path in items:
            items.remove(path)
        items.insert(0, path)
        self.recent[pane] = items[:10]
        
    def _exif_to_dict(self, img: Image.Image) -> Dict:
        """Chuyển EXIF của Pillow sang dict khoẻ mạnh (keys human-readable)"""
        out = {}
        try:
            raw = img.getexif() or {}
        except Exception:
            raw = {}
        tagmap = {v: k for k, v in ExifTags.TAGS.items()}
        def get(tag):
            key = tagmap.get(tag)
            return raw.get(key) if key is not None else None

        # lấy các trường hay dùng
        out["Make"] = get("Make")
        out["Model"] = get("Model")
        out["DateTimeOriginal"] = get("DateTimeOriginal") or get("DateTime")
        out["FNumber"] = self._ratio_to_float(get("FNumber"))
        out["ExposureTime"] = self._ratio_to_float(get("ExposureTime"))
        out["ISOSpeedRatings"] = get("ISOSpeedRatings") or get("PhotographicSensitivity")
        out["FocalLength"] = self._ratio_to_float(get("FocalLength"))
        out["LensModel"] = get("LensModel")
        out["Orientation"] = get("Orientation")
        # kích thước gốc
        try:
            out["ImageWidth"], out["ImageHeight"] = img.size
        except Exception:
            pass
        return out

    def _ratio_to_float(self, v):
        # EXIF có thể là (num, den) hoặc Fraction
        try:
            if v is None: return None
            if isinstance(v, tuple) and len(v) == 2:
                num, den = v
                return float(num) / float(den) if den else None
            return float(v)
        except Exception:
            return None

    def read_exif_from_path(self, path: str) -> Optional[Dict]:
        try:
            p = Path(path)
            if not p.exists():
                print(f"[Bridge][EXIF] not found: {path}")
                return None
            with Image.open(p) as im:
                info = self._exif_to_dict(im)
            print(f"[Bridge][EXIF] path OK: {path}")
            return info
        except Exception as e:
            print(f"[Bridge][EXIF][ERROR] path: {e}")
            return None

    def read_exif_from_dataurl(self, dataurl: str) -> Optional[Dict]:
        try:
            # data:image/...;base64,XXXX
            head, b64 = dataurl.split(",", 1)
            buf = io.BytesIO(base64.b64decode(b64))
            with Image.open(buf) as im:
                info = self._exif_to_dict(im)
            print(f"[Bridge][EXIF] dataURL OK")
            return info
        except Exception as e:
            print(f"[Bridge][EXIF][ERROR] dataURL: {e}")
            return None
