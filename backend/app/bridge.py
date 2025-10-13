from __future__ import annotations
import webview
from pathlib import Path
from typing import Dict, List, Optional

class Bridge:
    """API được FE gọi qua window.pywebview.api"""
    def __init__(self, app_data_dir: Path):
        self.app_data_dir = app_data_dir
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        self.recent: Dict[str, List[str]] = {"A": [], "B": [], "C": [], "D": []}

    def open_dialog(self, pane: str) -> Optional[str]:
        result = webview.create_file_dialog(
            webview.OPEN_DIALOG,
            directory=str(Path.home()),
            file_types=('Images (*.jpg;*.jpeg;*.png;*.webp;*.heic)',)
        )
        if not result:
            return None
        path = str(Path(result[0]).resolve())
        self._remember(pane, path)
        return path

    def recent_files(self) -> Dict[str, List[str]]:
        return self.recent

    def _remember(self, pane: str, path: str) -> None:
        items = self.recent.get(pane, [])
        if path in items: items.remove(path)
        items.insert(0, path)
        self.recent[pane] = items[:10]
