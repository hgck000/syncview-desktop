import {
  Link2,
  Maximize,
  Search,
  Trash2,
  ImageIcon,
  Pencil,
  Eraser,
  Download,
} from "lucide-react";
import { useApp } from "../app/store";
import { openFileDialog, savePngDialog } from "../app/bridge";

export default function Toolbar() {
  const t = useApp((s) => s.getActiveSafe());
  // const has = useApp(s => s.hasActive()); // dùng để disable nút khi chưa có tab
  // const toggleGrid   = useApp(s => s.toggleGrid);
  // const setGridSize  = useApp(s => s.setGridSize);
  const toggleLinkAll = useApp((s) => s.toggleLinkAll);
  const setFileForPane = useApp((s) => s.setFileForPane);
  const nextEmpty = useApp((s) => s.nextEmptyPaneId);
  const resetView = useApp((s) => s.resetView);
  // const applyZoom     = useApp(s => s.applyZoom);
  const toggleLoupe = useApp((s) => s.toggleLoupe);
  // const setLoupeSize = useApp(s => s.setLoupeSize);
  // const setLoupeZoom = useApp(s => s.setLoupeZoom);
  const clearAllPanes = useApp((s) => s.clearAllPanes);
  const hasAny = !!t?.panes?.length;

  // const handleOpen = async () => {
  //   const paneId = focusedPaneId; // lấy từ store/hook
  //   const paths = await openFileDialog(paneId);
  //   if (!paths) return;
  //   useApp.getState().addFilesToActiveTabFromDialog(paths, paneId);
  // };

  const annotate = useApp((s) => s.getActiveSafe().annotate);
  const toggleDraw = useApp((s) => s.toggleDraw);
  const toggleErase = useApp((s) => s.toggleErase);
  const setBrushColor = useApp((s) => s.setBrushColor);

  const setExporting = useApp((s) => s.setExporting);
  const hasAnyImage = t.panes.some((id) => t.files[id] || t.dataURL[id]);

  async function onOpen() {
    // pane gốc để gửi xuống BE (dùng như hiện tại của bạn)
    const baseTarget = t.panes.length
      ? t.panes[t.focusIndex]
      : nextEmpty() ?? "D";

    console.log("[UI] Open -> base target pane =", baseTarget);

    const paths = await openFileDialog(baseTarget);
    if (!paths || paths.length === 0) return;

    // Helper: lấy lại tab mới nhất mỗi lần, tránh dùng t cũ nếu state đã đổi
    const state = useApp.getState();
    const getActive = state.getActiveSafe;

    for (const path of paths) {
      const s = getActive();
      const panes = s.panes;
      const focusedPaneId = panes.length ? panes[s.focusIndex] : baseTarget;

      // tìm pane trống (A/B/C/D) – dùng nextEmpty của bạn
      const empty = nextEmpty(); // hàm này nên đọc từ store hiện tại

      const targetPane = empty ?? focusedPaneId;
      console.log("[UI] Open assign", path, "->", targetPane);

      setFileForPane(targetPane, path);
    }
  }

  function activePane() {
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
    // <div className="h-10 flex items-center px-3 text-sm border-b border-neutral-800"></div>
    <div className="h-10 flex items-center gap-2 px-2 border-b border-neutral-800 bg-neutral-900 text-black text-sm">
      {/* Link All */}
      <div
        onClick={toggleLinkAll}
        title="Link (E)"
        className={`px-2 py-1 rounded flex items-center justify-center gap-1 select-none cursor-pointer btn-width transition
                    ${
                      t.linkAll
                        ? "bg-blue-600/60 hover:bg-blue-600 text-white"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    }`}
      >
        <Link2 size={16} /> Link
      </div>

      {/* Fit */}
      <div
        onClick={onFit}
        title="Fit (D)"
        className="px-2 py-1 rounded flex items-center gap-1
                  bg-neutral-800 hover:bg-neutral-700 text-neutral-300
                  cursor-pointer select-none transition btn-width justify-center"
      >
        <Maximize size={16} />
        Fit
      </div>

      {/* Loupe */}
      <div
        onClick={toggleLoupe}
        title="Loupe (V)"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none cursor-pointer btn-width justify-center transition
                    ${
                      t.loupe.on
                        ? "bg-blue-600/60 hover:bg-blue-600 text-white"
                        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    }`}
      >
        <Search size={16} />
        Loupe
      </div>

      {/* Draw */}
      <div
        onClick={toggleDraw}
        title="Draw (F)"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none cursor-pointer transition btn-width justify-center
    ${
      annotate.mode === "draw"
        ? "bg-blue-600/60 hover:bg-blue-600 text-white"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
    }`}
      >
        <Pencil size={16} />
        Draw
      </div>

      {/* Erase */}
      <div
        onClick={toggleErase}
        title="Erase (G)"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none cursor-pointer transition btn-width justify-center
    ${
      annotate.mode === "erase"
        ? "bg-blue-600/60 hover:bg-blue-600 text-white"
        : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
    }`}
      >
        <Eraser size={16} /> Erase
      </div>

      {/* controls */}
      {annotate.mode === "draw" && (
        <div className="relative group">
          <input
            type="color"
            value={annotate.color}
            onChange={(e) => setBrushColor(e.target.value)}
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
            style={{ backgroundColor: annotate.color }}
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
        onClick={() => hasAny && clearAllPanes()}
        title="Clear all"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none btn-width justify-center transition
                    ${
                      hasAny
                        ? "bg-neutral-800 text-neutral-300 hover:bg-red-600/80 hover:border-red-500 hover:text-black cursor-pointer"
                        : "bg-neutral-800/60 text-neutral-700 cursor-not-allowed"
                    }`}
      >
        <Trash2 size={16} />
        Clear
      </div>

      {/* <button
        onClick={toggleGrid}
        title="Grid (#)"
        className={`px-2 py-1 rounded flex items-center gap-1 ${t.grid.on ? "bg-blue-700/60 hover:bg-blue-700" : "bg-neutral-800 hover:bg-neutral-700"}`}>
        <LayoutGrid size={16}/> Grid
      </button>
      <button
        onClick={() => setGridSize(t.grid.size === 32 ? 64 : t.grid.size === 64 ? 16 : 32)}
        title={`Grid size: ${t.grid.size}px`}
        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">
        {t.grid.size}px
      </button> */}

      {/* </div> */}
      {/* <div className="ml-auto" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Camera size={16}/> Snapshot</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Sun size={16}/></button> */}
    </div>
  );
}
