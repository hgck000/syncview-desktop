/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Link2,
  Maximize,
  Search,
  Trash2,
  ImageIcon,
  Pencil,
  Eraser,
  Download,
  LoaderCircle,
  Columns4,
  Grid2X2,
  Type,
  Bold,
  Italic,
  Underline,
  Layers3,
  ChevronDown,
  Shapes,
  Square,
  Circle,
  Triangle,
  Minus,
  MoveUpRight,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useMemo, useRef, useEffect, useState } from "react";
import {
  useApp,
  type TextStyle,
  type PaneId,
  type ShapeKind,
  type ShapeAnnotation,
  type ShapeStyle,
} from "../app/store";
import { openFileDialog, saveImageDialog } from "../app/bridge";
import {
  renderWorkspaceImage,
  type ExportFormat,
} from "../app/exportWorkspace";

export default function Toolbar() {
  // const has = useApp(s => s.hasActive()); // dùng để disable nút khi chưa có tab
  const toggleLinkAll = useApp((s) => s.toggleLinkAll);
  const setFileForPane = useApp((s) => s.setFileForPane);
  const nextEmpty = useApp((s) => s.nextEmptyPaneId);
  const resetView = useApp((s) => s.resetView);
  const toggleLoupe = useApp((s) => s.toggleLoupe);
  const clearAllPanes = useApp((s) => s.clearAllPanes);
  const toggleLayout = useApp((s) => s.toggleLayout);
  const toggleBlinkMode = useApp((s) => s.toggleBlinkMode);
  const toggleText = useApp((s) => s.toggleText);
  const setTextToolStyle = useApp((s) => s.setTextToolStyle);
  const patchTextBoxStyle = useApp((s) => s.patchTextBoxStyle);
  const toggleShape = useApp((s) => s.toggleShape);
  const setShapeToolStyle = useApp((s) => s.setShapeToolStyle);
  const setShapeStyle = useApp((s) => s.setShapeStyle);

  const textOn = useApp((s) => s.getActiveSafe().textTool.on);
  const textStyle = useApp((s) => s.getActiveSafe().textTool.style);
  const shapeTool = useApp((s) => s.getActiveSafe().shapeTool);
  const shapeOn = shapeTool.on;

  // Throttle update màu brush theo rAF để tránh re-render/draw quá dày khi kéo color picker
  const colorRafRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string | null>(null);

  const snap = useApp(
    useShallow((s) => {
      const t = s.getActiveSafe();
      return {
        // editing primitives
        editingPane: t.textUI.editing?.pane ?? null,
        editingId: t.textUI.editing?.id ?? null,

        // selected primitives (quan trọng: không lấy cả object)
        selA: t.textUI.selected.A,
        selB: t.textUI.selected.B,
        selC: t.textUI.selected.C,
        selD: t.textUI.selected.D,

        // textBoxes (để tìm box theo id)
        boxA: t.textBoxes.A,
        boxB: t.textBoxes.B,
        boxC: t.textBoxes.C,
        boxD: t.textBoxes.D,

        shapeSelA: t.shapeUI.selected.A,
        shapeSelB: t.shapeUI.selected.B,
        shapeSelC: t.shapeUI.selected.C,
        shapeSelD: t.shapeUI.selected.D,
        shapesA: t.shapes.A,
        shapesB: t.shapes.B,
        shapesC: t.shapes.C,
        shapesD: t.shapes.D,

        // default tool style
        textToolStyle: t.textTool.style,

        // link
        linkAll: t.linkAll,
        panes: t.panes,
      };
    }),
  );

  const selection = useMemo(() => {
    // ưu tiên editing
    if (snap.editingPane && snap.editingId != null) {
      const pane = snap.editingPane as PaneId;
      const id = snap.editingId as number;
      const arr =
        pane === "A"
          ? snap.boxA
          : pane === "B"
            ? snap.boxB
            : pane === "C"
              ? snap.boxC
              : snap.boxD;

      const box = (arr ?? []).find((b) => b.id === id) ?? null;
      return box ? { pane, id, box } : null;
    }

    // không editing -> quét selected A-D
    const entries: Array<[PaneId, number | null, any[]]> = [
      ["A", snap.selA, snap.boxA],
      ["B", snap.selB, snap.boxB],
      ["C", snap.selC, snap.boxC],
      ["D", snap.selD, snap.boxD],
    ];

    for (const [pane, id, arr] of entries) {
      if (id != null) {
        const box = (arr ?? []).find((b) => b.id === id) ?? null;
        return box ? { pane, id, box } : null;
      }
    }

    return null;
  }, [
    snap.editingPane,
    snap.editingId,
    snap.selA,
    snap.selB,
    snap.selC,
    snap.selD,
    snap.boxA,
    snap.boxB,
    snap.boxC,
    snap.boxD,
  ]);

  // const shownTextStyle = selection?.box.style ?? snap.textToolStyle;
  const shownTextStyle = selection ? selection.box.style : snap.textToolStyle;

  const shapeSelection = useMemo(() => {
    const entries: Array<[PaneId, number | null, ShapeAnnotation[]]> = [
      ["A", snap.shapeSelA, snap.shapesA],
      ["B", snap.shapeSelB, snap.shapesB],
      ["C", snap.shapeSelC, snap.shapesC],
      ["D", snap.shapeSelD, snap.shapesD],
    ];

    for (const [pane, id, shapes] of entries) {
      if (id == null) continue;
      const shape = shapes.find((candidate) => candidate.id === id);
      if (shape) return { pane, id, shape };
    }
    return null;
  }, [
    snap.shapeSelA,
    snap.shapeSelB,
    snap.shapeSelC,
    snap.shapeSelD,
    snap.shapesA,
    snap.shapesB,
    snap.shapesC,
    snap.shapesD,
  ]);

  const shownShapeStyle: ShapeStyle = shapeSelection
    ? {
        kind: shapeSelection.shape.kind,
        color: shapeSelection.shape.color,
        strokeWidthImgPx: shapeSelection.shape.strokeWidthImgPx,
        strokeStyle: shapeSelection.shape.strokeStyle ?? "solid",
      }
    : shapeTool;

  useEffect(() => {
    return () => {
      if (colorRafRef.current != null)
        cancelAnimationFrame(colorRafRef.current);
    };
  }, []);

  function setBrushColorThrottled(next: string) {
    pendingColorRef.current = next;
    if (colorRafRef.current != null) return;
    colorRafRef.current = requestAnimationFrame(() => {
      colorRafRef.current = null;
      const c = pendingColorRef.current;
      if (c) setBrushColor(c);
    });
  }

  const toggleDraw = useApp((s) => s.toggleDraw);
  const toggleErase = useApp((s) => s.toggleErase);
  const setBrushColor = useApp((s) => s.setBrushColor);

  const setExporting = useApp((s) => s.setExporting);
  const exporting = useApp((s) => s.exporting);
  const hasAnyImage = useApp((s) => {
    const t = s.getActiveSafe();
    return t.panes.some((id) => t.files[id] || t.dataURL[id]);
  });
  const linkAll = useApp((s) => s.getActiveSafe().linkAll);
  const loupeOn = useApp((s) => s.getActiveSafe().loupe.on);
  const toolMode = useApp((s) => s.getActiveSafe().annotate.mode);
  const brushColor = useApp((s) => s.getActiveSafe().annotate.color);
  const paneCount = useApp((s) => s.getActiveSafe().panes.length);
  const layout = useApp((s) => s.getActiveSafe().layout);
  const comparisonMode = useApp((s) => s.getActiveSafe().comparison.mode);
  const blinkEditingDisabled = comparisonMode === "blink";
  const exportAvailable = hasAnyImage && !exporting;

  const rafTextColor = useRef<number | null>(null);
  const pendingTextColor = useRef<string>(textStyle.color);

  const [fsOpen, setFsOpen] = useState(false);
  const fsRef = useRef<HTMLDivElement | null>(null);

  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement | null>(null);
  const [shapeOpen, setShapeOpen] = useState(false);
  const shapeRef = useRef<HTMLDivElement | null>(null);
  const [strokeOpen, setStrokeOpen] = useState(false);
  const strokeRef = useRef<HTMLDivElement | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [embedExif, setEmbedExif] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = fontRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setFontOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = shapeRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setShapeOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = strokeRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setStrokeOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = exportMenuRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setExportMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = fsRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setFsOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    return () => {
      if (rafTextColor.current) cancelAnimationFrame(rafTextColor.current);
    };
  }, []);

  const BTN_BASE =
    "px-2 py-1 rounded flex items-center gap-1 select-none " +
    "transition-[background-color,color,transform] duration-200 ease-out " +
    "btn-width justify-center";

  // const BTN_FIELD =
  //   "relative inline-flex items-center gap-2 px-2 h-8 rounded " +
  //   "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 " +
  //   "border border-neutral-700/60 shadow-sm transition select-none";

  const BTN_FIELD =
    "h-7 relative inline-flex items-center gap-1 px-1 rounded select-none " +
    "transition-[background-color,border-color,transform] duration-200 ease-out justify-center " +
    "bg-neutral-800 hover:bg-neutral-700 hover:border-neutral-700 text-neutral-200 " +
    "border border-neutral-800 shadow-sm active:scale-[0.94]";

  const FIELD_INNER =
    "bg-transparent outline-none border-none text-sm text-neutral-200 " +
    "appearance-none";

  const BTN_DISABLED = "bg-neutral-800/60 text-neutral-700 cursor-not-allowed";

  const FONT_OPTIONS = [
    "Arial",
    "Verdana",
    "Tahoma",
    "Times New Roman",
    "Georgia",
    "Courier New",
  ] as const;

  const FONT_SIZE_PRESETS = [
    2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48, 72, 120, 300,
  ] as const;

  const SHAPE_OPTIONS = [
    { value: "rectangle" as ShapeKind, label: "Rectangle", Icon: Square },
    { value: "ellipse" as ShapeKind, label: "Ellipse", Icon: Circle },
    { value: "triangle" as ShapeKind, label: "Triangle", Icon: Triangle },
    { value: "line" as ShapeKind, label: "Line", Icon: Minus },
    { value: "arrow" as ShapeKind, label: "Arrow", Icon: MoveUpRight },
  ];
  const activeShapeOption =
    SHAPE_OPTIONS.find((option) => option.value === shownShapeStyle.kind) ??
    SHAPE_OPTIONS[0];
  const ActiveShapeIcon = activeShapeOption.Icon;

  const SHAPE_STROKE_PRESETS = [
    { value: 4, preview: 1, title: "Thin stroke" },
    { value: 8, preview: 2, title: "Regular stroke" },
    { value: 16, preview: 3, title: "Bold stroke" },
    { value: 28, preview: 4, title: "Heavy stroke" },
  ] as const;
  const activeStrokePreset =
    SHAPE_STROKE_PRESETS.find(
      ({ value }) => value === shownShapeStyle.strokeWidthImgPx,
    ) ?? SHAPE_STROKE_PRESETS[1];

  const btnToggle = (active: boolean) =>
    !hasAnyImage
      ? BTN_DISABLED
      : active
        ? "bg-blue-600/60 hover:bg-blue-600 text-white cursor-pointer active:scale-[0.94]"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer active:scale-[0.94]";

  const btnAction = () =>
    !hasAnyImage
      ? BTN_DISABLED
      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer active:scale-[0.94]";

  async function onOpen() {
    const t0 = useApp.getState().getActiveSafe();
    const baseTarget = t0.panes.length
      ? t0.panes[t0.focusIndex]
      : (nextEmpty() ?? "D");

    console.log("[UI] Open -> base target pane =", baseTarget);

    const paths = await openFileDialog(baseTarget);
    if (!paths || paths.length === 0) return;

    const state = useApp.getState();
    const getActive = state.getActiveSafe;

    for (const path of paths) {
      const s = getActive();
      const panes = s.panes;
      const focusedPaneId = panes.length ? panes[s.focusIndex] : baseTarget;

      const empty = nextEmpty();

      const targetPane = empty ?? focusedPaneId;
      console.log("[UI] Open assign", path, "->", targetPane);

      setFileForPane(targetPane, path);
    }
  }

  function activePane() {
    const t = useApp.getState().getActiveSafe();
    return t.panes[t.focusIndex];
  }

  function onFit() {
    const id = activePane();
    if (!id) return;
    resetView(id);
  }

  function sanitizeFilename(name: string) {
    // Windows cấm: <>:"/\|?*
    return (
      (name || "SyncView")
        // eslint-disable-next-line no-control-regex
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120)
    );
  }

  async function onExport() {
    if (!hasAnyImage) return;
    setExportMenuOpen(false);

    const t = useApp.getState().getActiveSafe();

    const gridEl = document.querySelector(
      '[data-role="viewer-grid"]',
    ) as HTMLElement | null;
    if (!gridEl) {
      alert("Không tìm thấy viewer grid để export.");
      return;
    }

    // Khoá UI export trong lúc tải ảnh gốc và dựng canvas độ phân giải cao.
    setExporting(true);
    try {
      const image = await renderWorkspaceImage(t, gridEl, {
        embedExif,
        format: exportFormat,
      });
      const extension = exportFormat === "jpeg" ? "jpg" : "png";
      const suggested = `${sanitizeFilename(t.name)}.${extension}`;
      const savedPath = await saveImageDialog(
        image.dataUrl,
        suggested,
        exportFormat,
      );
      if (!savedPath) return;

      console.log(
        `[Export] saved ${image.width}×${image.height}px as ${exportFormat.toUpperCase()} ->`,
        savedPath,
      );
    } catch (error) {
      console.error("[Export] failed", error);
      const message =
        error instanceof Error ? error.message : "Lỗi export không xác định.";
      alert(
        `Không thể export ${exportFormat === "jpeg" ? "JPEG" : "PNG"}.\n\n${message}`,
      );
    } finally {
      setExporting(false);
    }
  }

  function styleTargetsForSelection(): PaneId[] {
    if (!selection) return [];
    return snap.linkAll
      ? ((snap.panes?.length
          ? (snap.panes as PaneId[])
          : (["A", "B", "C", "D"] as PaneId[])) as PaneId[])
      : ([selection.pane] as PaneId[]);
  }

  function applyStyle(patch: Partial<TextStyle>) {
    if (selection) {
      patchTextBoxStyle(styleTargetsForSelection(), selection.id, patch);
    } else {
      setTextToolStyle(patch);
    }
  }

  function shapeTargetsForSelection(): PaneId[] {
    if (!shapeSelection) return [];
    return snap.linkAll
      ? ((snap.panes?.length
          ? (snap.panes as PaneId[])
          : (["A", "B", "C", "D"] as PaneId[])) as PaneId[])
      : [shapeSelection.pane];
  }

  function applyShapeStyle(patch: Partial<ShapeStyle>) {
    if (shapeSelection) {
      setShapeStyle(shapeTargetsForSelection(), shapeSelection.id, patch);
    } else {
      setShapeToolStyle(patch);
    }
  }

  function applyActiveColor(color: string) {
    if (shapeOn) applyShapeStyle({ color });
    else applyStyle({ color });
  }

  return (
    <div className="h-10 flex items-center gap-2 px-2 border-b border-neutral-800 bg-neutral-900 text-black text-sm">
      {/* Link All */}
      <div
        onClick={() => hasAnyImage && toggleLinkAll()}
        title="Link (E)"
        className={`${BTN_BASE} ${btnToggle(linkAll)}`}
      >
        <Link2 size={16} /> Link
      </div>

      {/* Fit */}
      <div
        onClick={() => hasAnyImage && onFit()}
        title="Fit (D)"
        className={`${BTN_BASE} ${btnAction()}`}
      >
        <Maximize size={16} />
        Fit
      </div>

      {/* Loupe */}
      <div
        onClick={() => hasAnyImage && toggleLoupe()}
        title="Loupe (V)"
        className={`${BTN_BASE} ${btnToggle(loupeOn)}`}
      >
        <Search size={16} />
        Loupe
      </div>

      {/* Manual multi-image blink */}
      <div
        onClick={() => paneCount >= 2 && toggleBlinkMode()}
        title={
          paneCount >= 2
            ? "Manual Blink — switch images with keys 1–4"
            : "At least 2 images required"
        }
        className={`${BTN_BASE} ${
          paneCount < 2
            ? BTN_DISABLED
            : comparisonMode === "blink"
              ? "bg-blue-600/60 hover:bg-blue-600 text-white cursor-pointer active:scale-[0.94]"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer active:scale-[0.94]"
        }`}
      >
        <Layers3 size={16} /> Blink
      </div>

      {/* Draw */}
      <div
        onClick={() =>
          hasAnyImage && !blinkEditingDisabled && toggleDraw()
        }
        title={
          blinkEditingDisabled
            ? "Draw is unavailable in Blink mode"
            : "Draw (F)"
        }
        className={`${BTN_BASE} ${
          blinkEditingDisabled
            ? BTN_DISABLED
            : btnToggle(toolMode === "draw")
        }`}
      >
        <Pencil size={16} />
        Draw
      </div>

      {/* Erase */}
      <div
        onClick={() =>
          hasAnyImage && !blinkEditingDisabled && toggleErase()
        }
        title={
          blinkEditingDisabled
            ? "Erase is unavailable in Blink mode"
            : "Erase (G)"
        }
        className={`${BTN_BASE} ${
          blinkEditingDisabled
            ? BTN_DISABLED
            : btnToggle(toolMode === "erase")
        }`}
      >
        <Eraser size={16} /> Erase
      </div>

      {/* Text */}
      <div
        onClick={() =>
          hasAnyImage && !blinkEditingDisabled && toggleText()
        }
        title={
          blinkEditingDisabled
            ? "Text is unavailable in Blink mode"
            : "Text (T)"
        }
        className={`${BTN_BASE} ${
          blinkEditingDisabled ? BTN_DISABLED : btnToggle(textOn)
        }`}
      >
        <Type size={16} /> Text
      </div>

      {/* Outline shape notes */}
      <div
        onClick={() =>
          hasAnyImage && !blinkEditingDisabled && toggleShape()
        }
        title={
          blinkEditingDisabled
            ? "Shape is unavailable in Blink mode"
            : "Shape (S)"
        }
        className={`${BTN_BASE} ${
          blinkEditingDisabled ? BTN_DISABLED : btnToggle(shapeOn)
        }`}
      >
        <Shapes size={16} /> Shape
      </div>

      {/* Text style controls */}
      {(textOn || shapeOn) && hasAnyImage && (
        <>
          {/* separator nhỏ để tách khỏi tool buttons */}
          <div className="w-px h-6 bg-neutral-700/70 mx-1" />
          {/* Shared color control for Text and Shape */}
          <div className={BTN_FIELD} title={shapeOn ? "Shape color" : "Text color"}>
            <input
              type="color"
              value={shapeOn ? shownShapeStyle.color : shownTextStyle.color}
              onInput={(e) => {
                const color = (e.currentTarget as HTMLInputElement).value;
                pendingTextColor.current = color;
                if (rafTextColor.current) return;
                rafTextColor.current = requestAnimationFrame(() => {
                  rafTextColor.current = null;
                  const c = pendingTextColor.current;
                  applyActiveColor(c);
                });
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div
              className="w-5 h-5 rounded-md border border-white/20 shadow-inner shadow-black/40"
              style={{
                backgroundColor: shapeOn
                  ? shownShapeStyle.color
                  : shownTextStyle.color,
              }}
            />
          </div>
          {textOn && (
            <>
          {/* Font dropdown (button-style) */}
          <div className="relative" ref={fontRef}>
            <div
              className={BTN_FIELD}
              title="Font"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                setFontOpen((v) => !v);
              }}
            >
              <div
                className={`${FIELD_INNER} w-37.5 pr-5 cursor-pointer select-none`}
              >
                {shownTextStyle.fontFamily}
              </div>

              <span className="pointer-events-none absolute right-1 text-neutral-400 text-xs">
                ▾
              </span>
            </div>

            {fontOpen && (
              <div
                className="sv-popover-enter absolute z-50 mt-1 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-1"
                style={{ width: 160 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div className="flex flex-col gap-1">
                  {FONT_OPTIONS.map((f) => {
                    const active = shownTextStyle.fontFamily === f;
                    return (
                      <div
                        key={f}
                        className={`w-full h-6 flex items-center rounded px-2 py-0.5 text-[14px] leading-4 cursor-pointer select-none ${
                          active
                            ? "bg-blue-600/60 text-white"
                            : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                        }`}
                        style={{ fontFamily: f }}
                        onMouseDown={() => {
                          applyStyle({
                            fontFamily: f as TextStyle["fontFamily"],
                          });
                          setFontOpen(false);
                        }}
                        title={f}
                      >
                        {f}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Font size (button-style) */}
          <div className="relative" ref={fsRef}>
            <div
              className={BTN_FIELD}
              title="Font size"
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                setFsOpen((v) => !v);
              }}
            >
              <input
                type="number"
                min={4}
                max={300}
                value={shownTextStyle.fontSizeImgPx}
                onChange={(e) => {
                  const fontSizeImgPx = Math.max(
                    4,
                    Math.min(300, Number(e.currentTarget.value) || 28),
                  );
                  applyStyle({ fontSizeImgPx });
                }}
                onFocus={() => setFsOpen(true)}
                onBlur={() => {
                  // blur có thể xảy ra khi click chọn item, nên đóng nhẹ tay bằng RAF
                  requestAnimationFrame(() => setFsOpen(false));
                }}
                className={`${FIELD_INNER} w-10 pl-2 no-spin cursor-pointer`}
              />
              <span className="pointer-events-none absolute right-1 text-neutral-400 text-xs">
                ▾
              </span>
            </div>

            {fsOpen && (
              <div
                className="sv-popover-enter absolute z-50 mt-1 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-1"
                style={{ width: 50 }}
                onMouseDown={(e) => {
                  // giữ focus input, tránh blur khi click panel
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                <div className="flex flex-col gap-1">
                  {FONT_SIZE_PRESETS.map((n) => {
                    const active = shownTextStyle.fontSizeImgPx === n;
                    return (
                      <div
                        key={n}
                        className={`w-10 text-center rounded py-1 text-[14px] leading-4 cursor-pointer select-none ${
                          active
                            ? "bg-blue-600/60 text-white"
                            : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                        }`}
                        onMouseDown={() => {
                          applyStyle({ fontSizeImgPx: n });
                          setFsOpen(false);
                        }}
                        title={`${n}`}
                      >
                        {n}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Bold / Italic / Underline: dùng đúng BTN_BASE để đồng bộ nút */}
          <div
            onClick={() => applyStyle({ bold: !shownTextStyle.bold })}
            title="Bold"
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none
    transition-[background-color,color,transform] duration-200 ease-out
    ${btnToggle(!!shownTextStyle.bold)}`}
          >
            <Bold className="w-4 h-4" />
          </div>

          <div
            onClick={() => applyStyle({ italic: !shownTextStyle.italic })}
            title="Italic"
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none
            transition-[background-color,color,transform] duration-200 ease-out ${btnToggle(
              !!shownTextStyle.italic,
            )}`}
          >
            <Italic className="w-4 h-4" />
          </div>
          <div
            onClick={() => applyStyle({ underline: !shownTextStyle.underline })}
            title="Underline"
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none
            transition-[background-color,color,transform] duration-200 ease-out ${btnToggle(
              !!shownTextStyle.underline,
            )}`}
          >
            <Underline className="w-4 h-4" />
          </div>
            </>
          )}

          {shapeOn && (
            <>
              <div className="relative" ref={shapeRef}>
                <div
                  className={BTN_FIELD}
                  style={{ width: 28, paddingInline: 0 }}
                  title={`Shape: ${activeShapeOption.label}`}
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    setStrokeOpen(false);
                    setShapeOpen((open) => !open);
                  }}
                >
                  <ActiveShapeIcon className="w-4 h-4" aria-hidden="true" />
                </div>

                {shapeOpen && (
                  <div
                    className="sv-popover-enter absolute left-0 z-50 mt-1 w-7 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-px"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <div className="flex flex-col gap-1">
                      {SHAPE_OPTIONS.map(({ value, label, Icon }) => (
                        <div
                          key={value}
                          role="option"
                          aria-selected={shownShapeStyle.kind === value}
                          aria-label={label}
                          title={label}
                          className={`h-6 w-full flex items-center justify-center rounded cursor-pointer select-none transition-[background-color,color] duration-150 ${
                            shownShapeStyle.kind === value
                              ? "bg-blue-600/60 text-white"
                              : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                          }`}
                          onMouseDown={() => {
                            applyShapeStyle({ kind: value });
                            setShapeOpen(false);
                          }}
                        >
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={strokeRef}>
                <div
                  className={BTN_FIELD}
                  style={{ width: 34, paddingInline: 0 }}
                  title="Stroke thickness and style"
                  onMouseDown={(event) => {
                    if (event.button !== 0) return;
                    setShapeOpen(false);
                    setStrokeOpen((open) => !open);
                  }}
                >
                  <svg
                    viewBox="0 0 24 12"
                    className="w-6 h-3"
                    aria-hidden="true"
                  >
                    <line
                      x1="2"
                      y1="6"
                      x2="22"
                      y2="6"
                      stroke="currentColor"
                      strokeWidth={activeStrokePreset.preview}
                      strokeLinecap="round"
                      strokeDasharray={
                        shownShapeStyle.strokeStyle === "dashed"
                          ? "4 3"
                          : undefined
                      }
                    />
                  </svg>
                </div>

                {strokeOpen && (
                  <div
                    className="sv-popover-enter absolute z-50 mt-1 w-24 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-1"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <div className="px-1 pt-0.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      Thickness
                    </div>
                    <div className="flex flex-col gap-1">
                      {SHAPE_STROKE_PRESETS.map(
                        ({ value, preview, title }) => (
                          <div
                            key={value}
                            role="option"
                            aria-selected={
                              shownShapeStyle.strokeWidthImgPx === value
                            }
                            aria-label={title}
                            title={title}
                            onMouseDown={() =>
                              applyShapeStyle({ strokeWidthImgPx: value })
                            }
                            className={`h-6 w-full rounded flex items-center justify-center cursor-pointer select-none transition-[background-color,color] duration-150 ${
                              shownShapeStyle.strokeWidthImgPx === value
                                ? "bg-blue-600/60 text-white"
                                : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                            }`}
                          >
                            <svg
                              viewBox="0 0 56 12"
                              className="w-14 h-3"
                              aria-hidden="true"
                            >
                              <line
                                x1="3"
                                y1="6"
                                x2="53"
                                y2="6"
                                stroke="currentColor"
                                strokeWidth={preview}
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>
                        ),
                      )}
                    </div>

                    <div className="my-1 h-px bg-neutral-700/70" />
                    <div className="px-1 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      Style
                    </div>
                    <div className="flex flex-col gap-1">
                      {(["solid", "dashed"] as const).map((strokeStyle) => (
                        <div
                          key={strokeStyle}
                          role="option"
                          aria-selected={
                            shownShapeStyle.strokeStyle === strokeStyle
                          }
                          aria-label={
                            strokeStyle === "solid"
                              ? "Solid stroke"
                              : "Dashed stroke"
                          }
                          title={
                            strokeStyle === "solid"
                              ? "Solid stroke"
                              : "Dashed stroke"
                          }
                          onMouseDown={() =>
                            applyShapeStyle({ strokeStyle })
                          }
                          className={`h-6 w-full rounded flex items-center justify-center cursor-pointer select-none transition-[background-color,color] duration-150 ${
                            shownShapeStyle.strokeStyle === strokeStyle
                              ? "bg-blue-600/60 text-white"
                              : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                          }`}
                        >
                          <svg
                            viewBox="0 0 56 12"
                            className="w-14 h-3"
                            aria-hidden="true"
                          >
                            <line
                              x1="3"
                              y1="6"
                              x2="53"
                              y2="6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeDasharray={
                                strokeStyle === "dashed" ? "5 4" : undefined
                              }
                            />
                          </svg>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* controls */}
      {hasAnyImage && toolMode === "draw" && (
        <>
          <div className="w-px h-6 bg-neutral-700/70 mx-1" />
          <div className={BTN_FIELD}>
            <input
              type="color"
              value={brushColor}
              onInput={(e) => setBrushColorThrottled(e.currentTarget.value)}
              onChange={(e) => setBrushColorThrottled(e.currentTarget.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              title="Brush color"
            />

            <div
              className="w-5 h-5 rounded-md border border-white/20 shadow-inner shadow-black/40"
              style={{ backgroundColor: brushColor }}
            />
          </div>
        </>
      )}

      {/* Open */}
      <div className="ml-auto" />
      <div
        onClick={onOpen}
        title="Open (Ctrl/Cmd+O)"
        className="px-2 py-1 rounded flex items-center gap-1
                  bg-neutral-800 hover:bg-neutral-700 text-neutral-300
                  cursor-pointer select-none transition-[background-color,transform]
                  duration-200 ease-out active:scale-[0.94]
                  btn-width justify-center"
      >
        <ImageIcon size={16} /> Open
      </div>

      {/* Layout toggle (2x2 <-> 1x4) */}
      <div
        onClick={() => paneCount === 4 && toggleLayout()}
        title={
          paneCount === 4
            ? `Switch to ${layout === "row1x4" ? "2x2" : "1x4"} layout`
            : "Available with 4 images"
        }
        className={`px-2 py-1 rounded flex items-center gap-1
            ${
              paneCount === 4
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer active:scale-[0.94]"
                : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
            }
            select-none transition-[background-color,transform] duration-200 ease-out
            btn-width justify-center`}
      >
        {layout === "row1x4" ? (
          <Columns4 size={16} />
        ) : (
          <Grid2X2 size={16} />
        )}
        Layout
      </div>

      {/* Export + options */}
      <div className="relative flex h-7 w-24" ref={exportMenuRef}>
        <button
          type="button"
          disabled={!exportAvailable}
          onClick={onExport}
          title={
            exporting
              ? "Exporting workspace..."
              : "Export workspace"
          }
          className={`!m-0 !min-w-0 !flex-1 !rounded-l-md !rounded-r-none !border-0 !px-1.5 !py-0 !outline-none
            group h-7 flex items-center gap-1 !font-normal select-none justify-center
            transition-[background-color,transform] duration-200 ease-out
            ${
              exporting
                ? "!bg-neutral-800 text-neutral-300 cursor-wait"
                : exportAvailable
                ? "!bg-neutral-800 hover:!bg-neutral-700 text-neutral-300 cursor-pointer active:scale-[0.95]"
                : "!bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
            }`}
        >
          {exporting ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
            />
          ) : (
            <Download
              size={16}
              className="transition-transform duration-200 group-hover:-translate-y-0.5 group-active:translate-y-0"
            />
          )}
          {exporting ? "Saving" : "Export"}
        </button>
        <button
          type="button"
          disabled={!exportAvailable}
          onClick={() =>
            exportAvailable && setExportMenuOpen((open) => !open)
          }
          title="Export options"
          aria-expanded={exportMenuOpen}
          className={`!m-0 !h-7 !w-7 !shrink-0 !rounded-l-none !rounded-r-md !border-0 !p-0 !outline-none
            flex items-center justify-center transition-[background-color,transform] duration-200 ease-out
            shadow-[inset_1px_0_0_rgba(82,82,91,0.85)] ${
            exportAvailable
              ? "!bg-neutral-800 hover:!bg-neutral-700 cursor-pointer active:scale-[0.92]"
              : "!bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
          }`}
        >
          <ChevronDown
            size={14}
            className={[
              "text-neutral-400 transition-transform duration-250 ease-out",
              exportMenuOpen ? "rotate-180" : "rotate-0",
            ].join(" ")}
          />
        </button>

        <div
          aria-hidden={!exportMenuOpen}
          className={[
            "sv-export-popover absolute right-0 top-full z-50 mt-1.5 w-72",
            "origin-top-right rounded-lg border border-neutral-700/80",
            "bg-neutral-950 p-2.5 shadow-2xl",
            exportMenuOpen
              ? "sv-export-popover-open"
              : "sv-export-popover-closed",
          ].join(" ")}
        >
          <div className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Image format
          </div>
          <div className="grid gap-1.5" role="radiogroup" aria-label="Image format">
            {(
              [
                {
                  value: "png",
                  title: "PNG — Lossless",
                  detail: "Exact pixels · Larger file",
                },
                {
                  value: "jpeg",
                  title: "JPEG — High quality",
                  detail: "95% quality · Smaller file",
                },
              ] as const
            ).map((option) => {
              const selected = exportFormat === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={exportMenuOpen ? 0 : -1}
                  onClick={() => setExportFormat(option.value)}
                  className={[
                    "!m-0 !min-h-0 !w-full !rounded-md !border !px-3 !py-2 !outline-none",
                    "flex items-center gap-3 text-left cursor-pointer",
                    "transition-[background-color,border-color] duration-180 ease-out",
                    "focus-visible:!ring-1 focus-visible:!ring-blue-500/70",
                    selected
                      ? "!border-blue-600 !bg-neutral-900/70 hover:!border-blue-500 hover:!bg-neutral-900"
                      : "!border-neutral-800 !bg-neutral-900/70 hover:!border-neutral-700 hover:!bg-neutral-900",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-8 w-10 shrink-0 items-center justify-center rounded",
                      "text-[9px] font-semibold tracking-wide",
                      selected
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-neutral-800 text-neutral-400",
                    ].join(" ")}
                  >
                    {option.value === "jpeg" ? "JPG" : "PNG"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={[
                        "block text-xs font-medium",
                        selected ? "text-neutral-100" : "text-neutral-300",
                      ].join(" ")}
                    >
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-3.5 text-neutral-500">
                      {option.detail}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={[
                      "h-2.5 w-2.5 shrink-0 rounded-full border",
                      selected
                        ? "border-blue-400 bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.45)]"
                        : "border-neutral-600 bg-neutral-950",
                    ].join(" ")}
                  />
                </button>
              );
            })}
          </div>

          <div className="mx-1 my-2 h-px bg-neutral-800" />
          <div className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            Image details
          </div>
          <button
            type="button"
            onClick={() => setEmbedExif((value) => !value)}
            role="switch"
            aria-checked={embedExif}
            tabIndex={exportMenuOpen ? 0 : -1}
            className="!m-0 !min-h-0 !w-full !rounded-md !border !border-neutral-800 !bg-neutral-900/70 !px-3 !py-2.5 !outline-none
                flex items-center gap-3 text-left cursor-pointer
                focus-visible:!ring-1 focus-visible:!ring-blue-500/70"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-neutral-100">
                EXIF overlay
              </span>
              <span className="mt-0.5 block text-[10px] leading-3.5 text-neutral-500">
                Add camera details to exported images
              </span>
            </span>
            <span
              className={[
                "relative h-5 w-9 shrink-0 rounded-full border",
                "transition-[background-color,border-color] duration-220 ease-out",
                embedExif
                  ? "border-blue-500 bg-blue-600"
                  : "border-neutral-600 bg-neutral-950",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow",
                  "transition-transform duration-220 ease-out",
                  embedExif ? "translate-x-[17px]" : "translate-x-0.5",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Clear All */}
      <div
        onClick={() => hasAnyImage && clearAllPanes()}
        title="Clear all"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none btn-width justify-center
                    ${
                      hasAnyImage
                        ? "bg-neutral-800 text-neutral-300 hover:bg-red-600/80 hover:border-red-500 hover:text-black cursor-pointer active:scale-[0.94]"
                        : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
                    }
                    transition-[background-color,color,transform] duration-200 ease-out`}
      >
        <Trash2 size={16} />
        Clear
      </div>
    </div>
  );
}
