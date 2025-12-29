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
} from "lucide-react";
import { useEffect, useRef } from "react";
import { useApp } from "../app/store";
import { openFileDialog, savePngDialog } from "../app/bridge";

export default function Toolbar() {
  // const has = useApp(s => s.hasActive()); // dùng để disable nút khi chưa có tab
  const toggleLinkAll = useApp((s) => s.toggleLinkAll);
  const setFileForPane = useApp((s) => s.setFileForPane);
  const nextEmpty = useApp((s) => s.nextEmptyPaneId);
  const resetView = useApp((s) => s.resetView);
  const toggleLoupe = useApp((s) => s.toggleLoupe);
  const clearAllPanes = useApp((s) => s.clearAllPanes);
  const toggleLayout = useApp((s) => s.toggleLayout);

  // Throttle update màu brush theo rAF để tránh re-render/draw quá dày khi kéo color picker
  const colorRafRef = useRef<number | null>(null);
  const pendingColorRef = useRef<string | null>(null);

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

  // const handleOpen = async () => {
  //   const paneId = focusedPaneId; // lấy từ store/hook
  //   const paths = await openFileDialog(paneId);
  //   if (!paths) return;
  //   useApp.getState().addFilesToActiveTabFromDialog(paths, paneId);
  // };

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

  const BTN_BASE =
    "px-2 py-1 rounded flex items-center gap-1 select-none transition btn-width justify-center";
  const BTN_DISABLED = "bg-neutral-800/60 text-neutral-700 cursor-not-allowed";

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
      : nextEmpty() ?? "D";

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

  function nextFrame() {
    return new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  function canvasToDataURL(canvas: HTMLCanvasElement): Promise<string> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("toBlob failed"));
          const fr = new FileReader();
          fr.onloadend = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error("FileReader failed"));
          fr.readAsDataURL(blob);
        },
        "image/png",
        1
      );
    });
  }

  async function onExport() {
    if (!hasAnyImage) return;

    const t = useApp.getState().getActiveSafe();

    const gridEl = document.querySelector(
      '[data-role="viewer-grid"]'
    ) as HTMLElement | null;
    if (!gridEl) {
      alert("Không tìm thấy viewer grid để export.");
      return;
    }

    // bật exporting để canvas redraw sạch (không loupe/cursor UI)
    setExporting(true);
    try {
      // đợi 2 frame cho chắc redraw xong
      await nextFrame();
      await nextFrame();

      const gridRect = gridEl.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      const out = document.createElement("canvas");
      out.width = Math.max(1, Math.floor(gridRect.width * dpr));
      out.height = Math.max(1, Math.floor(gridRect.height * dpr));

      const ctx = out.getContext("2d");
      if (!ctx) return;

      // nền giống bg-neutral-950
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, out.width, out.height);

      for (const id of t.panes) {
        if (!t.files[id] && !t.dataURL[id]) continue;

        const paneWrap = gridEl.querySelector(
          `[data-role="pane-wrap"][data-pane="${id}"]`
        ) as HTMLElement | null;
        if (!paneWrap) continue;

        const pr = paneWrap.getBoundingClientRect();
        const dx = Math.floor((pr.left - gridRect.left) * dpr);
        const dy = Math.floor((pr.top - gridRect.top) * dpr);
        const dw = Math.max(1, Math.floor(pr.width * dpr));
        const dh = Math.max(1, Math.floor(pr.height * dpr));

        const imgCanvas = paneWrap.querySelector(
          'canvas[data-role="pane-image"]'
        ) as HTMLCanvasElement | null;

        const annCanvas = paneWrap.querySelector(
          'canvas[data-role="pane-annot"]'
        ) as HTMLCanvasElement | null;

        if (imgCanvas) {
          ctx.drawImage(
            imgCanvas,
            0,
            0,
            imgCanvas.width,
            imgCanvas.height,
            dx,
            dy,
            dw,
            dh
          );
        }
        if (annCanvas) {
          ctx.drawImage(
            annCanvas,
            0,
            0,
            annCanvas.width,
            annCanvas.height,
            dx,
            dy,
            dw,
            dh
          );
        }
      }

      const suggested = `${sanitizeFilename(t.name)}.png`;
      const dataUrl = await canvasToDataURL(out);
      const savedPath = await savePngDialog(dataUrl, suggested);
      if (!savedPath) return;

      console.log("[Export] saved ->", savedPath);
    } finally {
      setExporting(false);
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

      {/* controls */}
      {hasAnyImage && toolMode === "draw" && (
        <div className="relative group">
          <input
            type="color"
            value={brushColor}
            onInput={(e) => setBrushColorThrottled(e.currentTarget.value)}
            onChange={(e) => setBrushColorThrottled(e.currentTarget.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            title="Brush color"
          />

          <div
            className="
        w-5 h-5 rounded-full
        border border-white/30
        shadow-inner shadow-black/40
        ring-1 ring-black/40
        group-hover:ring-2 group-hover:ring-blue-400/60
        transition
      "
            style={{ backgroundColor: brushColor }}
          />
        </div>
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

      {/* Export */}
      <div
        onClick={onExport}
        title="Export workspace as PNG"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none btn-width justify-center transition
    ${
      hasAnyImage
        ? "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 cursor-pointer"
        : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
    }`}
      >
        <Download size={16} /> Export
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
