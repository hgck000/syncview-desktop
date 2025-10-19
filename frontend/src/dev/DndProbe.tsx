import React, { useState } from "react";
import {
  DndContext, closestCenter, type DragStartEvent, type DragEndEvent,
  MouseSensor, TouchSensor, useSensor, useSensors
} from "@dnd-kit/core";
import { useSortable, SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SItem({ id }: { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: 8,
    border: "1px solid #999",
    borderRadius: 6,
    marginRight: 8,
    cursor: isDragging ? "grabbing" : "grab",
    userSelect: "none",
    touchAction: "none",
    background: isDragging ? "#eef" : "#fafafa",
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {id}
    </div>
  );
}

export default function DndProbe() {
  const [items, setItems] = useState(["probe-1", "probe-2", "probe-3"]);

  // dùng Mouse + Touch sensor (ổn định trong PyWebview)
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance: 2 } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 60, tolerance: 6 } });
  const sensors = useSensors(mouse, touch);

  const onDragStart = (e: DragStartEvent) => {
    console.log("[Probe] start", e.active.id);
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.indexOf(String(active.id));
    const to   = items.indexOf(String(over.id));
    if (from < 0 || to < 0) { console.log("[Probe] end index missing", { active: active.id, over: over.id }); return; }
    const next = items.slice(); const [m] = next.splice(from, 1); next.splice(to, 0, m);
    setItems(next);
    console.log("[Probe] reorder", { from, to, items: next });
  };

  return (
    <div style={{ padding: 8, border: "1px dashed #bbb", margin: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 8 }}>Dnd Probe – kéo các ô để thử</div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <SortableContext items={items} strategy={horizontalListSortingStrategy}>
          <div style={{ display: "flex" }}>
            {items.map(id => <SItem key={id} id={id} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
