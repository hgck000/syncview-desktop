/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { readImageSource } from "./bridge";
import { loadHtmlImage } from "./imageLoader";

type GridOpt = { on: boolean; size: number; opacity: number };
type LoupeOpt = {
  on: boolean;
  size: number;
  zoom: number;
  shape?: "circle" | "square";
};
type Pointer = { u: number; v: number };

type Opts = {
  path?: string;
  dataURL?: string;
  view: { scale: number; offsetX: number; offsetY: number };
  grid: GridOpt;
  loupe: LoupeOpt;
  pointer: Pointer;
  uiActive?: boolean;
  suspended?: boolean;
  onImageMeta?: (w: number, h: number) => void;
  onViewCompensate?: (v: {
    scale: number;
    offsetX: number;
    offsetY: number;
  }) => void;
  exporting?: boolean;
};

export function useImageCanvas(opts: Opts) {
  const {
    path,
    dataURL,
    view,
    onImageMeta,
    onViewCompensate,
    grid,
    loupe,
    pointer,
    uiActive = true,
    suspended = false,
    exporting,
  } = opts;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const effectiveViewRef = useRef(view);
  const lastSizeRef = useRef<{ cw: number; ch: number }>({ cw: 0, ch: 0 });
  const pendingStoreViewRef = useRef<null | {
    scale: number;
    offsetX: number;
    offsetY: number;
  }>(null);
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;

  function drawNow() {
    if (suspendedRef.current) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const dpr = window.devicePixelRatio || 1;
    const cwCss = canvas.clientWidth;
    const chCss = canvas.clientHeight;
    if (cwCss <= 0 || chCss <= 0) return;
    if (lastSizeRef.current.cw === 0 || lastSizeRef.current.ch === 0) {
      lastSizeRef.current = { cw: cwCss, ch: chCss };
    }

    canvas.width = Math.max(1, Math.floor(cwCss * dpr));
    canvas.height = Math.max(1, Math.floor(chCss * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const fit = Math.min(cwCss / iw, chCss / ih);
    const eff = effectiveViewRef.current;
    const total = fit * eff.scale;

    // const total = fit * view.scale;

    const w = iw * total;
    const h = ih * total;
    const x = (cwCss - w) / 2 + eff.offsetX;
    const y = (chCss - h) / 2 + eff.offsetY;

    ctx.clearRect(0, 0, cwCss, chCss);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, x, y, w, h);

    // === GRID ===
    if (grid.on && grid.size > 0) {
      const step = Math.max(4, grid.size);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, grid.opacity));
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1;

      for (let gx = 0; gx <= cwCss + 0.5; gx += step) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, chCss);
        ctx.stroke();
      }
      for (let gy = 0; gy <= chCss + 0.5; gy += step) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(0 + cwCss, gy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // === LOUPE ===
    if (!exporting && loupe.on) {
      const cx = pointer.u * cwCss;
      const cy = pointer.v * chCss;
      const size = loupe.size;
      const half = size / 2;
      const zoom = loupe.zoom ?? 2;

      const total2 = total * zoom;
      const w2 = iw * total2;
      const h2 = ih * total2;
      const px = (cx - x) / total;
      const py = (cy - y) / total;
      const x2 = cx - px * total2;
      const y2 = cy - py * total2;

      ctx.save();
      if (loupe.shape !== "square") {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.clip();
      } else {
        ctx.beginPath();
        ctx.rect(cx - half, cy - half, size, size);
        ctx.clip();
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, x2, y2, w2, h2);

      ctx.restore();
      ctx.save();

      // viền “2 lớp” để luôn nổi trên nền sáng/tối
      const innerW = Math.max(2, Math.round(size / 90)); // size lớn thì viền dày hơn chút
      const outerW = innerW + 2;

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Lớp ngoài: tối
      ctx.lineWidth = outerW;
      ctx.strokeStyle = "rgba(0,0,0,0.65)";
      if (loupe.shape !== "square") {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(cx - half, cy - half, size, size);
      }

      // Lớp trong: sáng
      ctx.lineWidth = innerW;
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      if (loupe.shape !== "square") {
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeRect(cx - half, cy - half, size, size);
      }

      ctx.restore();
    }
  }

  function scheduleDraw() {
    if (suspendedRef.current) return;
    if (!canvasRef.current || !imgRef.current) return;
    if (rafRef.current != null) return; // đã có 1 frame đang chờ
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const pending = pendingStoreViewRef.current;
      if (pending && onViewCompensate) {
        pendingStoreViewRef.current = null;
        onViewCompensate(pending);
      }

      drawNow();
    });
  }

  useEffect(() => {
    let cancelled = false;
    let releaseImage = () => undefined;
    const canvas = canvasRef.current;
    if (!canvas || (!path && !dataURL)) return;

    const load = async () => {
      let url = dataURL;
      if (!url && path) url = (await readImageSource(path)) ?? undefined;
      if (cancelled || !url) return;

      try {
        const loaded = await loadHtmlImage(url);
        if (cancelled) {
          loaded.release();
          return;
        }

        releaseImage = loaded.release;
        imgRef.current = loaded.image;
        onImageMeta?.(loaded.image.naturalWidth, loaded.image.naturalHeight);
        scheduleDraw();
      } catch (error) {
        console.warn("[canvas] load fail", error);
      }
    };

    load();

    const ro = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas) return;

      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (suspendedRef.current) {
        if (cw > 0 && ch > 0) lastSizeRef.current = { cw, ch };
        return;
      }
      const prev = lastSizeRef.current;

      if (cw > 0 && ch > 0 && prev.cw > 0 && prev.ch > 0 && img) {
        // chỉ bù khi user đã pan/zoom (không phải default fit)
        const base = effectiveViewRef.current;
        const isDefault =
          Math.abs(base.scale - 1) < 1e-3 &&
          Math.abs(base.offsetX) < 0.5 &&
          Math.abs(base.offsetY) < 0.5;

        if (!isDefault) {
          const iw = img.naturalWidth || 1;
          const ih = img.naturalHeight || 1;

          const fit1 = Math.min(prev.cw / iw, prev.ch / ih);
          const fit2 = Math.min(cw / iw, ch / ih);

          if (fit1 > 0 && fit2 > 0 && isFinite(fit1) && isFinite(fit2)) {
            const clamp = (n: number, a: number, b: number) =>
              Math.max(a, Math.min(b, n));

            // giữ tổng zoom thực tế (fit*scale) gần như không đổi
            const scale2 = clamp(base.scale * (fit1 / fit2), 0.8, 10);
            const total1 = fit1 * base.scale;
            const total2 = fit2 * scale2;

            // anchor ở giữa viewport để ổn định khi mouse đang ở sidebar
            const u = 0.5;
            const v = 0.5;

            const ax1 = u * prev.cw;
            const ay1 = v * prev.ch;

            const x1 = (prev.cw - iw * total1) / 2 + base.offsetX;
            const y1 = (prev.ch - ih * total1) / 2 + base.offsetY;

            const ix = (ax1 - x1) / total1;
            const iy = (ay1 - y1) / total1;

            const ax2 = u * cw;
            const ay2 = v * ch;

            const offsetX2 = ax2 - ix * total2 - (cw - iw * total2) / 2;
            const offsetY2 = ay2 - iy * total2 - (ch - ih * total2) / 2;

            const next = {
              scale: scale2,
              offsetX: offsetX2,
              offsetY: offsetY2,
            };

            // vẽ ngay bằng view đã bù (tránh 1 frame nhảy)
            effectiveViewRef.current = next;

            // đẩy vào store ngay trước draw trong scheduleDraw()
            pendingStoreViewRef.current = next;
          }
        }
      }

      if (cw > 0 && ch > 0) lastSizeRef.current = { cw, ch };
      scheduleDraw();
    });

    if (canvasRef.current) ro.observe(canvasRef.current);

    return () => {
      cancelled = true;
      releaseImage();
      imgRef.current = null;
      ro.disconnect();
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [path, dataURL]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (suspended) {
      pendingStoreViewRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (canvas && (canvas.width !== 1 || canvas.height !== 1)) {
        canvas.width = 1;
        canvas.height = 1;
      }
      return;
    }

    scheduleDraw();
  }, [suspended]);

  useEffect(() => {
    effectiveViewRef.current = view;
    if (!canvasRef.current || !imgRef.current) return;
    scheduleDraw();
  }, [
    view.scale,
    view.offsetX,
    view.offsetY,
    grid.on,
    grid.size,
    grid.opacity,
    loupe.on,
    loupe.size,
    loupe.zoom,
    pointer.u,
    pointer.v,
    uiActive,
    exporting,
  ]);
  return canvasRef;
}
