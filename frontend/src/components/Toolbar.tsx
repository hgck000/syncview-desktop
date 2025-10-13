import { Link2, LayoutGrid, Maximize, RefreshCw, Hash, Camera, Sun, Image as ImageIcon } from "lucide-react";
import { useApp } from "../app/store";

export default function Toolbar() {
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  const cycleLayout   = useApp(s => s.cycleLayout);
  const setLayout     = useApp(s => s.setLayout);
  const t = useApp(s => s.getActive());

  return (
    <div className="h-12 flex items-center gap-2 px-3 border-b border-neutral-800 bg-neutral-900 text-black">
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1">
        <ImageIcon size={16}/> Open
      </button>

      <div className="w-px h-6 bg-neutral-800" />

      <button onClick={toggleLinkAll}
        className={`px-2 py-1 rounded flex items-center gap-1 ${t.linkAll ? "bg-blue-700/60 hover:bg-blue-700" : "bg-neutral-800 hover:bg-neutral-700"}`}>
        <Link2 size={16}/> {t.linkAll ? "Linked" : "Link"}
      </button>

      <button onClick={cycleLayout} className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1">
        <LayoutGrid size={16}/> Layout
      </button>

      <div className="w-px h-6 bg-neutral-800" />

      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1">
        <Maximize size={16}/> Fit
      </button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">100%</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><RefreshCw size={16}/></button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Hash size={16}/></button>

      <div className="ml-auto" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Camera size={16}/> Snapshot</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Sun size={16}/></button>
    </div>
  );
}
