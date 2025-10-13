from __future__ import annotations
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI(title="SyncView API", version="0.1.0")

@app.get("/health")
def health():
    return {"ok": True}

# (Sau này nếu build FE, có thể mount StaticFiles tại "/")
