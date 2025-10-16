from __future__ import annotations
import threading, time
import uvicorn, webview
from pathlib import Path
from app.bridge import Bridge

API_PORT = 5174
FRONTEND_DEV_URL = "http://localhost:5173"
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(exist_ok=True)

def start_api():
    uvicorn.run("app.main:app", host="localhost", port=API_PORT, reload=False, log_level="info")

if __name__ == "__main__":
    t = threading.Thread(target=start_api, daemon=True)
    t.start()
    time.sleep(0.8)
    
    window = webview.create_window("SyncView — Dev", FRONTEND_DEV_URL)
    api = Bridge(APP_DATA_DIR, window)
    # window.expose(api.open_dialog, api.recent_files)  # <-- expose từng hàm
    window.expose(
        api.open_dialog,
        api.recent_files,
        api.read_image_dataurl,
        api.read_exif_from_path,
        api.read_exif_from_dataurl
    )  # <— thêm

    print("[Dev] Starting webview…")  # LOG
    webview.start()
