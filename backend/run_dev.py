from __future__ import annotations
import threading, time
import uvicorn, webview
from pathlib import Path
from app.bridge import Bridge

# Cổng FastAPI dev
API_PORT = 5174
# URL FE Vite dev (mặc định Vite dùng 5173)
FRONTEND_DEV_URL = "http://127.0.0.1:5173"
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(exist_ok=True)

def start_api():
    # chạy FastAPI với reload để tiện dev
    uvicorn.run("app.main:app", host="127.0.0.1", port=API_PORT, reload=True, log_level="info")

if __name__ == "__main__":
    # 1) chạy API ở thread nền
    t = threading.Thread(target=start_api, daemon=True)
    t.start()
    time.sleep(0.8)

    # 2) tạo bridge và mở cửa sổ app trỏ tới Vite
    bridge = Bridge(APP_DATA_DIR)
    webview.create_window("SyncView — Dev", FRONTEND_DEV_URL, js_api=bridge)
    webview.start()
