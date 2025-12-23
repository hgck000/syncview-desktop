import { Link2, Maximize, Search, Trash2, ImageIcon } from "lucide-react";
import { useApp } from "../app/store";
import { openFileDialog } from "../app/bridge";
// import { useRef, useState  } from "react";

export default function Toolbar() {
  // const t = useApp(s => s.getActive());
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
  const clearAllPanes = useApp((s) => s.clearAllPanes);
  const hasAny = !!t?.panes?.length;
  // const setLoupeZoom = useApp(s => s.setLoupeZoom);

  // const handleOpen = async () => {
  //   const paneId = focusedPaneId; // lấy từ store/hook
  //   const paths = await openFileDialog(paneId);
  //   if (!paths) return;
  //   useApp.getState().addFilesToActiveTabFromDialog(paths, paneId);
  // };

  // async function onOpen() {
  //   // nếu chưa có pane nào, chọn slot trống đầu tiên (A/B/C/D)
  //   const target = t.panes.length ? t.panes[t.focusIndex] : nextEmpty() ?? "D";
  //   console.log("[UI] Open -> target pane =", target);
  //   const path = await openFileDialog(target);
  //   if (path) setFileForPane(target, path);
  //   if (!path) return;
  // }

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
  // function on100() {
  //   const id = activePane(); if (!id) return;
  //   applyZoom(id, 2, { type: 'norm', u: 0.5, v: 0.5 });
  // }

  return (
    // <div className="h-10 flex items-center px-3 text-sm border-b border-neutral-800"></div>
    <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-800 bg-neutral-900 text-black text-sm">
      <div
        onClick={onOpen}
        title="Open (Ctrl/Cmd+O)"
        className="px-2 py-1 rounded flex items-center gap-1
                  bg-neutral-800 hover:bg-neutral-700 text-neutral-300
                  cursor-pointer select-none transition btn-width justify-center"
      >
        <ImageIcon size={16} /> Open
      </div>

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
        <Link2 size={16} />
        {t.linkAll ? "Linked" : "Link"}
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
        title="Loupe (F)"
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
      {/* <button onClick={on100} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">100%</button> */}
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

      {/* <button
        onClick={() => setLoupeSize(t.loupe.size >= 240 ? 160 : t.loupe.size + 40)}
        title={`Size: ${t.loupe.size}px`}
        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-xs">
        {t.loupe.size}px
      </button> */}

      {/* </div> */}
      {/* <div className="ml-auto" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Camera size={16}/> Snapshot</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Sun size={16}/></button> */}
    </div>
  );
}
