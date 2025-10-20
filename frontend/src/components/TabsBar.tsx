import React from "react";
import {
  DndContext,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy, // tabs dọc
  // horizontalListSortingStrategy, // nếu tabs ngang thì dùng cái này
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// chỉnh path store theo dự án
import { useApp } from "../app/store";

function SortableRow({
  id,
  active,
  name,
  onActivate,
  onClose,
}: {
  id: string;
  active: boolean;
  name: string;
  onActivate: () => void;
  onClose: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer ${
        active ? "bg-neutral-800 border border-neutral-700" : "hover:bg-neutral-800/60"
      }`}
      onClick={onActivate}
    >
      {/* Handle kéo: chính node “name” */}
      <div className="truncate text-sm flex-1" {...attributes} {...listeners}>
        {name}
      </div>

      <button
        className="close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  );
}

export default function TabsBar() {
  const tabs = useApp((s) => s.tabs);
  const activeTabId = useApp((s) => s.activeTabId);
  const setActiveTab = useApp((s) => s.setActiveTab);
  const closeTab = useApp((s) => s.closeTab);
  const reorderTabs = useApp((s) => s.reorderTabs);

  // Sensors ổn định (đã pass ở Probe)
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: 2 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 60, tolerance: 6 } });
  const sensors = useSensors(mouse, touch);

  const items = tabs.map((t) => String(t.id));

  const onDragStart = (e: DragStartEvent) => {
    void e
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(String(active.id));
    const to = items.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderTabs(from, to);
    // nếu muốn log trong dev:
    // console.debug("[Tabs] dnd reorder", { from, to });
  };

  // Tabs dọc
  const strategy = verticalListSortingStrategy;
  // Nếu tabs NGANG:
  // const strategy = horizontalListSortingStrategy;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={items} strategy={strategy}>
        <div className="space-y-1 mb-4 text-white">
          {tabs.map((t) => (
            <SortableRow
              key={String(t.id)}
              id={String(t.id)}
              active={t.id === activeTabId}
              name={t.name}
              onActivate={() => setActiveTab(t.id)}
              onClose={() => closeTab(t.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
