from __future__ import annotations
from pathlib import Path
from typing import Dict, List, Optional
import webview
from PIL import Image
import io, base64

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
