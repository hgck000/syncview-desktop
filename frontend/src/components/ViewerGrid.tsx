import Pane from "./Pane";
import { useApp } from "../app/store";

export default function ViewerGrid() {
  const { tabs, activeTabId } = useApp();
  const tab = tabs.find(t => t.id === activeTabId)!;
  const n = tab.panes.length;

  // Quy tắc grid
  const gridClass =
    n === 4
      ? "grid grid-cols-2 grid-rows-2 gap-1"
      : "grid grid-cols-3 auto-rows-[1fr] gap-1";

  return (
    <div className={`h-full p-1 ${gridClass} bg-neutral-950`}>
      {tab.panes.map((id) => (
        <Pane key={id} id={id} />
      ))}
      {/* placeholder ô trống cho đủ lưới */}
      {n < 4 && Array.from({ length: 3 - ((n - 1) % 3) - 1 }).map((_, i) => (
        <div key={i} className="hidden md:block" />
      ))}
    </div>
  );
}
