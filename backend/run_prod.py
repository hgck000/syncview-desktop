from __future__ import annotations

import os
import secrets
import socket
import sys
import threading
import time
import traceback
import urllib.request
from pathlib import Path

# WebView2 defaults to creating its browser data beside the executable. That
# location is not writable after an installer puts SyncView in Program Files,
# so configure a per-user folder before importing/initializing pywebview.
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
os.environ["SYNCVIEW_APP_DATA_DIR"] = str(APP_DATA_DIR)

if sys.platform.startswith("win"):
    local_app_data = Path(
        os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local"
    )
    WEBVIEW_DATA_DIR = local_app_data / "SyncView" / "WebView2"
    WEBVIEW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    os.environ["WEBVIEW2_USER_DATA_FOLDER"] = str(WEBVIEW_DATA_DIR)

import uvicorn
import webview

from app.bridge import Bridge
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


# ------------- CONFIG -------------
API_HOST = "127.0.0.1"
API_PORT = int(os.getenv("SYNCVIEW_API_PORT", "5174"))
LOG_FILE = APP_DATA_DIR / "syncview.log"
# ----------------------------------

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
os.environ["SYNCVIEW_MEDIA_TOKEN"] = secrets.token_urlsafe(32)

def dist_dir() -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[2]))
    return base / "frontend" / "dist"
app = FastAPI()
app.mount("/", StaticFiles(directory=str(dist_dir()), html=True), name="static")

def log_exc(prefix: str, e: Exception):
    try:
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(f"[{prefix}] {e}\n{traceback.format_exc()}\n\n")
    except Exception:
        pass

def resource_path(*parts: str) -> str:
    base = getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)
    return str(Path(base).joinpath(*parts))

def wait_for_port(host: str, port: int, timeout_sec: int = 20) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=1):
                return True
        except OSError:
            time.sleep(0.25)
    return False

def wait_for_http(url: str, timeout_sec: int = 25) -> bool:
    deadline = time.time() + timeout_sec
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                # 200 + content-type text/html is a good signal FE is being served
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.25)
    return False


def start_api():
    try:
        # cho backend biết đường dẫn FE (đã --add-data "frontend/dist;frontend/dist")
        os.environ.setdefault("SYNCVIEW_FRONTEND_DIR", resource_path("frontend", "dist"))

        # tránh import theo chuỗi: import trực tiếp app
        from app.main import app

        uvicorn.run(
            app,
            host=API_HOST,
            port=API_PORT,
            log_level="info",
            # Nếu cần nhanh hơn (tắt lifespan):
            # lifespan="off",
        )
    except Exception as e:
        log_exc("uvicorn", e)
        raise

if __name__ == "__main__":
    # 1) chạy API ở thread nền
    t = threading.Thread(target=start_api, daemon=True)
    t.start()

    # 2) đợi backend sẵn sàng (port + HTTP /)
    url = f"http://{API_HOST}:{API_PORT}/"
    ready = wait_for_http(url, timeout_sec=25)
    if not ready:
        err = RuntimeError(f"Backend not ready at {url}")
        log_exc("startup", err)
        html = f"""
        <html><body style='font-family:Segoe UI, Arial; padding:16px;'>
          <h2>SyncView không khởi động được</h2>
          <p>Không truy cập được <b>{url}</b>.</p>
          <p>Log đã ghi tại: <code>{LOG_FILE}</code></p>
          <p>Hãy gửi file log này cho dev để bắt lỗi nhanh.</p>
        </body></html>
        """
        webview.create_window("SyncView - Startup Error", html=html, width=720, height=480)
        webview.start()
        raise SystemExit(1)

    # 3) tạo window sau khi backend sẵn sàng sau khi backend sẵn sàng
    # window = webview.create_window("SyncView", f"http://{API_HOST}:{API_PORT}")
    window = webview.create_window(
        "SyncView",
        f"http://{API_HOST}:{API_PORT}",
        maximized=True,
        resizable=True,
    )


    # 4) expose API pywebview v5 (nếu cần)
    try:
        from app.bridge import Bridge
        bridge = Bridge(APP_DATA_DIR, window)
        window.expose(
            getattr(bridge, "open_dialog", lambda *a, **k: None),
            getattr(bridge, "get_image_url", lambda *a, **k: None),
            getattr(bridge, "persist_image_dataurl", lambda *a, **k: None),
            getattr(bridge, "stage_image_dataurl", lambda *a, **k: None),
            getattr(bridge, "read_image_dataurl", lambda *a, **k: None),
            getattr(bridge, "read_image_thumbnail", lambda *a, **k: None),
            getattr(bridge, "read_exif_from_path", lambda *a, **k: None),
            getattr(bridge, "read_exif_from_dataurl", lambda *a, **k: None),
            getattr(bridge, "reverse_geocode", lambda *a, **k: None),
            getattr(bridge, "write_last_session", lambda *a, **k: None),
            getattr(bridge, "read_last_session",  lambda *a, **k: None),
            getattr(bridge, "save_image_dialog", lambda *a, **k: None),
            getattr(bridge, "save_png_dialog", lambda *a, **k: None),
        )
        setattr(bridge, "saveLastSession", bridge.write_last_session)
        setattr(bridge, "loadLastSession", bridge.read_last_session)

        window.expose(
            getattr(bridge, "saveLastSession"),
            getattr(bridge, "loadLastSession"),
        )
    except Exception as e:
        log_exc("bridge", e)

    webview.start()
