import { useEffect, useMemo, useRef, useState } from "react";
import { CircleX } from "lucide-react";
import {
  useApp,
  type PaneId,
  type ShapeAnnotation,
  type ShapeKind,
} from "../app/store";
import { cursorClear, cursorSet } from "../app/cursorManager";
import { constrainShapeEnd } from "../app/shapeDrawing";

type View = {
  scale: number;
  offsetX: number;
  offsetY: number;
  imgW?: number;
  imgH?: number;
};

type ImgRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type ShapeRect = Pick<
  ShapeAnnotation,
  "u" | "v" | "w" | "h" | "flipX" | "flipY"
>;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function computeImgRect(view: View, cw: number, ch: number): ImgRect | null {
  const iw = view.imgW ?? 0;
  const ih = view.imgH ?? 0;
  if (!iw || !ih) return null;
  const total = Math.min(cw / iw, ch / ih) * view.scale;
  const w = iw * total;
  const h = ih * total;
  return {
    x: (cw - w) / 2 + view.offsetX,
    y: (ch - h) / 2 + view.offsetY,
    w,
    h,
  };
}

function clientToUv(
  clientX: number,
  clientY: number,
  host: HTMLElement,
  img: ImgRect,
  requireInside = false,
) {
  const hostRect = host.getBoundingClientRect();
  const x = clientX - hostRect.left - img.x;
  const y = clientY - hostRect.top - img.y;
  if (requireInside && (x < 0 || y < 0 || x > img.w || y > img.h)) {
    return null;
  }
  return {
    u: clamp(x / img.w, 0, 1),
    v: clamp(y / img.h, 0, 1),
  };
}

function rectFromPoints(
  start: { u: number; v: number },
  end: { u: number; v: number },
): ShapeRect {
  return {
    u: Math.min(start.u, end.u),
    v: Math.min(start.v, end.v),
    w: Math.abs(end.u - start.u),
    h: Math.abs(end.v - start.v),
    flipX: end.u < start.u,
    flipY: end.v < start.v,
  };
}

function shapeToCss(img: ImgRect, shape: ShapeAnnotation) {
  return {
    left: img.x + shape.u * img.w,
    top: img.y + shape.v * img.h,
    width: shape.w * img.w,
    height: shape.h * img.h,
  };
}

function ShapeHitbox({
  shape,
  css,
  selected,
  onSelect,
  onMove,
  onResize,
  onDelete,
}: {
  shape: ShapeAnnotation;
  css: { left: number; top: number; width: number; height: number };
  selected: boolean;
  onSelect: () => void;
  onMove: (event: React.MouseEvent) => void;
  onResize: (event: React.MouseEvent) => void;
  onDelete: () => void;
}) {
  const minHitSize = 14;
  const padX = Math.max(0, (minHitSize - css.width) / 2);
  const padY = Math.max(0, (minHitSize - css.height) / 2);

  return (
    <div
      data-shape-id={shape.id}
      className="absolute bg-transparent"
      style={{
        left: css.left - padX,
        top: css.top - padY,
        width: Math.max(minHitSize, css.width),
        height: Math.max(minHitSize, css.height),
        outline: selected
          ? "1px dashed rgba(255,255,255,0.65)"
          : "none",
        cursor: selected ? "move" : "pointer",
      }}
      onMouseDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onSelect();
        onMove(event);
      }}
    >
      {selected && (
        <>
          <CircleX
            role="button"
            tabIndex={0}
            aria-label="Delete shape"
            title="Delete shape"
            className="absolute -right-2 -top-2 z-10 block w-4 h-4 cursor-pointer text-neutral-400 transition-[color,filter,transform] hover:text-white hover:drop-shadow-[0_0_2px_rgba(255,255,255,0.45)] active:scale-90"
            strokeWidth={2.2}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
          />
          <div
            className="absolute -right-1 -bottom-1 w-3 h-3 rounded-sm border border-white/70 bg-black/40"
            style={{ cursor: "se-resize" }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onResize(event);
            }}
          />
        </>
      )}
    </div>
  );
}

export default function ShapeLayer({
  paneId,
  view,
}: {
  paneId: PaneId;
  view: View;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [hostSize, setHostSize] = useState({ cw: 1, ch: 1 });
  const [spaceDown, setSpaceDown] = useState(false);

  const tab = useApp((state) => state.getActiveSafe());
  const shapeTool = tab.shapeTool;
  const shapes = tab.shapes[paneId] ?? [];
  const selectedId = tab.shapeUI.selected[paneId];
  const exporting = useApp((state) => state.exporting);

  const createShape = useApp((state) => state.createShape);
  const setShapeRect = useApp((state) => state.setShapeRect);
  const selectShape = useApp((state) => state.selectShape);
  const clearShapeUI = useApp((state) => state.clearShapeUI);
  const deleteShape = useApp((state) => state.deleteShape);

  const paneSize = tab.paneSize?.[paneId];
  const cw = Math.max(1, paneSize?.cw || hostSize.cw);
  const ch = Math.max(1, paneSize?.ch || hostSize.ch);
  const imgRect = useMemo(
    () => computeImgRect(view, cw, ch),
    [view, cw, ch],
  );
  const targets = useMemo<PaneId[]>(
    () =>
      tab.linkAll && tab.panes.length
        ? (tab.panes as PaneId[])
        : [paneId],
    [tab.linkAll, tab.panes, paneId],
  );
  const canInteract = shapeTool.on && !exporting;

  const drawingRef = useRef<null | {
    id: number;
    start: { u: number; v: number };
    kind: ShapeKind;
  }>(null);
  const dragRef = useRef<null | {
    kind: "move" | "resize";
    id: number;
    startX: number;
    startY: number;
    start: ShapeRect;
  }>(null);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setHostSize({
        cw: Math.max(1, rect.width),
        ch: Math.max(1, rect.height),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;
      const element = event.target as HTMLElement | null;
      if (
        element?.tagName === "INPUT" ||
        element?.tagName === "TEXTAREA" ||
        element?.isContentEditable
      ) {
        return;
      }
      event.preventDefault();
      setSpaceDown(true);
      cursorSet("shape-pan", "grab", 10);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      setSpaceDown(false);
      cursorClear("shape-pan");
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      cursorClear("shape-pan");
    };
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const host = hostRef.current;
      if (!host || !imgRect) return;

      const drawing = drawingRef.current;
      if (drawing) {
        const rawEnd = clientToUv(
          event.clientX,
          event.clientY,
          host,
          imgRect,
        );
        if (!rawEnd) return;
        const end = constrainShapeEnd(
          drawing.start,
          rawEnd,
          drawing.kind,
          imgRect.w,
          imgRect.h,
          event.shiftKey,
        );
        setShapeRect(
          targets,
          drawing.id,
          rectFromPoints(drawing.start, end),
        );
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const du = (event.clientX - drag.startX) / imgRect.w;
      const dv = (event.clientY - drag.startY) / imgRect.h;

      if (drag.kind === "move") {
        setShapeRect(targets, drag.id, {
          u: clamp(drag.start.u + du, 0, 1 - drag.start.w),
          v: clamp(drag.start.v + dv, 0, 1 - drag.start.h),
        });
        return;
      }

      let w = clamp(drag.start.w + du, 0, 1 - drag.start.u);
      let h = clamp(drag.start.h + dv, 0, 1 - drag.start.v);
      if (event.shiftKey) {
        const side = Math.min(
          Math.max(w * imgRect.w, h * imgRect.h),
          (1 - drag.start.u) * imgRect.w,
          (1 - drag.start.v) * imgRect.h,
        );
        w = side / imgRect.w;
        h = side / imgRect.h;
      }
      setShapeRect(targets, drag.id, { w, h });
    };

    const onUp = () => {
      const drawing = drawingRef.current;
      if (drawing && imgRect) {
        const current = useApp
          .getState()
          .getActiveSafe()
          .shapes[paneId]?.find((shape) => shape.id === drawing.id);
        if (current) {
          const widthPx = current.w * imgRect.w;
          const heightPx = current.h * imgRect.h;
          const tooSmall =
            current.kind === "line" || current.kind === "arrow"
              ? Math.hypot(widthPx, heightPx) < 6
              : widthPx < 6 || heightPx < 6;
          if (tooSmall) deleteShape(targets, current.id);
        }
      }
      drawingRef.current = null;
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [imgRect, paneId, setShapeRect, deleteShape, targets]);

  const onHostMouseDown = (event: React.MouseEvent) => {
    if (!canInteract || spaceDown || event.button !== 0) return;
    const host = hostRef.current;
    if (!host || !imgRect) return;
    const start = clientToUv(
      event.clientX,
      event.clientY,
      host,
      imgRect,
      true,
    );
    if (!start) {
      if (tab.linkAll) clearShapeUI();
      else clearShapeUI(paneId);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (tab.linkAll) clearShapeUI();
    else clearShapeUI(paneId);

    const id = createShape(targets, paneId, {
      u: start.u,
      v: start.v,
      w: 0,
      h: 0,
      flipX: false,
      flipY: false,
      kind: shapeTool.kind,
      color: shapeTool.color,
      strokeWidthImgPx: shapeTool.strokeWidthImgPx,
      strokeStyle: shapeTool.strokeStyle,
    });
    drawingRef.current = { id, start, kind: shapeTool.kind };
    selectShape(paneId, id);
  };

  return (
    <div
      ref={hostRef}
      data-role="shape-layer"
      className="absolute inset-0"
      style={{
        pointerEvents: canInteract && !spaceDown ? "auto" : "none",
        cursor: "crosshair",
      }}
      onMouseDown={onHostMouseDown}
    >
      {imgRect &&
        shapes.map((shape) => {
          const css = shapeToCss(imgRect, shape);
          const selected = selectedId === shape.id;
          return (
            <ShapeHitbox
              key={shape.id}
              shape={shape}
              css={css}
              selected={selected}
              onSelect={() => selectShape(paneId, shape.id)}
              onMove={(event) => {
                dragRef.current = {
                  kind: "move",
                  id: shape.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  start: {
                    u: shape.u,
                    v: shape.v,
                    w: shape.w,
                    h: shape.h,
                    flipX: shape.flipX,
                    flipY: shape.flipY,
                  },
                };
              }}
              onResize={(event) => {
                dragRef.current = {
                  kind: "resize",
                  id: shape.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  start: {
                    u: shape.u,
                    v: shape.v,
                    w: shape.w,
                    h: shape.h,
                    flipX: shape.flipX,
                    flipY: shape.flipY,
                  },
                };
              }}
              onDelete={() => deleteShape(targets, shape.id)}
            />
          );
        })}
    </div>
  );
}
