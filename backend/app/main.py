import hashlib
import mimetypes
import os
import secrets
import sys
import tempfile
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask
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


def resolve_media_cache_dir() -> Path:
    configured_app_data = os.getenv("SYNCVIEW_APP_DATA_DIR")
    if configured_app_data:
        root = Path(configured_app_data)
    elif sys.platform.startswith("win"):
        root = Path(os.getenv("LOCALAPPDATA") or Path.home()) / "SyncView"
    elif sys.platform == "darwin":
        root = Path.home() / "Library" / "Application Support" / "SyncView"
    else:
        # Direct imports in tests/tools should not create permanent user data.
        root = Path(tempfile.gettempdir()) / "syncview"

    cache_dir = root / "media-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


MEDIA_CACHE_DIR = resolve_media_cache_dir()
MEDIA_CACHE_MAX_BYTES = max(
    64,
    int(os.getenv("SYNCVIEW_MEDIA_CACHE_MAX_MB", "512")),
) * 1024 * 1024
MEDIA_CACHE_DECODE_LIMIT = threading.BoundedSemaphore(2)
MEDIA_CACHE_STATE_LOCK = threading.Lock()
MEDIA_CACHE_FILE_LOCKS: dict[Path, threading.Lock] = {}
MEDIA_CACHE_ACTIVE: dict[Path, int] = {}


def decoded_cache_path(image_path: Path) -> Path:
    stat = image_path.stat()
    fingerprint = (
        f"{image_path}\0{stat.st_size}\0{stat.st_mtime_ns}".encode("utf-8")
    )
    return MEDIA_CACHE_DIR / f"{hashlib.sha256(fingerprint).hexdigest()}.png"


def _cache_file_lock(cache_path: Path) -> threading.Lock:
    with MEDIA_CACHE_STATE_LOCK:
        return MEDIA_CACHE_FILE_LOCKS.setdefault(
            cache_path,
            threading.Lock(),
        )


def prune_media_cache(exclude: set[Path] | None = None) -> None:
    """Keep the persistent decoded cache bounded using file mtime as LRU."""
    excluded = exclude or set()
    try:
        files = [
            path
            for path in MEDIA_CACHE_DIR.glob("*.png")
            if path.is_file()
        ]
        sizes = {path: path.stat().st_size for path in files}
        total = sum(sizes.values())
        if total <= MEDIA_CACHE_MAX_BYTES:
            return

        oldest_first = sorted(
            files,
            key=lambda path: path.stat().st_mtime_ns,
        )
        for path in oldest_first:
            if total <= MEDIA_CACHE_MAX_BYTES:
                break
            if path in excluded:
                continue

            # Decode/serve setup and eviction use the same per-file lock. This
            # prevents the LRU worker from deleting an image between decoding
            # it and handing it to FileResponse.
            with _cache_file_lock(path):
                with MEDIA_CACHE_STATE_LOCK:
                    if MEDIA_CACHE_ACTIVE.get(path, 0) > 0:
                        continue
                try:
                    size = sizes.get(path, path.stat().st_size)
                    path.unlink(missing_ok=True)
                    total -= size
                except OSError:
                    continue
    except OSError as exc:
        print(f"[API][CACHE][WARN] cleanup failed: {exc}")


def ensure_decoded_image(
    image_path: Path,
    *,
    mark_active: bool = False,
) -> Path:
    cached_image = decoded_cache_path(image_path)
    cached_image.parent.mkdir(parents=True, exist_ok=True)

    with _cache_file_lock(cached_image):
        if not cached_image.exists():
            with MEDIA_CACHE_DECODE_LIMIT:
                # A waiter may have completed the same file before this worker
                # acquired a decode slot.
                if not cached_image.exists():
                    temporary_image = cached_image.with_name(
                        f"{cached_image.name}.{threading.get_ident()}.tmp"
                    )
                    try:
                        with Image.open(image_path) as source:
                            oriented = ImageOps.exif_transpose(source)
                            has_alpha = (
                                "A" in oriented.getbands()
                                or "transparency" in oriented.info
                            )
                            decoded = oriented.convert(
                                "RGBA" if has_alpha else "RGB"
                            )
                            # Level 1 remains pixel-perfect while minimizing
                            # the first-load HEIC encoding time.
                            decoded.save(
                                temporary_image,
                                format="PNG",
                                compress_level=1,
                            )
                        temporary_image.replace(cached_image)
                    finally:
                        temporary_image.unlink(missing_ok=True)

        # mtime is the cache's LRU marker; the source fingerprint is encoded in
        # the filename and remains unaffected.
        os.utime(cached_image, None)
        if mark_active:
            with MEDIA_CACHE_STATE_LOCK:
                MEDIA_CACHE_ACTIVE[cached_image] = (
                    MEDIA_CACHE_ACTIVE.get(cached_image, 0) + 1
                )

    return cached_image


def _release_cache_response(cache_path: Path) -> None:
    with MEDIA_CACHE_STATE_LOCK:
        remaining = MEDIA_CACHE_ACTIVE.get(cache_path, 0) - 1
        if remaining > 0:
            MEDIA_CACHE_ACTIVE[cache_path] = remaining
        else:
            MEDIA_CACHE_ACTIVE.pop(cache_path, None)
    prune_media_cache()


prune_media_cache()


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
        cached_image = ensure_decoded_image(
            image_path,
            mark_active=True,
        )
        prune_media_cache(exclude={cached_image})
        try:
            return FileResponse(
                cached_image,
                media_type="image/png",
                headers=cache_headers,
                background=BackgroundTask(
                    _release_cache_response,
                    cached_image,
                ),
            )
        except Exception:
            _release_cache_response(cached_image)
            raise
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
