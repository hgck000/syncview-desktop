import { useEffect, useRef } from "react";
import { useApp, type PaneId, type Stroke } from "./store";
import { useCallback } from "react";

type Pointer = { u: number; v: number };
type LoupeOpt = {
  on: boolean;
  size: number;
  zoom: number;
  shape?: "circle" | "square";
};
type View = {
  scale: number;
  offsetX: number;
  offsetY: number;
  imgW?: number;
  imgH?: number;
};
type Annotate = {
  mode: "none" | "draw" | "erase";
  color: string;
  size: number;
  eraserSize: number;
};

export function useAnnotCanvas(opts: {
  paneId: PaneId;
  view: View;
  loupe: LoupeOpt;
  pointer: Pointer;
  uiActive?: boolean;
  exporting?: boolean;
}) {
  const {
    paneId,
    view,
    loupe,
    pointer,
    uiActive = true,
    exporting = false,
  } = opts;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const annotateRef = useRef<Annotate>(
    useApp.getState().getActiveSafe().annotate
  );
  const uiActiveRef = useRef(uiActive);
  const exportingRef = useRef(exporting);

  useEffect(() => {
    uiActiveRef.current = uiActive;
  }, [uiActive]);

  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);

  const drawStrokes = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cwCss: number,
      chCss: number,
      strokes: Stroke[]
    ) => {
      const iw = view.imgW ?? 0;
      const ih = view.imgH ?? 0;
      if (!iw || !ih) return;

      // y hệt useImageCanvas: fit + total + x/y/w/h
      const fit = Math.min(cwCss / iw, chCss / ih);
      const total = fit * view.scale;
      const w = iw * total,
        h = ih * total;
      const x = (cwCss - w) / 2 + view.offsetX;
      const y = (chCss - h) / 2 + view.offsetY;

      // clip trong vùng ảnh để nét không “bay” ra ngoài
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (const s of strokes) {
        if (!s.pts.length) continue;
        ctx.save();
        ctx.globalCompositeOperation =
          s.mode === "erase" ? "destination-out" : "source-over";
        ctx.strokeStyle = s.mode === "erase" ? "rgba(0,0,0,1)" : s.color;
        ctx.lineWidth = s.size * view.scale;

        ctx.beginPath();
        const p0 = s.pts[0];
        ctx.moveTo(x + p0.u * w, y + p0.v * h);
        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i];
          ctx.lineTo(x + p.u * w, y + p.v * h);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    },
    [view.imgW, view.imgH, view.scale, view.offsetX, view.offsetY]
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const annotate = annotateRef.current;

    const rect = canvas.getBoundingClientRect();
    const cwCss = Math.max(1, rect.width);
    const chCss = Math.max(1, rect.height);

    const dpr = window.devicePixelRatio || 1;
    const wPx = Math.max(1, Math.floor(cwCss * dpr));
    const hPx = Math.max(1, Math.floor(chCss * dpr));
    if (canvas.width !== wPx || canvas.height !== hPx) {
      canvas.width = wPx;
      canvas.height = hPx;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cwCss, chCss);

    const strokes = useApp.getState().getActiveSafe().strokes[paneId] ?? [];
    drawStrokes(ctx, cwCss, chCss, strokes);

    // Loupe: clear vùng loupe rồi vẽ lại strokes với transform “phóng quanh tâm”
    if (!exporting && loupe.on && loupe.zoom > 1) {
      const cx = pointer.u * cwCss;
      const cy = pointer.v * chCss;
      const size = loupe.size;
      const half = size / 2;

      ctx.save();
      ctx.beginPath();
      if ((loupe.shape ?? "circle") === "square")
        ctx.rect(cx - half, cy - half, size, size);
      else ctx.arc(cx, cy, half, 0, Math.PI * 2);
      ctx.clip();

      ctx.clearRect(cx - half - 2, cy - half - 2, size + 4, size + 4);

      ctx.translate(cx, cy);
      ctx.scale(loupe.zoom, loupe.zoom);
      ctx.translate(-cx, -cy);

      drawStrokes(ctx, cwCss, chCss, strokes);

      ctx.restore();
    }
    // ==== Cursor preview (dot) ====
    // Vẽ SAU CÙNG để loupe không “xoá” nó
    if (!exporting && uiActive && annotate.mode === "draw") {
      const cx = pointer.u * cwCss;
      const cy = pointer.v * chCss;

      const r = Math.max(1, (annotate.size * view.scale) / 2);

      ctx.save();
      ctx.globalAlpha = 0.95;

      // viền trắng mỏng để nhìn rõ trên nền tối/ảnh sáng
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.fillStyle = annotate.color;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    if (!exporting && uiActive && annotate.mode === "erase") {
      const cx = pointer.u * cwCss;
      const cy = pointer.v * chCss;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(cx, cy, (annotate.eraserSize * view.scale) / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    paneId,
    loupe.on,
    loupe.zoom,
    loupe.size,
    loupe.shape,
    pointer.u,
    pointer.v,
    drawStrokes,
    view.scale,
    uiActive,
    exporting,
  ]);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      draw();
    });
  }, [draw]);

  // redraw khi view/loupe/pointer/tool đổi
  useEffect(() => {
    schedule();
  }, [
    schedule,
    paneId,
    view.scale,
    view.offsetX,
    view.offsetY,
    view.imgW,
    view.imgH,
    loupe.on,
    loupe.size,
    loupe.zoom,
    loupe.shape,
    pointer.u,
    pointer.v,
    // exporting,
  ]);

  // subscribe annotate riêng → đổi color/size chỉ redraw pane đang hover (uiActive)
  useEffect(() => {
    const unsub = useApp.subscribe(
      (s) => s.getActiveSafe().annotate,
      (a) => {
        annotateRef.current = a;
        if (uiActiveRef.current && !exportingRef.current) schedule();
      }
    );
    return () => {
      unsub();
    };
  }, [schedule]);

  // subscribe strokes riêng → không rerender React, chỉ schedule canvas draw
  useEffect(() => {
    const unsub = useApp.subscribe(
      (s) => s.getActiveSafe().strokes[paneId],
      () => schedule()
    );
    return () => {
      unsub();
    };
  }, [paneId, schedule]);

  // resize observer
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => schedule());
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  return canvasRef;
}
