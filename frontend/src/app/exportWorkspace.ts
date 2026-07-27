import {
  readExifFromDataURL,
  readExifFromPath,
  readImageSource,
} from "./bridge";
import { strokeUVToImgPx } from "./annotCoords";
import { formatDeviceName, formatFocalLengths } from "./exifFormat";
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
  exif?: Record<PaneId, Record<string, unknown> | undefined>;
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
  exif?: Record<string, unknown>;
  dataURL?: string;
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

export type ExportWorkspaceOptions = {
  embedExif?: boolean;
};

// Chromium/WebView2 commonly rejects a canvas beyond these limits. Failing
// explicitly is safer than silently shrinking an export and losing detail.
const MAX_CANVAS_DIMENSION = 32_767;
const MAX_CANVAS_AREA = 268_435_456;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (
      /^https?:\/\//i.test(url) &&
      new URL(url).origin !== window.location.origin
    ) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể giải mã ảnh gốc."));
    image.src = url;
  });
}

async function loadPaneImage(
  path: string | undefined,
  dataURL: string | undefined,
): Promise<HTMLImageElement> {
  const source = dataURL ?? (path ? await readImageSource(path) : null);
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
  embedExif: boolean,
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
  let exif = tab.exif?.[id];
  if (embedExif && !exif) {
    exif = path
      ? ((await readExifFromPath(path)) as Record<string, unknown> | undefined)
      : dataURL
        ? ((await readExifFromDataURL(dataURL)) as
            | Record<string, unknown>
            | undefined)
        : undefined;
  }

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
    exif,
    dataURL,
  };
}

function dataURLByteLength(value?: string) {
  if (!value) return undefined;
  const separator = value.indexOf(",");
  const base64 = separator >= 0 ? value.slice(separator + 1) : value;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, (base64.length * 3) / 4 - padding);
}

function formatFileSize(value: unknown) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const text =
    unit > 0 && amount < 10 ? amount.toFixed(1) : Math.round(amount).toString();
  return `${text} ${units[unit]}`;
}

function firstExifValue(exif: Record<string, unknown>, keys: string[]) {
  const nested = ["Exif", "Photo", "SubIFD", "tags", "ExifIFD", "Image"];
  const containers: Array<Record<string, unknown>> = [exif];
  for (const key of nested) {
    const value = exif[key];
    if (value && typeof value === "object") {
      containers.push(value as Record<string, unknown>);
    }
  }

  for (const container of containers) {
    for (const key of keys) {
      const value = container[key];
      if (value != null && value !== "") return value;
    }
  }
  return undefined;
}

function exifNumber(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value) && value.length >= 2) {
    const numerator = Number(value[0]);
    const denominator = Number(value[1]);
    return Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      denominator !== 0
      ? numerator / denominator
      : undefined;
  }
  if (value && typeof value === "object") {
    const rational = value as { numerator?: unknown; denominator?: unknown };
    const numerator = Number(rational.numerator);
    const denominator = Number(rational.denominator);
    if (
      Number.isFinite(numerator) &&
      Number.isFinite(denominator) &&
      denominator !== 0
    ) {
      return numerator / denominator;
    }
  }
  if (typeof value === "string") {
    const fraction = value
      .trim()
      .match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/);
    if (fraction) {
      const denominator = Number(fraction[2]);
      if (denominator !== 0) return Number(fraction[1]) / denominator;
    }
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return undefined;
}

function formatIso(exif: Record<string, unknown>) {
  const value = firstExifValue(exif, [
    "ISO",
    "ISOSpeedRatings",
    "PhotographicSensitivity",
  ]);
  if (Array.isArray(value)) return value.join("/");
  return value != null && String(value).trim() ? String(value).trim() : undefined;
}

function formatAperture(exif: Record<string, unknown>) {
  const fNumber = exifNumber(
    firstExifValue(exif, ["FNumber", "Aperture"]),
  );
  if (fNumber && fNumber > 0) {
    return `f/${fNumber.toFixed(1).replace(/\.0$/, "")}`;
  }

  const apertureValue = exifNumber(firstExifValue(exif, ["ApertureValue"]));
  if (!apertureValue && apertureValue !== 0) return undefined;
  const converted = Math.pow(2, apertureValue / 2);
  return `f/${converted.toFixed(1).replace(/\.0$/, "")}`;
}

function formatShutter(exif: Record<string, unknown>) {
  let seconds = exifNumber(
    firstExifValue(exif, ["ExposureTime", "ShutterSpeed"]),
  );
  if (!seconds) {
    const shutterValue = exifNumber(
      firstExifValue(exif, ["ShutterSpeedValue"]),
    );
    if (shutterValue != null) seconds = Math.pow(2, -shutterValue);
  }
  if (!seconds || seconds <= 0) return undefined;
  return seconds < 1
    ? `1/${Math.max(1, Math.round(1 / seconds))}`
    : `${seconds < 10 ? seconds.toFixed(2).replace(/\.?0+$/, "") : Math.round(seconds)}s`;
}

function buildExifLines(pane: PreparedPane) {
  const exif = pane.exif ?? {};
  const device = formatDeviceName(exif);
  const { focalLength, focalLength35mm } = formatFocalLengths(exif);
  const fileSize = formatFileSize(
    firstExifValue(exif, ["FileSize"]) ?? dataURLByteLength(pane.dataURL),
  );
  const exposure = [
    focalLength35mm,
    formatIso(exif) ? `ISO ${formatIso(exif)}` : undefined,
    formatAperture(exif),
    formatShutter(exif),
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    device || "—",
    fileSize,
    focalLength || "—",
    exposure || "—",
  ];
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawExifOverlay(
  ctx: CanvasRenderingContext2D,
  pane: PlacedPane,
) {
  const lines = buildExifLines(pane);
  const shortEdge = Math.min(pane.widthPx, pane.heightPx);
  let fontPx = Math.max(15, Math.min(42, Math.round(shortEdge * 0.0135)));
  const maxTextWidth = Math.max(160, pane.widthPx * 0.82);

  ctx.save();
  while (fontPx > 15) {
    ctx.font = `400 ${fontPx}px Arial`;
    const widest = Math.max(
      ...lines.map((line) => ctx.measureText(line).width),
    );
    if (widest <= maxTextWidth) break;
    fontPx -= 1;
  }

  const lineHeight = Math.round(fontPx * 1.28);
  const paddingX = Math.max(7, Math.round(fontPx * 0.55));
  const paddingY = Math.max(6, Math.round(fontPx * 0.45));
  const margin = Math.max(10, Math.round(shortEdge * 0.008));

  ctx.font = `400 ${fontPx}px Arial`;
  const textWidth = Math.max(
    ...lines.map((line) => ctx.measureText(line).width),
  );
  const width = textWidth + paddingX * 2;
  const height = lineHeight * lines.length + paddingY * 2;
  const left = pane.leftPx + margin;
  const top = pane.topPx + margin;

  roundedRect(ctx, left, top, width, height, Math.max(5, fontPx * 0.35));
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();

  ctx.fillStyle = "rgba(245,245,245,0.88)";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(
      line,
      left + paddingX,
      top + paddingY + index * lineHeight,
    );
  });
  ctx.restore();
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
  options: ExportWorkspaceOptions = {},
): Promise<WorkspacePng> {
  const gridRect = gridElement.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) {
    throw new Error("Workspace không có kích thước hợp lệ.");
  }

  const prepared = await Promise.all(
    tab.panes.map((id) =>
      preparePane(tab, id, gridElement, !!options.embedExif),
    ),
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
    if (strokes.length || boxes.length) {
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

    if (options.embedExif) drawExifOverlay(outputCtx, pane);
  }

  const dataUrl = await canvasToPngDataURL(output);
  output.width = 1;
  output.height = 1;

  return { dataUrl, width, height };
}
