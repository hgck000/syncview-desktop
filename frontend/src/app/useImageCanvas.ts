import { useEffect, useRef } from "react";
import { readImageDataURL } from "./bridge";

type GridOpt = { on: boolean; size: number; opacity: number };
type LoupeOpt = { on: boolean; size: number; zoom: number; shape?: 'circle'|'square' };
type Pointer = { u:number; v:number };

type Opts = {
  path?: string;
  dataURL?: string;
  view: { scale: number; offsetX: number; offsetY: number };
  grid: GridOpt;
  loupe: LoupeOpt;
  pointer: Pointer; // vị trí con trỏ 0..1 trong viewer (pane)
  onImageMeta?: (w: number, h: number) => void;
};

export function useImageCanvas(opts: Opts) {
  const { path, dataURL, view, onImageMeta, grid, loupe, pointer } = opts;
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
      // === LOUPE (tĩnh theo viewer; phóng vùng ảnh tại (u,v)) ===
    if (loupe.on) {
      const cx = pointer.u * cwCss;
      const cy = pointer.v * chCss;
      const size = loupe.size;       // đường kính nếu circle
      const half = size / 2;
      const zoom = loupe.zoom ?? 2;

      // Từ (cx,cy) trên viewer, suy ra toạ độ tương đối vào ảnh:
      // Ảnh đang vẽ ở (x,y,w,h), ta muốn phóng đại quanh điểm này
      // Tạo viewport phóng đại bằng cách vẽ lại ảnh với scale = total*zoom,
      // và dịch sao cho điểm (cx,cy) vẫn là tâm lúp.
      // const dpr = window.devicePixelRatio || 1;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const fit = Math.min(cwCss / iw, chCss / ih);
      const total = fit * view.scale;

      const w = iw * total, h = ih * total;
      const x = (cwCss - w)/2 + view.offsetX;
      const y = (chCss - h)/2 + view.offsetY;

      // Vị trí điểm ảnh (px,py) trên ảnh sau khi vẽ
      // px = (cx - x) / total ; py = (cy - y) / total  (về toạ độ ảnh gốc)
      const px = (cx - x) / total;
      const py = (cy - y) / total;

      // Khi vẽ phóng đại: w2 = iw*total*zoom; x2 sao cho px nằm ở cx
      const total2 = total * zoom;
      const w2 = iw * total2, h2 = ih * total2;
      const x2 = cx - px * total2;
      const y2 = cy - py * total2;

      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.save();

      // Clip vùng lúp
      if (loupe.shape !== 'square') {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(cx - half, cy - half, size, size);
        ctx.clip();
      }

      // Vẽ lại ảnh phóng đại
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, x2, y2, w2, h2);

      // Viền lúp
      ctx.restore();
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      if (loupe.shape !== 'square') {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(cx - half, cy - half, size, size);
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
  }, [path, dataURL, view.scale, view.offsetX, view.offsetY,
      grid.on, grid.size, grid.opacity,
      loupe.on, loupe.size, loupe.zoom, pointer.u, pointer.v,
      // onImageMeta,
      // draw
  ]);
  return canvasRef;
}