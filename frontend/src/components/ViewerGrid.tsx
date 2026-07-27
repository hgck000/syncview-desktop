/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import Pane from "./Pane";
import { useApp, type PaneId } from "../app/store";
import DropZone from "./DropZone";
import ComparisonRail from "./ComparisonRail";

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-1 px-2 py-0.5 bg-neutral-900 rounded text-[11px] text-neutral-200 border border-neutral-700">
      {children}
    </span>
  );
}

// Chỉ bật overlay khi đang kéo FILE và con trỏ đang nằm trong vùng ViewerGrid
function useFileDragOver(ref: React.RefObject<HTMLElement | null>) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const isFile = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const isInsideByPoint = (e: DragEvent) => {
      const el = ref.current;
      if (!el) return false;
      // clientX/Y có trên DragEvent trong browser
      const x = (e as any).clientX ?? 0;
      const y = (e as any).clientY ?? 0;
      const top = document.elementFromPoint(x, y);
      return !!top && el.contains(top);
    };

    const onDragEnter = (e: DragEvent) => {
      if (!isFile(e)) return;
      // chỉ tăng depth khi đang nằm trong vùng
      if (!isInsideByPoint(e)) return;
      depth.current += 1;
      setOver(true);
    };

    const onDragLeave = (e: DragEvent) => {
      if (!isFile(e)) return;

      // nếu con trỏ vẫn nằm trong vùng thì bỏ qua (tránh flicker)
      if (isInsideByPoint(e)) return;

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
        "pointer-events-none absolute inset-0 z-40",
        "border border-neutral-500/40",
        "bg-neutral-950/55 backdrop-blur-sm",
        "flex items-center justify-center",
        "transition-opacity",
        show
          ? "opacity-100 duration-400 ease-out"
          : "opacity-0 duration-400 ease-in",
      ].join(" ")}
    >
      <div className="text-center px-4">
        <div className="text-neutral-100 text-base font-semibold">
          Drop photos to add to workspace
        </div>
        {needsTab && (
          <div className="mt-3 text-neutral-300 text-sm">
            <span className="px-2 py-0.5 bg-neutral-900 rounded border border-neutral-700">
              Create a new tab first
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewerGrid() {
  const has = useApp((s) => s.hasActive());
  const panes = useApp((s) => s.getActiveSafe().panes);
  const layout = useApp((s) => s.getActiveSafe().layout);
  const comparison = useApp((s) => s.getActiveSafe().comparison);
  const setBlinkPane = useApp((s) => s.setBlinkPane);
  const setReferenceCandidate = useApp((s) => s.setReferenceCandidate);
  const n = panes.length;

  const rootRef = useRef<HTMLDivElement>(null);
  const dragOver = useFileDragOver(rootRef);

  // Quy tắc lưới:
  // - Mặc định (layout = auto): 1→1 cột, 2→2 cột, 3→3 cột, 4→2x2
  // - Khi layout = row1x4 và đang có 4 pane: 1 hàng x 4 cột
  const gridBase = "h-full p-1 gap-1 bg-neutral-950 grid auto-rows-fr";

  const gridClass =
    n === 1
      ? `${gridBase} grid-cols-1`
      : n === 2
      ? `${gridBase} grid-cols-2`
      : n === 3
      ? `${gridBase} grid-cols-3`
      : layout === "row1x4"
      ? `${gridBase} grid-cols-4 grid-rows-1`
      : `${gridBase} grid-cols-2 grid-rows-2`;

  useEffect(() => {
    if (comparison.mode !== "blink") return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable ||
        target?.getAttribute("role") === "textbox";
      if (editable || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!/^[1-4]$/.test(event.key)) return;

      const pane = panes[Number(event.key) - 1];
      if (!pane) return;
      event.preventDefault();
      event.stopPropagation();
      setBlinkPane(pane);
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [comparison.mode, panes, setBlinkPane]);

  const emptyState = !has ? (
    <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-1">
      <div className="text-neutral-500 text-[17px]">
        Create a new tab first
      </div>
      <div className="text-neutral-400 text-sm text-[13px]">
        Press <Keycap>H</Keycap> for guide
      </div>
    </div>
  ) : (
    <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-1">
      <div className="text-neutral-400 text-[17px]">
        Drag/Drop or Open to import images
      </div>
      <div className="text-neutral-500 text-sm text-[13px]">
        Supports up to four images in each tab
      </div>
    </div>
  );

  function stackedPane(pane: PaneId, visible: boolean) {
    return (
      <div
        key={pane}
        aria-hidden={!visible}
        className={[
          "absolute inset-0 [&>div]:h-full",
          visible
            ? "visible z-10 opacity-100 pointer-events-auto"
            : "invisible z-0 opacity-0 pointer-events-none",
        ].join(" ")}
      >
        <Pane id={pane} suspended={!visible} />
      </div>
    );
  }

  function comparisonContent() {
    if (comparison.mode === "blink" && panes.length >= 2) {
      const activePane =
        comparison.activePane && panes.includes(comparison.activePane)
          ? comparison.activePane
          : panes[0];

      return (
        <div className="h-full min-h-0 flex bg-neutral-950">
          <div className="min-w-0 flex-1 p-1">
            <div
              className="relative h-full min-h-0"
              data-role="viewer-grid"
            >
              {panes.map((pane) =>
                stackedPane(pane, pane === activePane),
              )}
            </div>
          </div>
          <ComparisonRail
            panes={panes}
            activePane={activePane}
            slotCount={4}
            showShortcuts
            onSelect={setBlinkPane}
          />
        </div>
      );
    }

    if (comparison.mode === "reference") {
      const referencePane = comparison.referencePane;
      if (!referencePane || !panes.includes(referencePane)) return null;

      const candidates = panes.filter((pane) => pane !== referencePane);
      const candidatePane =
        comparison.candidatePane &&
        candidates.includes(comparison.candidatePane)
          ? comparison.candidatePane
          : candidates[0];

      return (
        <div className="h-full min-h-0 flex bg-neutral-950">
          <div
            className="min-w-0 flex-1 grid grid-cols-2 gap-1 p-1"
            data-role="viewer-grid"
          >
            <div className="relative min-h-0 [&>div]:h-full">
              <Pane id={referencePane} />
            </div>

            <div className="relative min-h-0">
              {candidates.length ? (
                candidates.map((pane) =>
                  stackedPane(pane, pane === candidatePane),
                )
              ) : (
                <div className="absolute inset-0 rounded border border-dashed border-neutral-800 bg-neutral-900 flex items-center justify-center text-sm text-neutral-500">
                  No image available for comparison
                </div>
              )}
            </div>
          </div>

          <ComparisonRail
            panes={candidates}
            activePane={candidatePane}
            slotCount={3}
            onSelect={setReferenceCandidate}
          />
        </div>
      );
    }

    return null;
  }

  const activeComparison = comparisonContent();

  return (
    <DropZone>
      <div ref={rootRef} className="h-full relative">
        {!has || n === 0 ? (
          emptyState
        ) : activeComparison ? (
          activeComparison
        ) : (
          <div className={gridClass} data-role="viewer-grid">
            {panes.map((id) => (
              <Pane key={id} id={id} />
            ))}
          </div>
        )}

        <DragOverlay show={dragOver} needsTab={!has} />
      </div>
    </DropZone>
  );
}
