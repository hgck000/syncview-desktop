/* eslint-disable @typescript-eslint/no-explicit-any */
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import {
  Pencil,
  ImageUp,
  X,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  AppWindow,
  Star,
  ArrowLeft,
  ArrowRight,
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ROW_H = 34;
const LIST_H = ROW_H * 4;

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
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onRenameStart();
              }}
              className="p-1 rounded hover:bg-neutral-700"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5 text-white" />
            </div>
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 rounded hover:bg-neutral-700"
              title="Close"
            >
              <X className="w-4 h-4 text-white" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SortablePaneRow({
  pid,
  name,
  hasImage,
  focused,
  onFocus,
  onRemove,
}: {
  pid: "A" | "B" | "C" | "D";
  name: string;
  hasImage: boolean;
  focused: boolean;
  onFocus: () => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pid });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
    userSelect: "none",
    cursor: isDragging ? "grabbing" : "grab",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div
        onClick={onFocus}
        title={name}
        className={[
          "w-full px-2 py-1 rounded border text-left text-xs select-none transition flex items-center gap-2",
          hasImage
            ? "border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800 text-neutral-300"
            : "border-dashed border-neutral-700 text-neutral-500 hover:bg-neutral-800/30",
          focused ? "ring-1 ring-white/15" : "",
        ].join(" ")}
      >
        <ImageUp className="h-4 w-4 opacity-80 shrink-0" />

        <span className="truncate flex-1 min-w-[0px] inline-block align-middle text-sm">
          {name}
        </span>

        {hasImage && (
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="w-5 h-5 flex items-center jusity-center bg-none rounded hover:bg-neutral-700 p-1"
            title="Remove image"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.4} />
          </div>
        )}
      </div>
    </div>
  );
}

function FourRows({
  rows,
  renderRow,
  className,
}: {
  rows: any[];
  renderRow: (row: any, idx: number) => React.ReactNode;
  className: string;
}) {
  const items = rows.slice(0, 4);
  return (
    <div style={{ height: LIST_H }} className="space-y-1 overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => {
        const row = items[i];
        if (row !== undefined) return <div key={i}>{renderRow(row, i)}</div>;

        // placeholder (giữ chỗ)
        return (
          <div
            key={i}
            className={`px-2 py-1 rounded text-[11px] leading-4 ${className} opacity-30`}
          >
            &nbsp;
          </div>
        );
      })}
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
  const leftSplit = tab?.sizes?.leftSplit ?? 42;
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
  const paneSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 5 },
    })
  );

  // trạng thái kéo để ẩn nút sửa/xóa toàn bộ trong lúc kéo
  const [dragging, setDragging] = React.useState(false);
  const items = tabs.map((tt) => String(tt.id));

  const showingKept = !!tab?.preview?.on;
  const stash = tab?.preview?.stash;

  // Queue source: nếu đang show Kept thì lấy từ stash (đúng unclassified set trước khi swap)
  const uQueue = (showingKept && stash ? stash.queue : tab?.queue) ?? [];

  // Panes chỉ xuất hiện khi đang show Kept (lấy từ stash)
  const uPanes = (showingKept && stash ? stash.panes : []) ?? [];

  // Names: khi show kept thì lấy stash.names, còn lại lấy tab.names
  const uNames = (showingKept && stash ? stash.names : tab?.names) ?? {};

  // Count: unstar chỉ tính queue; star thì tính panes + queue (đúng như bạn muốn nhét 4 pane lên đầu)
  const uTotal = showingKept
    ? (uPanes.length ?? 0) + (uQueue.length ?? 0)
    : uQueue.length ?? 0;

  const LIST_ACTIVE =
    "border border-neutral-700/70 bg-neutral-800/70 text-neutral-200";
  const LIST_MUTED =
    "border border-neutral-800 bg-neutral-900/30 text-neutral-300/60";

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
              // dùng action reorderTabs trong store
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
            <div className="py-1 pb-3 flex items-center justify-between select-none">
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Images in this tab
              </div>

              {/* nút swap list (kept/unclassified) */}
              <div
                className={`px-2 py-0.5 rounded text-xs transition cursor-pointer select-none group
    ${tab?.preview?.on ? "text-white" : "text-neutral-300"}
  `}
                title="Show star list"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  e.stopPropagation();
                  useApp.getState().togglePreviewKept();
                }}
              >
                <Star
                  className={`w-4 h-4 transition-all
    ${
      tab?.preview?.on
        ? "scale-110 fill-blue-600 stroke-blue-600 " +
          "group-hover:scale-125 group-hover:fill-blue-600"
        : "fill-transparent stroke-neutral-400 " +
          "group-hover:stroke-blue-600 group-hover:scale-110"
    }`}
                  strokeWidth={2.2}
                />
              </div>
            </div>
            {!tab && (
              <div className="p-3 rounded border border-dashed border-neutral-800/70 bg-neutral-900/30 text-neutral-600 text-sm">
                (Trống)
              </div>
            )}
            {tab && paneIds.length === 0 && (
              <div className="p-3 rounded border border-neutral-800 bg-neutral-900/50 text-neutral-300 text-sm text-center">
                No images in this tab
              </div>
            )}
            {tab &&
              paneIds.length > 0 &&
              (() => {
                return (
                  <DndContext
                    sensors={paneSensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => {
                      const { active, over } = e;
                      if (!over) return;

                      const from = paneIds.indexOf(active.id as any);
                      const to = paneIds.indexOf(over.id as any);
                      if (from < 0 || to < 0 || from === to) return;

                      useApp.getState().reorderPanes(from, to);
                    }}
                  >
                    <SortableContext
                      items={paneIds}
                      strategy={verticalListSortingStrategy}
                    >
                      <div
                        className="space-y-1 overflow-hidden pr-1"
                        style={{ height: LIST_H }}
                      >
                        {paneIds.map((pid, i) => {
                          const file = tab?.files?.[pid];
                          const dataURL = tab?.dataURL?.[pid];
                          const hasImage = !!(file || dataURL);

                          const name: string =
                            tab?.names?.[pid] ??
                            (file ? file.split(/[\\/]/).pop() : undefined) ??
                            (hasImage ? "(image)" : "(empty)");

                          const focused =
                            tab?.panes?.[tab?.focusIndex ?? 0] === pid;

                          return (
                            <SortablePaneRow
                              key={`${tab?.id ?? "tab"}-${pid}`}
                              pid={pid}
                              name={name}
                              hasImage={hasImage}
                              focused={focused}
                              onFocus={() => useApp.getState().setFocusIndex(i)}
                              onRemove={() => useApp.getState().clearPane(pid)}
                            />
                          );
                        })}

                        {/* placeholders để luôn đủ 4 hàng (tránh nhảy layout) */}
                        {Array.from({
                          length: Math.max(0, 4 - paneIds.length),
                        }).map((_, k) => (
                          <div
                            key={`pane-ph-${k}`}
                            className={`w-full px-2 py-1 rounded border text-left text-xs select-none transition opacity-30 ${
                              showingKept ? LIST_MUTED : LIST_ACTIVE
                            }`}
                          >
                            &nbsp;
                          </div>
                        ))}

                        {/* Pager row (under panes) */}
                      </div>
                    </SortableContext>
                  </DndContext>
                );
              })()}
            {(() => {
              // Kept pages
              const keptCount = tab?.favorites?.length ?? 0;
              const keptPages = Math.max(1, Math.ceil(keptCount / 4));
              const keptPage = Math.min(
                keptPages - 1,
                Math.max(0, tab?.preview?.page ?? 0)
              );

              // Unclassified pages: dựa trên (paneItems + queue)
              const fullLen =
                (tab?.panes?.length ?? 0) + (tab?.queue?.length ?? 0);
              const qPages = Math.max(1, Math.ceil(fullLen / 4));
              const qPage = Math.min(
                qPages - 1,
                Math.max(0, tab?.queuePage ?? 0)
              );

              const canPrev = showingKept ? keptPage > 0 : qPage > 0;
              const canNext = showingKept
                ? keptPage < keptPages - 1
                : qPage < qPages - 1;

              const label = showingKept
                ? `${keptPage + 1}/${keptPages}`
                : `${qPage + 1}/${qPages}`;

              return (
                <div className="mt-2 px-2 flex items-center justify-evenly pr-4 gap-1 select-none">
                  <div
                    className={`group inline-flex items-center justify-center
    p-1 rounded transition-all duration-150
    bg-transparent cursor-pointer
    text-neutral-400 hover:text-neutral-200
    hover:scale-110 active:scale-100
    ${!canPrev ? "opacity-40 pointer-events-none" : ""}`}
                    title="Previous"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (showingKept) useApp.getState().prevKeptPage();
                      else useApp.getState().prevQueuePageShow();
                    }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 stroke-current" />
                  </div>

                  <div className="px-2 py-0.5 rounded text-[11px] text-neutral-400">
                    {label}
                  </div>

                  <div
                    className={`group inline-flex items-center justify-center
    p-1 rounded transition-all duration-150
    bg-transparent cursor-pointer
    text-neutral-400 hover:text-neutral-200
    hover:scale-110 active:scale-100
    ${!canNext ? "opacity-40 pointer-events-none" : ""}`}
                    title="Next"
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      if (showingKept) useApp.getState().nextKeptPage();
                      else useApp.getState().nextQueuePageShow();
                    }}
                  >
                    <ArrowRight className="w-3.5 h-3.5 stroke-current" />
                  </div>
                </div>
              );
            })()}
            {/* Unclassified list (chỉ khi đang show unclassified) */}
            <div className="mt-2 px-2 text-[11px] select-none flex items-center justify-between">
              <div
                className={
                  showingKept ? "text-neutral-500" : "text-neutral-300"
                }
              >
                Queue ({uTotal})
              </div>
            </div>

            <div className="mt-1 px-2 pr-4">
              {(() => {
                const qPages = Math.max(1, Math.ceil(uQueue.length / 4));
                const qPage = Math.min(
                  qPages - 1,
                  Math.max(0, tab?.queuePage ?? 0)
                );
                const start = qPage * 4;
                const qItems = uQueue.slice(start, start + 4);

                const rows = (showingKept ? uPanes : qItems) as any[];

                const rowsOrEmpty =
                  rows.length > 0 ? rows : [{ __kind: "__empty__" }];

                return (
                  <FourRows
                    rows={rowsOrEmpty}
                    className={showingKept ? LIST_MUTED : LIST_ACTIVE}
                    renderRow={(row: any, i: number) => {
                      // empty sentinel
                      if (row?.__kind === "__empty__") {
                        return (
                          <div
                            className={`px-2 py-1 rounded text-[11px] leading-4 ${
                              showingKept ? LIST_MUTED : LIST_ACTIVE
                            }`}
                          >
                            Empty
                          </div>
                        );
                      }

                      // showingKept => row là pid ("A"|"B"|"C"|"D")
                      if (showingKept) {
                        const pid = row as "A" | "B" | "C" | "D";
                        const name = uNames[pid] || "(image)";
                        return (
                          <div
                            className={`px-2 py-1 rounded text-[11px] leading-4 truncate ${
                              showingKept ? LIST_MUTED : LIST_ACTIVE
                            }`}
                            title={name}
                          >
                            {i + 1}. {name}
                          </div>
                        );
                      }

                      // unclassified queue item
                      const it = row as {
                        kind: string;
                        name: string;
                        path?: string;
                      };
                      return (
                        <div
                          className={`px-2 py-1 rounded text-[11px] leading-4 truncate ${
                            showingKept ? LIST_MUTED : LIST_ACTIVE
                          }`}
                          title={it.kind === "file" ? it.path : it.name}
                        >
                          {start + i + 1}. {it.name}
                        </div>
                      );
                    }}
                  />
                );
              })()}
            </div>

            {/* Kept list (chỉ khi đang show kept) */}
            <div className="mt-3 px-2 text-[11px] select-none flex items-center justify-between">
              <div
                className={
                  showingKept ? "text-neutral-300" : "text-neutral-500"
                }
              >
                Starred ({tab?.favorites?.length ?? 0})
              </div>
            </div>

            <div className="mt-1 px-2 pr-4">
              {(() => {
                const fav = (tab?.favorites ?? []).slice().sort((a, b) => {
                  const ai = a.originIndex ?? 1e15;
                  const bi = b.originIndex ?? 1e15;
                  return ai - bi;
                });

                const pages = Math.max(1, Math.ceil(fav.length / 4));
                const page = Math.min(
                  pages - 1,
                  Math.max(0, tab?.preview?.page ?? 0)
                );
                const start = page * 4;
                const items = fav.slice(start, start + 4);

                const rowsOrEmpty = items.length
                  ? items
                  : [{ __kind: "__empty__" }];

                return (
                  <FourRows
                    rows={rowsOrEmpty}
                    className={showingKept ? LIST_ACTIVE : LIST_MUTED}
                    renderRow={(row: any, i: number) => {
                      if (row?.__kind === "__empty__") {
                        return (
                          <div
                            className={`px-2 py-1 rounded text-[11px] ${
                              showingKept ? LIST_ACTIVE : LIST_MUTED
                            }`}
                          >
                            Empty
                          </div>
                        );
                      }

                      const it = row as {
                        kind: string;
                        name: string;
                        path?: string;
                        originIndex?: number;
                      };
                      return (
                        <div
                          key={
                            it.kind === "file"
                              ? `k-${it.path}-${it.originIndex}`
                              : `k-${start + i}`
                          }
                          className={`px-2 py-1 rounded text-[11px] leading-4 truncate ${
                            showingKept ? LIST_ACTIVE : LIST_MUTED
                          }`}
                          title={it.kind === "file" ? it.path : it.name}
                        >
                          {start + i + 1}. {it.name}
                        </div>
                      );
                    }}
                  />
                );
              })()}
            </div>
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
    </div>
  );
}
