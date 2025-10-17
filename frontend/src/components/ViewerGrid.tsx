import Pane from "./Pane";
import { useApp } from "../app/store";
import DropZone from "./DropZone";

export default function ViewerGrid() {
  const { tabs, activeTabId } = useApp();
  const tab = tabs.find(t => t.id === activeTabId)!;
  const n = tab.panes.length;

  if (n === 0) {
    return (
      <DropZone>
        <div className="h-full flex items-center justify-center text-neutral-500">
          Kéo-thả 1–4 ảnh vào đây hoặc bấm <span className="mx-1 px-1.5 py-0.5 bg-neutral-800 rounded">Open</span>
        </div>
      </DropZone>
    );
  }

  // Quy tắc lưới mới: 1→1 cột, 2→2 cột, 3→3 cột, 4→2x2
  const gridBase = "h-full p-1 gap-1 bg-neutral-950 grid auto-rows-fr";
  const gridClass =
    n === 1 ? `${gridBase} grid-cols-1` :
    n === 2 ? `${gridBase} grid-cols-2` :
    n === 3 ? `${gridBase} grid-cols-3` :
              `${gridBase} grid-cols-2 grid-rows-2`;

  return (
    <DropZone>
      <div className={gridClass}>
        {tab.panes.map((id) => <Pane key={id} id={id} />)}
      </div>
    </DropZone>
  );
}
