import { useEffect, useRef } from "react";
import { readImageDataURL } from "./bridge";

type Opts = {
  path?: string;
  dataURL?: string;
  view: { scale: number; offsetX: number; offsetY: number };
  onImageMeta?: (w: number, h: number) => void;
};

export function useImageCanvas(opts: Opts) {
  const { path, dataURL, view, onImageMeta } = opts;
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
    // LOG
    // console.log("[canvas] draw", {fit, scale:view.scale, total, w, h, x, y});
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
  }, [path, dataURL, view.scale, view.offsetX, view.offsetY]);

  return canvasRef;
}