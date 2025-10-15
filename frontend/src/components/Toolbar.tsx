import { Link2, LayoutGrid, Maximize, RefreshCw, Hash, Camera, Sun, Image as ImageIcon } from "lucide-react";
import { useApp } from "../app/store";
import { openFileDialog } from "../app/bridge";
import { useRef } from "react";

export default function Toolbar() {
  const t = useApp(s => s.getActive());
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  const setFileForPane= useApp(s => s.setFileForPane);
  const nextEmpty     = useApp(s => s.nextEmptyPaneId);
  const resetView     = useApp(s => s.resetView);
  const applyZoom     = useApp(s => s.applyZoom);

  async function onOpen() {
    // nếu chưa có pane nào, chọn slot trống đầu tiên (A/B/C/D)
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
  function on100() {
    const id = activePane(); if (!id) return;
    // phóng x2 so với fit cho nhanh (mốc 100% tùy định nghĩa, tạm x2)
    // applyZoom(id, 2);
    applyZoom(id, 2, { type: 'norm', u: 0.5, v: 0.5 });
  }
  function onReset() {
    const id = activePane(); if (!id) return;
    resetView(id);
  }

  return (
    <div className="h-12 flex items-center gap-2 px-3 border-b border-neutral-800 bg-neutral-900 text-black">
      <button onClick={onOpen} title="Open (Ctrl/Cmd+O)"
        className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1">
        <ImageIcon size={16}/> Open
      </button>

      <button onClick={toggleLinkAll}
        className={`px-2 py-1 rounded flex items-center gap-1 ${t.linkAll ? "bg-blue-700/60 hover:bg-blue-700" : "bg-neutral-800 hover:bg-neutral-700"}`}>
        <Link2 size={16}/> {t.linkAll ? "Linked" : "Link"}
      </button>

      {/* <div className="w-px h-6 bg-neutral-800" /> */}

      {/* <button onClick={toggleLinkAll}
        className={`px-2 py-1 rounded flex items-center gap-1 ${t.linkAll ? "bg-blue-700/60 hover:bg-blue-700" : "bg-neutral-800 hover:bg-neutral-700"}`}>
        <Link2 size={16}/> {t.linkAll ? "Linked" : "Link"}
      </button> */}

      {/* <div className="w-px h-6 bg-neutral-800" /> */}

      <button onClick={onFit} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Maximize size={16}/> Fit</button>
      <button onClick={on100} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">100%</button>
      <button onClick={onReset} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><RefreshCw size={16}/></button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Hash size={16}/></button>

      <div className="ml-auto" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Camera size={16}/> Snapshot</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Sun size={16}/></button>
    </div>
  );
}
