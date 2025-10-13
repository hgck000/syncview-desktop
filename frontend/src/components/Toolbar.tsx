import { Link2, LayoutGrid, MoveHorizontal, Image as ImageIcon, Maximize, RefreshCw, Hash, Camera, Sun } from "lucide-react";

export default function Toolbar() {
  return (
    <div className="h-12 flex items-center gap-2 px-3 border-b border-neutral-800 bg-neutral-900 text-black">
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><ImageIcon size={16}/> Open</button>
      <div className="w-px h-6 bg-neutral-800" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Link2 size={16}/> Link</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><LayoutGrid size={16}/> Layout</button>
      <div className="w-px h-6 bg-neutral-800" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Maximize size={16}/> Fit</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700">100%</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><RefreshCw size={16}/></button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Hash size={16}/></button>
      <div className="ml-auto" />
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1"><Camera size={16}/> Snapshot</button>
      <button className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"><Sun size={16}/></button>
    </div>
  );
}
