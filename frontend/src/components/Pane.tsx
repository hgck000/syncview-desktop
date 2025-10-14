import { useApp } from "../app/store";
import { basename } from "../app/path";
import { useImageCanvas } from "../app/useImageCanvas";

type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  const t = useApp(s => s.getActive());
  const idx = t.panes.indexOf(id);
  const focused = idx === t.focusIndex;
  const path = t.files[id];
  const data = t.dataURL[id];
  const label = t.names[id] ?? basename(path) ?? `${id}: Empty`;
  const canvasRef = useImageCanvas({ path, dataURL: data });
  
  // const name = basename(path) ?? `${id}: Empty`;

  return (
    // <div className={`relative min-h-0 bg-neutral-900 border rounded ${focused ? "border-blue-600" : "border-neutral-800"}`}>
    <div className={`relative min-h-0 bg-neutral-900 border rounded overflow-hidden ${focused ? "border-blue-600" : "border-neutral-800"}`}>
      <div className="absolute top-0 left-0 right-0 h-7 px-2 flex items-center justify-between bg-neutral-900/90 border-b border-neutral-800 text-xs z-10">
        <div className="truncate">{label}</div>
        <button className="text-neutral-400 hover:text-neutral-200">Details ▾</button>
      </div>


      <div className="h-full min-h-[180px] pt-7">
        {path || data ? (
          <canvas ref={canvasRef} className="w-full h-full block bg-black" />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 select-none">Empty • {id}</div>
        )}
      </div>
    </div>
  );
}
