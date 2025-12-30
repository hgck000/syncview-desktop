import { useEffect, useRef } from "react";
import {
  useApp,
  type PaneId,
  type Stroke,
  type TextBox,
  type TextStyle,
} from "./store";
import { useCallback } from "react";
import { strokeUVToImgPx } from "./annotCoords";

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

function buildFont(style: TextStyle, fontPx: number) {
  const weight = style.bold ? "700" : "400";
  const italic = style.italic ? "italic " : "";
  // ví dụ: "italic 700 24px Arial"
  return `${italic}${weight} ${Math.max(6, Math.round(fontPx))}px ${
    style.fontFamily
  }`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const paragraphs = String(text ?? "").split("\n");
  const lines: string[] = [];

  const breakLongWord = (word: string) => {
    // cắt word thành nhiều đoạn sao cho mỗi đoạn <= maxWidth
    let s = word;
    while (s.length > 0) {
      let cut = 1;

      // tăng cut đến khi vượt width
      for (let i = 1; i <= s.length; i++) {
        const part = s.slice(0, i);
        if (ctx.measureText(part).width <= maxWidth) cut = i;
        else break;
      }

      // an toàn: nếu maxWidth quá nhỏ, vẫn cắt 1 ký tự để tránh vòng lặp vô hạn
      cut = Math.max(1, cut);

      lines.push(s.slice(0, cut));
      s = s.slice(cut);
    }
  };

  for (const para of paragraphs) {
    // giữ nguyên khoảng trắng như DOM break-words/whitespace-pre-wrap?
    // đơn giản: wrap theo space, nhưng nếu 1 "word" quá dài thì break word.
    const words = para.split(/\s+/).filter((w) => w.length > 0);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";

    for (const word of words) {
      if (!line) {
        // nếu word dài hơn maxWidth -> break-word
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
        } else {
          breakLongWord(word);
          line = ""; // reset vì breakLongWord đã push line(s)
        }
        continue;
      }

      const test = `${line} ${word}`;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
      } else {
        // push line hiện tại
        lines.push(line);

        // bắt đầu line mới bằng word (hoặc break-word nếu quá dài)
        if (ctx.measureText(word).width <= maxWidth) {
          line = word;
        } else {
          breakLongWord(word);
          line = "";
        }
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function drawUnderline(
  ctx: CanvasRenderingContext2D,
  x: number,
  yBaseline: number,
  textWidth: number,
  thickness: number
) {
  const y = yBaseline + Math.max(1, thickness);
  ctx.save();
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + textWidth, y);
  ctx.stroke();
  ctx.restore();
}

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
        const p0img = strokeUVToImgPx(iw, ih, p0.u, p0.v);
        ctx.moveTo(x + (p0img.x / iw) * w, y + (p0img.y / ih) * h);

        for (let i = 1; i < s.pts.length; i++) {
          const p = s.pts[i];
          const pimg = strokeUVToImgPx(iw, ih, p.u, p.v);
          ctx.lineTo(x + (pimg.x / iw) * w, y + (pimg.y / ih) * h);
        }

        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();
    },
    [view.imgW, view.imgH, view.scale, view.offsetX, view.offsetY]
  );

  const drawTextBoxes = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      cwCss: number,
      chCss: number,
      boxes: TextBox[]
    ) => {
      const iw = view.imgW ?? 0;
      const ih = view.imgH ?? 0;
      if (!iw || !ih) return;
      if (!boxes || boxes.length === 0) return;

      // y hệt drawStrokes: fit + total + x/y/w/h
      const fit = Math.min(cwCss / iw, chCss / ih);
      const total = fit * view.scale;
      const w = iw * total;
      const h = ih * total;
      const x = (cwCss - w) / 2 + view.offsetX;
      const y = (chCss - h) / 2 + view.offsetY;

      // clip trong vùng ảnh (không vẽ chữ ra ngoài ảnh)
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();

      const t = useApp.getState().getActiveSafe();
      const ui = t.textUI;
      const exporting = useApp.getState().exporting;

      // chỉ suppress khi user đang thao tác text (không áp dụng lúc export)
      const suppress =
        !exporting && t.textTool.on
          ? new Set<number>([
              ...(ui.editing && ui.editing.pane === paneId
                ? [ui.editing.id]
                : []),
              ...(ui.selected[paneId] != null
                ? [ui.selected[paneId] as number]
                : []),
            ])
          : new Set<number>();

      for (const b of boxes) {
        if (suppress.has(b.id)) continue;
        const text = (b.text ?? "").trimEnd();
        if (!text.trim()) continue; // bỏ box rỗng (export không in gì)

        const left = x + b.u * w;
        const top = y + b.v * h;
        const bw = b.w * w;
        const bh = b.h * h;

        const style = b.style;
        const fontPx = style.fontSizeImgPx * total;

        ctx.save();
        ctx.font = buildFont(style, fontPx);
        ctx.fillStyle = style.color;
        ctx.textBaseline = "top";

        // padding trong box
        const pad = Math.max(2, Math.round(4 * total));
        const maxWidth = Math.max(1, bw - pad * 2);
        const maxHeight = Math.max(1, bh - pad * 2);

        // line height ~ 1.2
        const lineH = Math.max(6, fontPx * 1.2);
        const lines = wrapText(ctx, text, maxWidth);

        // render từng dòng, cắt nếu vượt chiều cao box
        let yy = top + pad;
        for (const line of lines) {
          if (yy + lineH > top + pad + maxHeight + 0.5) break;

          const xx = left + pad;
          ctx.fillText(line, xx, yy);

          // // underline
          if (style.underline && line.length > 0) {
            ctx.strokeStyle = style.color;
            const tw = ctx.measureText(line).width;
            const thickness = Math.max(1, Math.round(fontPx / 14));
            // baseline gần đáy line (vì textBaseline=top)
            drawUnderline(ctx, xx, yy + fontPx, tw, thickness);
          }

          yy += lineH;
        }

        ctx.restore();
      }

      ctx.restore();
    },
    [view.imgW, view.imgH, view.scale, view.offsetX, view.offsetY, paneId]
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

    const t = useApp.getState().getActiveSafe();

    const strokes = t.strokes[paneId] ?? [];
    drawStrokes(ctx, cwCss, chCss, strokes);

    const boxes = t.textBoxes[paneId] ?? [];
    drawTextBoxes(ctx, cwCss, chCss, boxes);

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
      drawTextBoxes(ctx, cwCss, chCss, boxes);

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
    drawTextBoxes,
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

  useEffect(() => {
    const unsub = useApp.subscribe(
      (s) => s.getActiveSafe().textBoxes[paneId],
      () => schedule()
    );
    return () => unsub();
  }, [paneId, schedule]);

  useEffect(() => {
    const unsub = useApp.subscribe(
      (s) => s.getActiveSafe().textUI.selected[paneId],
      () => schedule()
    );
    return () => unsub();
  }, [paneId, schedule]);

  useEffect(() => {
    const unsub = useApp.subscribe(
      (s) => s.getActiveSafe().textUI.editing,
      () => schedule()
    );
    return () => unsub();
  }, [schedule]);

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
