from __future__ import annotations
import threading, time
import uvicorn, webview
from pathlib import Path
from app.bridge import Bridge

API_PORT = 5174
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(exist_ok=True)

def start_api():
    uvicorn.run("app.main:app", host="localhost", port=API_PORT, log_level="info")

if __name__ == "__main__":
    t = threading.Thread(target=start_api, daemon=True)
    t.start()
    time.sleep(0.8)
    bridge = Bridge(APP_DATA_DIR)
    # Trỏ WebView vào FastAPI (đang serve frontend/dist ở "/")
    webview.create_window("SyncView", f"http://localhost:{API_PORT}", js_api=bridge)
    webview.start()
