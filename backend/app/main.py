import hashlib
import mimetypes
import os
import secrets
import tempfile
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from PIL import Image, ImageOps
from pillow_heif import register_heif_opener

app = FastAPI()

register_heif_opener(thumbnails=False)

# Vite uses :5173 while the local image server uses :5174 in development.
# CORS keeps those image canvases readable for annotations and export.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

DIRECT_BROWSER_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DECODED_IMAGE_FORMATS = {".bmp", ".tif", ".tiff", ".heic", ".heif", ".hif"}
SUPPORTED_IMAGE_FORMATS = DIRECT_BROWSER_FORMATS | DECODED_IMAGE_FORMATS
MEDIA_CACHE = tempfile.TemporaryDirectory(prefix="syncview-media-")
MEDIA_CACHE_DIR = Path(MEDIA_CACHE.name)
MEDIA_CACHE_LOCK = threading.Lock()


def decoded_cache_path(image_path: Path) -> Path:
    stat = image_path.stat()
    fingerprint = (
        f"{image_path}\0{stat.st_size}\0{stat.st_mtime_ns}".encode("utf-8")
    )
    return MEDIA_CACHE_DIR / f"{hashlib.sha256(fingerprint).hexdigest()}.png"


@app.get("/api/image")
def serve_local_image(path: str, token: str):
    expected_token = os.getenv("SYNCVIEW_MEDIA_TOKEN", "")
    if (
        not expected_token
        or not secrets.compare_digest(token, expected_token)
    ):
        raise HTTPException(status_code=403, detail="Invalid media token")

    try:
        image_path = Path(path).resolve(strict=True)
    except (OSError, RuntimeError):
        raise HTTPException(status_code=404, detail="Image not found") from None

    extension = image_path.suffix.lower()
    if not image_path.is_file() or extension not in SUPPORTED_IMAGE_FORMATS:
        raise HTTPException(status_code=415, detail="Unsupported image format")

    cache_headers = {"Cache-Control": "private, max-age=3600"}
    if extension in DIRECT_BROWSER_FORMATS:
        media_type = mimetypes.guess_type(image_path.name)[0] or "image/jpeg"
        return FileResponse(
            image_path,
            media_type=media_type,
            headers=cache_headers,
        )

    try:
        cached_image = decoded_cache_path(image_path)
        with MEDIA_CACHE_LOCK:
            if not cached_image.exists():
                temporary_image = cached_image.with_suffix(".tmp")
                with Image.open(image_path) as source:
                    oriented = ImageOps.exif_transpose(source)
                    has_alpha = (
                        "A" in oriented.getbands()
                        or "transparency" in oriented.info
                    )
                    decoded = oriented.convert(
                        "RGBA" if has_alpha else "RGB"
                    )
                    # Faster lossless intermediate for local display. PNG
                    # compression level changes size/speed, never pixel data.
                    decoded.save(
                        temporary_image,
                        format="PNG",
                        compress_level=1,
                    )
                temporary_image.replace(cached_image)

        return FileResponse(
            cached_image,
            media_type="image/png",
            headers=cache_headers,
        )
    except Exception as exc:
        print(f"[API][IMAGE][ERROR] {image_path}: {exc}")
        raise HTTPException(
            status_code=422,
            detail="Unable to decode image",
        ) from exc

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
