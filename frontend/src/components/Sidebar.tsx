/* eslint-disable @typescript-eslint/no-explicit-any */
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import { basename } from "../app/path";
import {
  Pencil,
  ImageUp,
  X,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  AppWindow,
} from "lucide-react";
import React, { useState } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy, // dùng list dọc
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableTabRow({
  t,
  active,
  onActivate,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onClose,
  editingId,
  buf,
  setBuf,
  dragging,
}: {
  t: { id: string; name: string };
  active: boolean;
  onActivate: () => void;
  onRenameStart: () => void;
  onRenameCommit: (next: string) => void;
  onRenameCancel: () => void;
  onClose: () => void;
  editingId: string | null;
  buf: string;
  setBuf: (s: string) => void;
  dragging: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(t.id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
  };

  const isEditing = editingId === t.id;
  const dragBind = isEditing ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(dragBind as any)}
      className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer
        ${
          active
            ? "bg-neutral-800 border border-neutral-700"
            : "hover:bg-neutral-800/60"
        }`}
      onClick={onActivate}
    >
      {isEditing ? (
        <input
          autoFocus
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-sm w-full"
          value={buf}
          onChange={(e) => setBuf(e.target.value)}
          onKeyDown={(e) => {
            // chặn hotkeys khi rename (giữ nguyên hành vi cũ)
            e.stopPropagation();
            if (e.key === "Enter") onRenameCommit(buf || t.name);
            if (e.key === "Escape") onRenameCancel();
          }}
          onBlur={() => onRenameCommit(buf || t.name)}
        />
      ) : (
        <>
          {/* Handle kéo: CHÍNH node name — chỉ gắn listeners khi KHÔNG editing */}
          <div className="truncate text-sm flex-1"> {t.name}</div>

          <div
            className={`flex items-center gap-1 transition-opacity ${
              isDragging || dragging
                ? "opacity-0 pointer-events-none"
                : "opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRenameStart();
              }}
              className="p-1 rounded hover:bg-neutral-700"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5 text-black" />
            </button>
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded hover:bg-neutral-700"
              title="Close"
            >
              <X className="w-3.5 h-3.5 text-black" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function Sidebar({
  compact = false,
  showFull = true,
  fullFadeIn = true,
  isPeek = false,
  isPinned = true,
  onPinOpen,
  onCollapsePinned,
}: {
  compact?: boolean;
  showFull?: boolean;
  fullFadeIn?: boolean;
  isPeek?: boolean; // đang bung do hover (chưa ghim)
  isPinned?: boolean; // đang mở cố định
  onPinOpen?: () => void;
  onCollapsePinned?: () => void;
}) {
  const { tabs, setLeftSplit } = useApp();
  const tab = useApp((s) => s.getActiveSafe());
  // const has = useApp(s => s.hasActive());
  const leftSplit = tab?.sizes?.leftSplit ?? 60;
  const paneIds = tab?.panes ?? [];
  const activeId = useApp((s) => s.activeTabId);
  const setActive = useApp((s) => s.setActiveTab);
  const renameTab = useApp((s) => s.renameTab);
  const closeTab = useApp((s) => s.closeTab);
  const [editing, setEditing] = useState<string | null>(null);
  const [buf, setBuf] = useState("");

  // tốc độ kích hoạt kéo (nhanh hơn)
  const mouse = useSensor(MouseSensor, {
    activationConstraint: { distance: 1 }, // kéo gần như ngay
  });
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: 0, tolerance: 4 }, // bỏ trễ touch
  });
  const sensors = useSensors(mouse, touch);

  // trạng thái kéo để ẩn nút sửa/xóa toàn bộ trong lúc kéo
  const [dragging, setDragging] = React.useState(false);
  const items = tabs.map((tt) => String(tt.id));

  const compactUI = (
    <div className="h-full bg-neutral-900 border-r border-neutral-800 flex flex-col">
      {/* header icon */}
      <div className="h-10 border-b border-neutral-800 flex items-center justify-center">
        <AppWindow className="h-5 w-5 custom-icon" />
      </div>

      {/* tabs icons */}
      <div className="flex-1 overflow-auto py-2 flex flex-col items-center gap-2">
        {/* ... phần tabs icon-only của bạn ... */}
        {tabs.map((t, idx) => {
          const isActive = t.id === activeId;
          const label = (t.name?.trim()?.[0] || String(idx + 1)).toUpperCase();
          return (
            <div
              key={t.id}
              title={t.name}
              onClick={() => setActive(t.id)}
              className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs
                cursor-pointer select-none active:scale-95 transition
                ${
                  isActive
                    ? "bg-neutral-800 border-neutral-600 text-white"
                    : "bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
                }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* images icons */}
      <div className="border-t border-neutral-800 py-2 flex flex-col items-center gap-2">
        {/* ... phần pane icons A/B/C/D ... */}
        {paneIds.map((pid, i) => {
          const has = !!tab.files[pid] || !!tab.dataURL[pid];
          return (
            <div
              key={pid}
              title={pid}
              onClick={() => useApp.getState().setFocusIndex(i)}
              className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs
                cursor-pointer select-none active:scale-95 transition
                ${
                  has
                    ? "bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-800/80"
                    : "bg-neutral-900 border-dashed border-neutral-800 text-neutral-600 hover:bg-neutral-900/70"
                }`}
            >
              {pid}
            </div>
          );
        })}
      </div>
    </div>
  );
  const fullUI = (
    <div className="h-full bg-neutral-900 border-neutral-800">
      <div className="h-10 flex items-center px-3 text-sm border-b border-neutral-800">
        <span className="font-medium text-neutral-400">Workspace</span>
        <div className="ml-auto flex items-center gap-1">
          {/* Peek -> show PIN icon; Pinned -> show COLLAPSE icon */}
          {isPeek ? (
            <div
              onClick={onPinOpen}
              className="flex items-center justify-center w-6 h-6 rounded-md
                         text-neutral-400 hover:text-white hover:bg-white/10
                         active:scale-95 cursor-pointer transition"
              title="Ghim sidebar"
            >
              <ChevronsRight className="h-4 w-4" />
            </div>
          ) : isPinned ? (
            <div
              onClick={onCollapsePinned}
              className="flex items-center justify-center w-6 h-6 rounded-md
                         text-neutral-400 hover:text-white hover:bg-white/10
                         active:scale-95 cursor-pointer transition"
              title="Thu nhỏ sidebar"
            >
              <ChevronsLeft className="h-4 w-4" />
            </div>
          ) : null}

          {/* nút New Tab chỉ hiện ở FULL UI như cũ */}
          <div
            onClick={() => useApp.getState().newTab()}
            className="flex items-center justify-center w-6 h-6 rounded-md
                       text-neutral-400 hover:text-white hover:bg-white/10
                       active:scale-95 cursor-pointer transition"
            title="New Tab"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
          </div>
        </div>
      </div>
      <PanelGroup direction="vertical" onLayout={([top]) => setLeftSplit(top)}>
        {/* Khu TAB dọc + workspace controls */}
        <Panel defaultSize={leftSplit} minSize={30}>
          {(() => {
            const onDragStart = (_e: DragStartEvent) => {
              void _e;
              setDragging(true);
            };
            const onDragEnd = (e: DragEndEvent) => {
              setDragging(false);
              const { active, over } = e;
              if (!over || active.id === over.id) return;
              const from = items.indexOf(String(active.id));
              const to = items.indexOf(String(over.id));
              if (from < 0 || to < 0) return;
              // dùng action reorderTabs trong store (đã thêm ở bước trước)
              useApp.getState().reorderTabs(from, to);
            };
            return (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={items}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1 mb-4 text-white">
                    {tabs.map((t) => {
                      const active = t.id === activeId;
                      return (
                        <SortableTabRow
                          key={t.id}
                          t={t}
                          active={active}
                          onActivate={() => setActive(t.id)}
                          onRenameStart={() => {
                            setEditing(t.id);
                            setBuf(t.name);
                          }}
                          onRenameCommit={(next) => {
                            renameTab(t.id, next);
                            setEditing(null);
                          }}
                          onRenameCancel={() => setEditing(null)}
                          onClose={() => closeTab(t.id)}
                          editingId={editing}
                          buf={buf}
                          setBuf={setBuf}
                          dragging={dragging}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            );
          })()}
        </Panel>
        <PanelResizeHandle className="h-1 bg-neutral-700/50 hover:bg-neutral-600 cursor-row-resize" />
        {/* IMAGE PANEL CONTROL BOX */}
        <Panel minSize={20}>
          <div className="h-full p-3 border-t border-neutral-800">
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Images in this tab
            </div>
            {!tab && (
              <div className="p-3 rounded border border-dashed border-neutral-800/70 bg-neutral-900/30 text-neutral-600 text-sm">
                (Trống)
              </div>
            )}
            {tab && paneIds.length === 0 && (
              <div className="p-3 rounded border border-neutral-800 bg-neutral-900/50 text-neutral-300 text-sm">
                Chưa có ảnh nào trong tab này.
              </div>
            )}
            {tab &&
              paneIds.length > 0 &&
              (() => {
                const tb = tab!;
                return (
                  <div className="space-y-1 overflow-auto pr-1">
                    {paneIds.map((pid, i) => {
                      const hasFile = !!tb.files?.[pid];
                      const hasData = !!tb.dataURL?.[pid];
                      const name =
                        tb.names?.[pid] ??
                        (hasFile
                          ? basename(tb.files![pid]!)
                          : hasData
                          ? "(dropped image)"
                          : `${pid}: Empty`);
                      return (
                        <div
                          key={`${tb.id}-${pid}`}
                          onClick={() => useApp.getState().setFocusIndex(i)}
                          title={name}
                          className={`w-full px-2 py-1 rounded border text-left text-xs select-none cursor-pointer transition
                          ${
                            hasFile || hasData
                              ? "border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300"
                              : "border-dashed border-neutral-700 text-neutral-500 hover:bg-neutral-800/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ImageUp className="h-4 w-4 opacity-80 shrink-0" />
                            <span className="truncate max-w-[180px] inline-block align-middle text-sm">
                              {name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
  return (
    <div className="h-full relative">
      {/* Compact luôn nằm dưới (chỉ render khi compact=true) */}
      {compact && compactUI}

      {/* Full overlay nằm trên, render khi showFull=true */}
      {showFull && (
        <div
          className={[
            "absolute inset-0 sv-fade",
            fullFadeIn ? "sv-fade-in" : "sv-fade-out",
          ].join(" ")}
        >
          {fullUI}
        </div>
      )}

      {/* Trường hợp không compact (pinned mở) thì compactUI không render,
          fullUI vẫn render bình thường vì showFull=true */}
    </div>
  );
}
