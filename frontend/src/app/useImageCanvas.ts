import { useEffect, useRef } from "react";
import { readImageDataURL } from "./bridge";

type GridOpt = { on: boolean; size: number; opacity: number };
type Opts = {
  path?: string;
  dataURL?: string;
  view: { scale: number; offsetX: number; offsetY: number };
  grid: GridOpt;
  onImageMeta?: (w: number, h: number) => void;
};


export function useImageCanvas(opts: Opts) {
  const { path, dataURL, view, onImageMeta, grid } = opts;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const dpr = window.devicePixelRatio || 1;
    const cwCss = canvas.clientWidth, chCss = canvas.clientHeight;
    canvas.width = Math.max(1, Math.floor(cwCss * dpr));
    canvas.height = Math.max(1, Math.floor(chCss * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.scale(dpr, dpr);

    const iw = img.naturalWidth, ih = img.naturalHeight;
    const fit = Math.min(cwCss / iw, chCss / ih);
    const total = fit * view.scale;

    const w = iw * total, h = ih * total;
    const x = (cwCss - w)/2 + view.offsetX;
    const y = (chCss - h)/2 + view.offsetY;

    ctx.clearRect(0, 0, cwCss, chCss);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, x, y, w, h);

    // === GRID OVERLAY (tĩnh theo viewer, không theo ảnh) ===
    if (grid.on && grid.size > 0) {
      const step = Math.max(4, grid.size); // bước lưới theo pixel viewer
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, grid.opacity));
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;

      // kẻ phủ toàn bộ viewer (canvas)
      // dọc
      for (let gx = 0; gx <= cwCss + 0.5; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, chCss);
        ctx.stroke();
      }
      // ngang
      for (let gy = 0; gy <= chCss + 0.5; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(cwCss, gy);
        ctx.stroke();
      }

      ctx.restore();
    }
  }
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const canvas = canvasRef.current;
      if (!canvas || (!path && !dataURL)) return;

      let url = dataURL;
      if (!url && path) url = await readImageDataURL(path);
      if (cancelled || !url) return;

      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        imgRef.current = img;
        onImageMeta?.(img.naturalWidth, img.naturalHeight);
        draw();
      };
      img.onerror = (e) => console.warn("[canvas] load fail", e);
      img.src = url;
    };

    load();

    const ro = new ResizeObserver(() => draw());
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => { cancelled = true; ro.disconnect(); };
  // re-run vẽ khi view đổi
  }, [path, dataURL, view.scale, view.offsetX, view.offsetY, grid.on, grid.size, grid.opacity]);

  return canvasRef;
}