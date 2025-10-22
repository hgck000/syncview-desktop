import { Link2, Maximize, Search, Trash2, ImageIcon } from "lucide-react";
import { useApp } from "../app/store";
import { openFileDialog } from "../app/bridge";

export default function Toolbar() {
  const t = useApp(s => s.getActiveSafe());
  const setFileForPane = useApp(s => s.setFileForPane);
  const nextEmpty = useApp(s => s.nextEmptyPaneId);
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  const resetView = useApp(s => s.resetView);
  const toggleLoupe = useApp(s => s.toggleLoupe);
  const clearAllPanes = useApp(s => s.clearAllPanes);
  const hasAny = !!(t?.panes?.length);

  async function onOpen() {
    const target = t.panes.length ? t.panes[t.focusIndex] : (nextEmpty() ?? "D");
    console.log("[UI] Open -> target pane =", target);
    const path = await openFileDialog(target);
    if (path) setFileForPane(target, path);
  }

  function activePane() { return t.panes[t.focusIndex]; }

  function onFit() {
    const id = activePane(); if (!id) return;
    resetView(id);
  }

  return (
    <div className="h-10 flex items-center gap-2 px-3 border-b border-neutral-800 bg-neutral-900 text-black text-sm">
      <div onClick={onOpen} title="Open (O)"
        className="px-2 py-1 rounded flex items-center gap-1
                  bg-neutral-800 hover:bg-neutral-700 text-neutral-300
                  cursor-pointer select-none transition">
        <ImageIcon size={16}/> Open
      </div>

      {/* Link All */}
      <div
        onClick={toggleLinkAll}
        title="Link (E)"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none cursor-pointer transition
                    ${t.linkAll
                      ? "bg-blue-600/60 hover:bg-blue-600 text-white"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"}`}
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
                  cursor-pointer select-none transition"
      >
        <Maximize size={16} />
        Fit
      </div>

      {/* Loupe */}
      <div
        onClick={toggleLoupe}
        title="Loupe (F)"
        className={`px-2 py-1 rounded flex items-center gap-1 select-none cursor-pointer transition
                    ${t.loupe.on
                      ? "bg-blue-600/60 hover:bg-blue-600 text-white"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"}`}
      >
        <Search size={16} />
        Loupe
      </div>

      {/* Clear All */}
      <div
        onClick={() => hasAny && clearAllPanes()}
        title="Clear all"
        className={`px-2 py-1 rounded flex items-center gap-1 border select-none transition
                    ${hasAny
                      ? "bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-red-600/80 hover:border-red-500 hover:text-black cursor-pointer"
                      : "bg-neutral-800/60 border-neutral-800 text-neutral-700 cursor-not-allowed"}`}
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
