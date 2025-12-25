import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

app = FastAPI()

# (tuỳ bạn) nếu có API:
# from .routers import api
# app.include_router(api.router, prefix="/api")

# ---- TÌM THƯ MỤC FE (frontend/dist) ----
def resolve_fe_dir() -> str:
    # 1) Ưu tiên đường dẫn do run_prod.py truyền vào
    fe = os.getenv("SYNCVIEW_FRONTEND_DIR")
    if fe and Path(fe).exists():
        return fe

    # 2) Khi chạy từ source (không phải exe)
    here = Path(__file__).resolve()
    src_try = here.parents[2] / "frontend" / "dist"   # ../../frontend/dist từ backend/app/main.py
    if src_try.exists():
        return str(src_try)

    # 3) Khi chạy trong PyInstaller nhưng bạn không set env (fallback)
    meipass = getattr(os, "_MEIPASS", None)
    if meipass:
        bundle_try = Path(meipass) / "frontend" / "dist"
        if bundle_try.exists():
            return str(bundle_try)

    # 4) Cuối cùng: trả về chuỗi rỗng -> không mount được
    return ""

FE_DIR = resolve_fe_dir()

# ---- MOUNT STATIC ROOT nếu tìm thấy FE_DIR ----
if FE_DIR:
    # html=True để trả index.html cho mọi route con (SPA)
    app.mount("/", StaticFiles(directory=FE_DIR, html=True), name="static")
else:
    # Không tìm thấy FE_DIR: tạo route báo lỗi rõ ràng (tránh JSON 404 khó hiểu)
    @app.get("/")
    def _missing_fe():
        return HTMLResponse("<h2>FE not found</h2><p>Check SYNCVIEW_FRONTEND_DIR and PyInstaller --add-data</p>", status_code=500)