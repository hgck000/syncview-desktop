from __future__ import annotations
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path

app = FastAPI(title="SyncView API", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}

# (Sau này nếu build FE, có thể mount StaticFiles tại "/")
FRONTEND_DIST = (
    Path(__file__).resolve().parents[2] / "frontend" / "dist"
)  # ../.. / frontend/dist

if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")
