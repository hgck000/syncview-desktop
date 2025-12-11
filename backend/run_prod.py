from __future__ import annotations
import os, sys, threading, time, socket, traceback, uvicorn, webview
from pathlib import Path
from app.bridge import Bridge
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


# ------------- CONFIG -------------
API_HOST = "127.0.0.1"
API_PORT = 5174
APP_DATA_DIR = Path.home() / ".syncview"
APP_DATA_DIR.mkdir(exist_ok=True)
LOG_FILE = APP_DATA_DIR / "syncview.log"
# ----------------------------------

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

    # 2) đợi server nghe port
    if not wait_for_port(API_HOST, API_PORT, timeout_sec=20):
        # ghi log để kiểm tra
        log_exc("startup", RuntimeError("Backend did not start within timeout"))

    # 3) tạo window sau khi backend sẵn sàng
    # window = webview.create_window("SyncView", f"http://{API_HOST}:{API_PORT}")
    window = webview.create_window(
        "SyncView",
        f"http://{API_HOST}:{API_PORT}",
        maximized=True,      # 👉 mở app ra là full luôn
        resizable=True,      # tuỳ, nhưng thường bạn vẫn muốn cho resize
    )


    # 4) expose API pywebview v5 (nếu cần)
    try:
        from app.bridge import Bridge
        bridge = Bridge(APP_DATA_DIR, window)  # window có thể optional tùy bạn đã sửa
        # expose từng hàm (đổi theo methods bạn có)
        window.expose(
            getattr(bridge, "open_dialog", lambda *a, **k: None),
            getattr(bridge, "read_image_dataurl", lambda *a, **k: None),
            getattr(bridge, "read_exif_from_path", lambda *a, **k: None),
            getattr(bridge, "read_exif_from_dataurl", lambda *a, **k: None),

            # tên thật trong Bridge (snake_case)
            getattr(bridge, "write_last_session", lambda *a, **k: None),
            getattr(bridge, "read_last_session",  lambda *a, **k: None),
        )
        setattr(bridge, "saveLastSession", bridge.write_last_session)
        setattr(bridge, "loadLastSession", bridge.read_last_session)

        # 3) Expose thêm 2 tên camelCase (PyWebview v5 cho phép expose nhiều lần)
        window.expose(
            getattr(bridge, "saveLastSession"),
            getattr(bridge, "loadLastSession"),
        )
    except Exception as e:
        log_exc("bridge", e)

    webview.start()
