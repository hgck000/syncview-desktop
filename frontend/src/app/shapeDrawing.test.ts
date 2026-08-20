import { describe, expect, it, vi } from "vitest";
import type { ShapeAnnotation } from "./store";
import { drawShapeOutline, getShapeEndpoints } from "./shapeDrawing";

function mockContext() {
  const fill = vi.fn();
  const stroke = vi.fn();
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    fill,
    stroke,
    globalCompositeOperation: "source-over",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
  } as unknown as CanvasRenderingContext2D;
  return { context, fill, stroke };
}

const baseShape: ShapeAnnotation = {
  id: 1,
  kind: "rectangle",
  color: "#ffffff",
  strokeWidthImgPx: 8,
  u: 0.1,
  v: 0.2,
  w: 0.3,
  h: 0.4,
  flipX: false,
  flipY: false,
};

describe("shape drawing", () => {
  it("keeps line direction when a shape is dragged backwards", () => {
    expect(
      getShapeEndpoints(
        { flipX: true, flipY: false },
        { x: 10, y: 20, width: 30, height: 40 },
      ),
    ).toEqual({ x1: 40, y1: 20, x2: 10, y2: 60 });
  });

  it("strokes every supported shape without filling its interior", () => {
    for (const kind of [
      "rectangle",
      "circle",
      "triangle",
      "line",
      "arrow",
    ] as const) {
      const { context, fill, stroke } = mockContext();
      drawShapeOutline(
        context,
        { ...baseShape, kind },
        { x: 10, y: 20, width: 100, height: 80 },
        6,
      );
      expect(stroke).toHaveBeenCalledOnce();
      expect(fill).not.toHaveBeenCalled();
    }
  });
});
