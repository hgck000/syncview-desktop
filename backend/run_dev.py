from __future__ import annotations
import threading, time
import uvicorn, webview
from pathlib import Path
from app.bridge import Bridge
import os, socket

API_HOST = "127.0.0.1"
API_PORT = int(os.getenv("SYNCVIEW_API_PORT", "5174"))
FRONTEND_DEV_URL = "http://localhost:5173"
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(exist_ok=True)

def is_port_free(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.2)
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False

def find_free_port(host: str, start: int) -> int:
    p = start
    while not is_port_free(host, p):
        p += 1
    return p

API_PORT = find_free_port(API_HOST, API_PORT)
print("[Dev] API_PORT =", API_PORT)

def start_api():
    uvicorn.run("app.main:app", host=API_HOST, port=API_PORT, reload=False, log_level="info")
def on_shown():
    window.maximize()

if __name__ == "__main__":
    t = threading.Thread(target=start_api, daemon=True)
    t.start()
    time.sleep(0.8)
    
    window = webview.create_window("SyncView — Dev", FRONTEND_DEV_URL, width=1280, height=800, resizable=True, maximized=True)
    api = Bridge(APP_DATA_DIR, window)
    window.expose(
        api.open_dialog,
        api.recent_files, api.read_image_dataurl,
        api.read_exif_from_path, api.read_exif_from_dataurl,
        api.reverse_geocode,
        api.read_last_session, api.write_last_session,
        api.save_png_dialog,
    )

    print("[Dev] Starting webview…")
    
    # window.events.shown += on_shown
    webview.start()
