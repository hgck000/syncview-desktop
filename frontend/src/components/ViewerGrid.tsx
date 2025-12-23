import { useEffect, useRef, useState } from "react";
import Pane from "./Pane";
import { useApp } from "../app/store";
import DropZone from "./DropZone";

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 px-2 py-0.5 bg-neutral-900 rounded text-[11px] text-neutral-200 border border-neutral-700">
      {children}
    </span>
  );
}

// Chỉ bật overlay khi đang kéo FILE và con trỏ đang nằm trong vùng ViewerGrid
function useFileDragOver(ref: React.RefObject<HTMLElement>) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const isFile = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const within = (e: DragEvent) => {
      const el = ref.current;
      return !!el && e.target instanceof Node && el.contains(e.target);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!isFile(e) || !within(e)) return;
      depth.current += 1;
      setOver(true);
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isFile(e) || !within(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    };

    const onDrop = () => {
      depth.current = 0;
      setOver(false);
    };

    const onDragEnd = () => {
      depth.current = 0;
      setOver(false);
    };

    window.addEventListener("dragenter", onDragEnter, { capture: true });
    window.addEventListener("dragleave", onDragLeave, { capture: true });
    window.addEventListener("drop", onDrop, { capture: true });
    window.addEventListener("dragend", onDragEnd, { capture: true });

    return () => {
      window.removeEventListener("dragenter", onDragEnter, {
        capture: true,
      } as any);
      window.removeEventListener("dragleave", onDragLeave, {
        capture: true,
      } as any);
      window.removeEventListener("drop", onDrop, { capture: true } as any);
      window.removeEventListener("dragend", onDragEnd, {
        capture: true,
      } as any);
    };
  }, [ref]);

  return over;
}

function DragOverlay({ show, needsTab }: { show: boolean; needsTab: boolean }) {
  return (
    <div
      className={[
        "pointer-events-none absolute inset-2 rounded-xl",
        "border border-dashed border-neutral-500/40",
        "bg-neutral-950/55 backdrop-blur-sm",
        "flex items-center justify-center",
        "transition-all duration-200 ease-out",
        show ? "opacity-100 scale-100" : "opacity-0 scale-[0.99]",
      ].join(" ")}
    >
      <div className="text-center px-4">
        <div className="text-neutral-100 text-base font-semibold">
          Thả ảnh để thêm vào workspace
        </div>

        {/* <div className="mt-2 text-neutral-400 text-sm">
          Nhấn <Keycap>H</Keycap> để mở hướng dẫn
        </div> */}

        {needsTab && (
          <div className="mt-3 text-neutral-300 text-sm">
            <span className="px-2 py-0.5 bg-neutral-900 rounded border border-neutral-700">
              Tạo tab mới trước
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewerGrid() {
  const t = useApp((s) => s.getActiveSafe());
  const has = useApp((s) => s.hasActive());
  const n = t.panes.length;

  const rootRef = useRef<HTMLDivElement>(null);
  const dragOver = useFileDragOver(rootRef);

  // Quy tắc lưới mới: 1→1 cột, 2→2 cột, 3→3 cột, 4→2x2
  const gridBase = "h-full p-1 gap-1 bg-neutral-950 grid auto-rows-fr";
  const gridClass =
    n === 1
      ? `${gridBase} grid-cols-1`
      : n === 2
      ? `${gridBase} grid-cols-2`
      : n === 3
      ? `${gridBase} grid-cols-3`
      : `${gridBase} grid-cols-2 grid-rows-2`;

  const needsTab = !has || n === 0;

  return (
    <DropZone>
      <div ref={rootRef} className="h-full relative">
        {needsTab ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-1">
            <div className="text-neutral-500 text-[17px]">
              Kéo-thả 1–4 ảnh vào đây
              {!has && (
                <span className="mx-2 px-2 py-0.5 bg-neutral-900 rounded text-[11px] text-neutral-300 border border-neutral-800">
                  Tạo tab mới trước
                </span>
              )}
            </div>
            <div className="text-neutral-400 text-sm text-[13px]">
              Nhấn <Keycap>H</Keycap> để mở hướng dẫn
            </div>
          </div>
        ) : (
          <div className={gridClass}>
            {t.panes.map((id) => (
              <Pane key={id} id={id} />
            ))}
          </div>
        )}

        <DragOverlay show={dragOver} needsTab={!has} />
      </div>
    </DropZone>
  );
}
