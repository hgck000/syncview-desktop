import { useEffect, useRef } from "react";
import { readImageDataURL } from "./bridge";

type Opts = { path?: string; dataURL?: string };


export function useImageCanvas(opts: Opts) {
  const { path, dataURL } = opts;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  function draw() {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    // set kích thước thực để tránh mờ và clear đen
    canvas.width = Math.max(1, Math.floor(cw * dpr));
    canvas.height = Math.max(1, Math.floor(ch * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1,0,0,1,0,0); // reset transform
    ctx.scale(dpr, dpr);

    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.min(cw / iw, ch / ih);
    const w = iw * scale, h = ih * scale;
    const x = (cw - w) / 2, y = (ch - h) / 2;

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, x, y, w, h);
    console.log("[canvas] draw", { src: img.src.substring(0,30)+"...", iw, ih, cw, ch, dpr, scale });
  }

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const canvas = canvasRef.current;
      if (!canvas || (!path && !dataURL)) return;

      let url = dataURL;
      if (!url && path) {
        url = await readImageDataURL(path);  // lấy DataURL từ BE
      }
      if (cancelled || !url) return;

      const img = new Image();
      img.onload = () => { imgRef.current = img; draw(); };
      img.onerror = (e) => console.warn("[canvas] load fail", e);
      img.src = url;
    };
    load();

    const ro = new ResizeObserver(() => draw());
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => { cancelled = true; ro.disconnect(); };
    // re-run khi đổi path hoặc dataURL
  }, [path, dataURL]);

  return canvasRef;
}
