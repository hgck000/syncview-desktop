import { readImageDataURL } from "./bridge";
import { strokeUVToImgPx } from "./annotCoords";
import type { PaneId, Stroke, TextBox, TextStyle, View } from "./store";

type ExportTab = {
  panes: PaneId[];
  layout: "auto" | "row1x4";
  files: Record<PaneId, string | undefined>;
  dataURL: Record<PaneId, string | undefined>;
  view: Record<PaneId, View>;
  grid: { on: boolean; size: number; opacity: number };
  strokes: Record<PaneId, Stroke[]>;
  textBoxes: Record<PaneId, TextBox[]>;
};

type PreparedPane = {
  id: PaneId;
  image: HTMLImageElement;
  widthCss: number;
  heightCss: number;
  imageXCss: number;
  imageYCss: number;
  imageWidthCss: number;
  imageHeightCss: number;
  visibleLeftCss: number;
  visibleTopCss: number;
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  exportScale: number;
  total: number;
  view: View;
};

type PlacedPane = PreparedPane & {
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
};

export type WorkspacePng = {
  dataUrl: string;
  width: number;
  height: number;
};

// Chromium/WebView2 commonly rejects a canvas beyond these limits. Failing
// explicitly is safer than silently shrinking an export and losing detail.
const MAX_CANVAS_DIMENSION = 32_767;
const MAX_CANVAS_AREA = 268_435_456;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể giải mã ảnh gốc."));
    image.src = url;
  });
}

async function loadPaneImage(
  path: string | undefined,
  dataURL: string | undefined,
): Promise<HTMLImageElement> {
  const source = dataURL ?? (path ? await readImageDataURL(path) : null);
  if (!source) {
    throw new Error(`Không thể đọc ảnh gốc${path ? `: ${path}` : "."}`);
  }
  return loadImage(source);
}

function buildFont(style: TextStyle, fontPx: number) {
  const weight = style.bold ? "700" : "400";
  const italic = style.italic ? "italic " : "";
  const family = style.fontFamily.includes(" ")
    ? `"${style.fontFamily}"`
    : style.fontFamily;
  return `${italic}${weight} ${Math.max(6, fontPx)}px ${family}`;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const paragraphs = String(text ?? "").split("\n");
  const lines: string[] = [];

  const breakLongWord = (word: string) => {
    let rest = word;
    while (rest.length > 0) {
      let cut = 1;
      for (let i = 1; i <= rest.length; i++) {
        if (ctx.measureText(rest.slice(0, i)).width <= maxWidth) cut = i;
        else break;
      }
      cut = Math.max(1, cut);
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  };

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      if (!line) {
        if (ctx.measureText(word).width <= maxWidth) line = word;
        else breakLongWord(word);
        continue;
      }

      const candidate = `${line} ${word}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line);
        line = "";
        if (ctx.measureText(word).width <= maxWidth) line = word;
        else breakLongWord(word);
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function drawStrokes(
  ctx: CanvasRenderingContext2D,
  pane: PreparedPane,
  strokes: Stroke[],
) {
  if (!strokes.length) return;

  const iw = pane.image.naturalWidth;
  const ih = pane.image.naturalHeight;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    pane.imageXCss,
    pane.imageYCss,
    pane.imageWidthCss,
    pane.imageHeightCss,
  );
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const stroke of strokes) {
    if (!stroke.pts.length) continue;

    ctx.save();
    ctx.globalCompositeOperation =
      stroke.mode === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.mode === "erase" ? "rgba(0,0,0,1)" : stroke.color;
    ctx.lineWidth = stroke.size * pane.view.scale;

    const first = strokeUVToImgPx(iw, ih, stroke.pts[0].u, stroke.pts[0].v);
    ctx.beginPath();
    ctx.moveTo(
      pane.imageXCss + first.x * pane.total,
      pane.imageYCss + first.y * pane.total,
    );

    for (let i = 1; i < stroke.pts.length; i++) {
      const point = strokeUVToImgPx(iw, ih, stroke.pts[i].u, stroke.pts[i].v);
      ctx.lineTo(
        pane.imageXCss + point.x * pane.total,
        pane.imageYCss + point.y * pane.total,
      );
    }
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function drawTextBoxes(
  ctx: CanvasRenderingContext2D,
  pane: PreparedPane,
  boxes: TextBox[],
) {
  if (!boxes.length) return;

  ctx.save();
  ctx.beginPath();
  ctx.rect(
    pane.imageXCss,
    pane.imageYCss,
    pane.imageWidthCss,
    pane.imageHeightCss,
  );
  ctx.clip();

  for (const box of boxes) {
    const text = (box.text ?? "").trimEnd();
    if (!text.trim()) continue;

    const left = pane.imageXCss + box.u * pane.imageWidthCss;
    const top = pane.imageYCss + box.v * pane.imageHeightCss;
    const boxWidth = box.w * pane.imageWidthCss;
    const fontPx = box.style.fontSizeImgPx * pane.total;
    const padding = Math.max(2, 4 * pane.total);
    const maxWidth = Math.max(1, boxWidth - padding * 2);
    const lineHeight = Math.max(6, fontPx * 1.2);

    ctx.save();
    ctx.font = buildFont(box.style, fontPx);
    ctx.fillStyle = box.style.color;
    ctx.textBaseline = "top";
    const lines = wrapText(ctx, text, maxWidth);

    let y = top + padding;
    for (const line of lines) {
      const x = left + padding;
      ctx.fillText(line, x, y);

      if (box.style.underline && line.length > 0) {
        const thickness = Math.max(1, fontPx / 14);
        const textWidth = ctx.measureText(line).width;
        ctx.save();
        ctx.strokeStyle = box.style.color;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(x, y + fontPx + thickness);
        ctx.lineTo(x + textWidth, y + fontPx + thickness);
        ctx.stroke();
        ctx.restore();
      }

      y += lineHeight;
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  widthCss: number,
  heightCss: number,
  grid: ExportTab["grid"],
) {
  if (!grid.on || grid.size <= 0) return;

  const step = Math.max(4, grid.size);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, grid.opacity));
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= widthCss + 0.5; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, heightCss);
    ctx.stroke();
  }
  for (let y = 0; y <= heightCss + 0.5; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(widthCss, y);
    ctx.stroke();
  }
  ctx.restore();
}

function canvasToPngDataURL(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(
          new Error(
            "Không thể mã hóa PNG. Ảnh ghép có thể vượt giới hạn bộ nhớ của máy.",
          ),
        );
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Không thể đọc dữ liệu PNG."));
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}

async function preparePane(
  tab: ExportTab,
  id: PaneId,
  gridElement: HTMLElement,
): Promise<PreparedPane | null> {
  const path = tab.files[id];
  const dataURL = tab.dataURL[id];
  if (!path && !dataURL) return null;

  const paneElement = gridElement.querySelector(
    `[data-role="pane-wrap"][data-pane="${id}"]`,
  ) as HTMLElement | null;
  const imageCanvas = paneElement?.querySelector(
    'canvas[data-role="pane-image"]',
  ) as HTMLCanvasElement | null;

  if (!imageCanvas) {
    throw new Error(`Không tìm thấy vùng hiển thị của pane ${id}.`);
  }

  const rect = imageCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error(`Pane ${id} không có kích thước hợp lệ.`);
  }

  const image = await loadPaneImage(path, dataURL);
  const iw = image.naturalWidth;
  const ih = image.naturalHeight;
  if (!iw || !ih) throw new Error(`Ảnh trong pane ${id} không hợp lệ.`);

  const view = tab.view[id];
  const fit = Math.min(rect.width / iw, rect.height / ih);
  const total = fit * view.scale;
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error(`Mức zoom của pane ${id} không hợp lệ.`);
  }

  const imageWidthCss = iw * total;
  const imageHeightCss = ih * total;
  const imageXCss = (rect.width - imageWidthCss) / 2 + view.offsetX;
  const imageYCss = (rect.height - imageHeightCss) / 2 + view.offsetY;

  // Intersection between the transformed photo and its viewport. Letterbox
  // space never reaches the export layout.
  const visibleLeftCss = Math.max(0, imageXCss);
  const visibleTopCss = Math.max(0, imageYCss);
  const visibleRightCss = Math.min(rect.width, imageXCss + imageWidthCss);
  const visibleBottomCss = Math.min(rect.height, imageYCss + imageHeightCss);
  const visibleWidthCss = visibleRightCss - visibleLeftCss;
  const visibleHeightCss = visibleBottomCss - visibleTopCss;

  if (visibleWidthCss <= 0 || visibleHeightCss <= 0) {
    throw new Error(`Ảnh trong pane ${id} đang nằm ngoài vùng nhìn thấy.`);
  }

  // Convert the visible area straight back to source-image pixels. Exporting
  // this crop at 1:1 preserves detail and completely removes pane geometry.
  const sourceX = Math.max(0, (visibleLeftCss - imageXCss) / total);
  const sourceY = Math.max(0, (visibleTopCss - imageYCss) / total);
  const sourceWidth = Math.min(iw - sourceX, visibleWidthCss / total);
  const sourceHeight = Math.min(ih - sourceY, visibleHeightCss / total);

  return {
    id,
    image,
    widthCss: rect.width,
    heightCss: rect.height,
    imageXCss,
    imageYCss,
    imageWidthCss,
    imageHeightCss,
    visibleLeftCss,
    visibleTopCss,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    exportScale: 1 / total,
    total,
    view,
  };
}

function placePanes(
  panes: PreparedPane[],
  tab: ExportTab,
  gridElement: HTMLElement,
) {
  const columnCount =
    panes.length === 4 && tab.layout !== "row1x4" ? 2 : panes.length;
  const rowCount = Math.ceil(panes.length / columnCount);

  const style = getComputedStyle(gridElement);
  const gapX = Math.max(1, Math.round(Number.parseFloat(style.columnGap) || 4));
  const gapY = Math.max(1, Math.round(Number.parseFloat(style.rowGap) || 4));

  const rows = Array.from({ length: rowCount }, (_, row) =>
    panes.slice(row * columnCount, (row + 1) * columnCount),
  ).filter((row) => row.length > 0);

  // Justified-photo layout: each row has a common height, while every image
  // keeps its own aspect ratio and the complete visible source crop. Choose a
  // target width large enough that no pane is downscaled; shorter rows/images
  // are only enlarged. This removes both outer padding and destructive crop.
  const targetWidth = Math.ceil(
    Math.max(
      ...rows.map((row) => {
        const nativeRowHeight = Math.max(
          ...row.map((pane) => pane.sourceHeight),
        );
        return (
          row.reduce(
            (sum, pane) =>
              sum + (pane.sourceWidth / pane.sourceHeight) * nativeRowHeight,
            0,
          ) +
          gapX * Math.max(0, row.length - 1)
        );
      }),
    ),
  );

  const placed: PlacedPane[] = [];
  let topPx = 0;

  for (const row of rows) {
    const rowGapWidth = gapX * Math.max(0, row.length - 1);
    const contentWidth = targetWidth - rowGapWidth;
    const aspectSum = row.reduce(
      (sum, pane) => sum + pane.sourceWidth / pane.sourceHeight,
      0,
    );
    const heightPx = contentWidth / aspectSum;
    let leftPx = 0;

    row.forEach((pane, index) => {
      // Give the last pane the exact remaining width. This absorbs floating
      // point noise without introducing an outer black strip.
      const widthPx =
        index === row.length - 1
          ? targetWidth - leftPx
          : (pane.sourceWidth / pane.sourceHeight) * heightPx;

      placed.push({
        ...pane,
        leftPx,
        topPx,
        widthPx,
        heightPx,
      });
      leftPx += widthPx + gapX;
    });

    topPx += heightPx + gapY;
  }

  const rawHeight = topPx - gapY;
  const height = Math.max(1, Math.round(rawHeight));
  const lastRowTop = placed.at(-1)?.topPx;

  // Canvas dimensions must be integers. Share the sub-pixel rounding (at most
  // half a pixel) across the final row so it reaches the edge exactly instead
  // of leaving a one-pixel black border or clipping the source.
  if (lastRowTop !== undefined) {
    const heightAdjustment = height - rawHeight;
    for (const pane of placed) {
      if (pane.topPx === lastRowTop) pane.heightPx += heightAdjustment;
    }
  }

  return { panes: placed, width: targetWidth, height };
}

export async function renderWorkspacePng(
  tab: ExportTab,
  gridElement: HTMLElement,
): Promise<WorkspacePng> {
  const gridRect = gridElement.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) {
    throw new Error("Workspace không có kích thước hợp lệ.");
  }

  const prepared = await Promise.all(
    tab.panes.map((id) => preparePane(tab, id, gridElement)),
  );
  const panes = prepared.filter((pane): pane is PreparedPane => !!pane);
  if (!panes.length) throw new Error("Workspace không có ảnh để export.");

  // Pack source crops, not panes. The justified layout contains only complete
  // visible photos plus the same small gap used by the workspace grid.
  const justifiedLayout = placePanes(panes, tab, gridElement);
  const width = Math.max(1, justifiedLayout.width);
  const height = Math.max(1, justifiedLayout.height);

  if (
    width > MAX_CANVAS_DIMENSION ||
    height > MAX_CANVAS_DIMENSION ||
    width * height > MAX_CANVAS_AREA
  ) {
    throw new Error(
      `Ảnh ghép ${width}×${height}px vượt giới hạn PNG an toàn của WebView. ` +
        "Hãy zoom gần hơn hoặc export ít ảnh hơn; ứng dụng sẽ không tự giảm chất lượng.",
    );
  }

  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) throw new Error("Không thể tạo canvas export.");

  outputCtx.fillStyle = "#0a0a0a";
  outputCtx.fillRect(0, 0, width, height);
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = "high";

  for (const pane of justifiedLayout.panes) {
    outputCtx.drawImage(
      pane.image,
      pane.sourceX,
      pane.sourceY,
      pane.sourceWidth,
      pane.sourceHeight,
      pane.leftPx,
      pane.topPx,
      pane.widthPx,
      pane.heightPx,
    );

    outputCtx.save();
    outputCtx.beginPath();
    outputCtx.rect(pane.leftPx, pane.topPx, pane.widthPx, pane.heightPx);
    outputCtx.clip();
    outputCtx.translate(pane.leftPx, pane.topPx);
    const destinationScaleX = pane.widthPx / pane.sourceWidth;
    const destinationScaleY = pane.heightPx / pane.sourceHeight;
    outputCtx.scale(
      pane.exportScale * destinationScaleX,
      pane.exportScale * destinationScaleY,
    );
    outputCtx.translate(-pane.visibleLeftCss, -pane.visibleTopCss);
    drawGrid(outputCtx, pane.widthCss, pane.heightCss, tab.grid);
    outputCtx.restore();

    const strokes = tab.strokes[pane.id] ?? [];
    const boxes = tab.textBoxes[pane.id] ?? [];
    if (!strokes.length && !boxes.length) continue;

    // Eraser strokes must clear only annotations, never the photo. Render the
    // transparent layer at source resolution, then scale it with the photo.
    const annotation = document.createElement("canvas");
    annotation.width = Math.ceil(pane.sourceWidth);
    annotation.height = Math.ceil(pane.sourceHeight);
    const annotationCtx = annotation.getContext("2d");
    if (!annotationCtx) throw new Error("Không thể tạo lớp annotation.");

    annotationCtx.scale(pane.exportScale, pane.exportScale);
    annotationCtx.translate(-pane.visibleLeftCss, -pane.visibleTopCss);
    drawStrokes(annotationCtx, pane, strokes);
    drawTextBoxes(annotationCtx, pane, boxes);
    outputCtx.drawImage(
      annotation,
      0,
      0,
      pane.sourceWidth,
      pane.sourceHeight,
      pane.leftPx,
      pane.topPx,
      pane.widthPx,
      pane.heightPx,
    );

    // Release the temporary high-resolution backing store before the next pane.
    annotation.width = 1;
    annotation.height = 1;
  }

  const dataUrl = await canvasToPngDataURL(output);
  output.width = 1;
  output.height = 1;

  return { dataUrl, width, height };
}
