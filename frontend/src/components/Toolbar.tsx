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
  LayoutGrid,
  Type,
  Bold,
  Italic,
  Underline,
  Layers3,
  ChevronDown,
  Check,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useMemo, useRef, useEffect, useState } from "react";
import { useApp, type TextStyle, type PaneId } from "../app/store";
import { openFileDialog, savePngDialog } from "../app/bridge";
import { renderWorkspacePng } from "../app/exportWorkspace";

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

  const textOn = useApp((s) => s.getActiveSafe().textTool.on);
  const textStyle = useApp((s) => s.getActiveSafe().textTool.style);

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

  const rafTextColor = useRef<number | null>(null);
  const pendingTextColor = useRef<string>(textStyle.color);

  const [fsOpen, setFsOpen] = useState(false);
  const fsRef = useRef<HTMLDivElement | null>(null);

  const [fontOpen, setFontOpen] = useState(false);
  const fontRef = useRef<HTMLDivElement | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
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
    "px-2 py-1 rounded flex items-center gap-1 select-none transition btn-width justify-center";

  // const BTN_FIELD =
  //   "relative inline-flex items-center gap-2 px-2 h-8 rounded " +
  //   "bg-neutral-800 hover:bg-neutral-700 text-neutral-200 " +
  //   "border border-neutral-700/60 shadow-sm transition select-none";

  const BTN_FIELD =
    "h-7 relative inline-flex items-center gap-1 px-1 rounded select-none transition justify-center " +
    "bg-neutral-800 hover:bg-neutral-700 hover:border-neutral-700 text-neutral-200 " +
    "border border-neutral-800 shadow-sm";

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

  const btnToggle = (active: boolean) =>
    !hasAnyImage
      ? BTN_DISABLED
      : active
        ? "bg-blue-600/60 hover:bg-blue-600 text-white cursor-pointer"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer";

  const btnAction = () =>
    !hasAnyImage
      ? BTN_DISABLED
      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer";

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
      const png = await renderWorkspacePng(t, gridEl, { embedExif });
      const suggested = `${sanitizeFilename(t.name)}.png`;
      const savedPath = await savePngDialog(png.dataUrl, suggested);
      if (!savedPath) return;

      console.log(
        `[Export] saved ${png.width}×${png.height}px ->`,
        savedPath,
      );
    } catch (error) {
      console.error("[Export] failed", error);
      const message =
        error instanceof Error ? error.message : "Lỗi export không xác định.";
      alert(`Không thể export PNG.\n\n${message}`);
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
            : "Blink requires at least two images"
        }
        className={`${BTN_BASE} ${
          paneCount < 2
            ? BTN_DISABLED
            : comparisonMode === "blink"
              ? "bg-blue-600/60 hover:bg-blue-600 text-white cursor-pointer"
              : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
        }`}
      >
        <Layers3 size={16} /> Blink
      </div>

      {/* Draw */}
      <div
        onClick={() => hasAnyImage && toggleDraw()}
        title="Draw (F)"
        className={`${BTN_BASE} ${btnToggle(toolMode === "draw")}`}
      >
        <Pencil size={16} />
        Draw
      </div>

      {/* Erase */}
      <div
        onClick={() => hasAnyImage && toggleErase()}
        title="Erase (G)"
        className={`${BTN_BASE} ${btnToggle(toolMode === "erase")}`}
      >
        <Eraser size={16} /> Erase
      </div>

      {/* Text */}
      <div
        onClick={() => hasAnyImage && toggleText()}
        title="Text (T)"
        className={`${BTN_BASE} ${btnToggle(textOn)}`}
      >
        <Type size={16} /> Text
      </div>

      {/* Text style controls */}
      {textOn && hasAnyImage && (
        <>
          {/* separator nhỏ để tách khỏi tool buttons */}
          <div className="w-px h-6 bg-neutral-700/70 mx-1" />
          {/* Text color (button-style) */}
          <div className={BTN_FIELD} title="Text color">
            <input
              type="color"
              value={shownTextStyle.color}
              onInput={(e) => {
                const color = (e.currentTarget as HTMLInputElement).value;
                pendingTextColor.current = color;
                if (rafTextColor.current) return;
                rafTextColor.current = requestAnimationFrame(() => {
                  rafTextColor.current = null;
                  const c = pendingTextColor.current;
                  applyStyle({ color: c });
                });
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div
              className="w-5 h-5 rounded-md border border-white/20 shadow-inner shadow-black/40"
              style={{ backgroundColor: shownTextStyle.color }}
            />
          </div>
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
                className="absolute z-50 mt-1 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-1"
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
                className="absolute z-50 mt-1 rounded border border-neutral-700/70 bg-neutral-900/95 shadow-lg p-1"
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
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none transition
    ${btnToggle(!!shownTextStyle.bold)}`}
          >
            <Bold className="w-4 h-4" />
          </div>

          <div
            onClick={() => applyStyle({ italic: !shownTextStyle.italic })}
            title="Italic"
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none transition ${btnToggle(
              !!shownTextStyle.italic,
            )}`}
          >
            <Italic className="w-4 h-4" />
          </div>
          <div
            onClick={() => applyStyle({ underline: !shownTextStyle.underline })}
            title="Underline"
            className={`h-7 w-7 rounded inline-flex items-center justify-center select-none transition ${btnToggle(
              !!shownTextStyle.underline,
            )}`}
          >
            <Underline className="w-4 h-4" />
          </div>
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
                  cursor-pointer select-none transition btn-width justify-center"
      >
        <ImageIcon size={16} /> Open
      </div>

      {/* Layout toggle (2x2 <-> 1x4) */}
      <div
        onClick={() => paneCount === 4 && toggleLayout()}
        title={
          paneCount === 4
            ? `Toggle layout (${layout === "row1x4" ? "1x4" : "2x2"})`
            : "Layout toggle is available when you have 4 photos"
        }
        className={`px-2 py-1 rounded flex items-center gap-1
            ${
              paneCount === 4
                ? layout === "row1x4"
                  ? "bg-blue-600/60 hover:bg-blue-600 text-white cursor-pointer"
                  : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
            }
            select-none transition btn-width justify-center`}
      >
        <LayoutGrid size={16} /> Layout
      </div>

      {/* Export + options */}
      <div className="relative flex" ref={exportMenuRef}>
        <div
          onClick={onExport}
          title={
            embedExif
              ? "Export workspace as PNG with EXIF overlay"
              : "Export workspace as PNG"
          }
          className={`pl-2 pr-1.5 py-1 rounded-l flex items-center gap-1 select-none justify-center transition
            ${
              hasAnyImage
                ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
                : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
            }`}
        >
          <Download size={16} /> Export
        </div>
        <button
          type="button"
          disabled={!hasAnyImage}
          onClick={() => hasAnyImage && setExportMenuOpen((open) => !open)}
          title="Export options"
          className={`w-6 rounded-r border-l border-neutral-700/70 flex items-center justify-center transition ${
            hasAnyImage
              ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-400 cursor-pointer"
              : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
          }`}
        >
          <ChevronDown size={13} />
        </button>

        {exportMenuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded border border-neutral-700/80 bg-neutral-900/95 p-1 shadow-xl">
            <button
              type="button"
              onClick={() => setEmbedExif((value) => !value)}
              className="w-full h-8 px-2 rounded flex items-center gap-2 text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer"
            >
              <span
                className={[
                  "w-4 h-4 rounded border flex items-center justify-center",
                  embedExif
                    ? "bg-blue-600 border-blue-500 text-white"
                    : "border-neutral-600 bg-neutral-950",
                ].join(" ")}
              >
                {embedExif && <Check size={12} strokeWidth={2.6} />}
              </span>
              Embed EXIF
            </button>
          </div>
        )}
      </div>

      {/* Clear All */}
      <div
        onClick={() => hasAnyImage && clearAllPanes()}
        title="Clear all"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none btn-width justify-center transition
                    ${
                      hasAnyImage
                        ? "bg-neutral-800 text-neutral-300 hover:bg-red-600/80 hover:border-red-500 hover:text-black cursor-pointer"
                        : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
                    }`}
      >
        <Trash2 size={16} />
        Clear
      </div>
    </div>
  );
}
