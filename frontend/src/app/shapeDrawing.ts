import type { ShapeAnnotation } from "./store";

export type ShapeBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getShapeEndpoints(
  shape: Pick<ShapeAnnotation, "flipX" | "flipY">,
  bounds: ShapeBounds,
) {
  const x1 = shape.flipX ? bounds.x + bounds.width : bounds.x;
  const y1 = shape.flipY ? bounds.y + bounds.height : bounds.y;
  const x2 = shape.flipX ? bounds.x : bounds.x + bounds.width;
  const y2 = shape.flipY ? bounds.y : bounds.y + bounds.height;
  return { x1, y1, x2, y2 };
}

export function drawShapeOutline(
  ctx: CanvasRenderingContext2D,
  shape: ShapeAnnotation,
  bounds: ShapeBounds,
  lineWidth: number,
) {
  const { x, y, width, height } = bounds;
  const safeLineWidth = Math.max(0.75, lineWidth);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = safeLineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  switch (shape.kind) {
    case "rectangle":
      ctx.rect(x, y, width, height);
      break;

    case "circle":
      ctx.ellipse(
        x + width / 2,
        y + height / 2,
        Math.max(0, width / 2),
        Math.max(0, height / 2),
        0,
        0,
        Math.PI * 2,
      );
      break;

    case "triangle":
      ctx.moveTo(x + width / 2, y);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      ctx.closePath();
      break;

    case "line":
    case "arrow": {
      const { x1, y1, x2, y2 } = getShapeEndpoints(shape, bounds);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (shape.kind === "arrow") {
        const length = Math.hypot(x2 - x1, y2 - y1);
        if (length > 0.5) {
          const angle = Math.atan2(y2 - y1, x2 - x1);
          const headLength = Math.min(
            Math.max(8, safeLineWidth * 4),
            length * 0.4,
          );
          const spread = Math.PI / 7;
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLength * Math.cos(angle - spread),
            y2 - headLength * Math.sin(angle - spread),
          );
          ctx.moveTo(x2, y2);
          ctx.lineTo(
            x2 - headLength * Math.cos(angle + spread),
            y2 - headLength * Math.sin(angle + spread),
          );
        }
      }
      break;
    }
  }

  // Shapes are outline-only notes: never fill their interior.
  ctx.stroke();
  ctx.restore();
}
