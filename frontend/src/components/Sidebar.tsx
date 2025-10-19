import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import { basename } from "../app/path";
import { Pencil, Plus, X } from "lucide-react";
import { useState } from "react";


export default function Sidebar() {
  const { tabs, activeTabId, setLeftSplit } = useApp();
  // const tab = tabs.find(t => t.id === activeTabId) || null;
  const tab = useApp(s => s.getActiveSafe());
  const has = useApp(s => s.hasActive());
  
  const leftSplit = tab?.sizes?.leftSplit ?? 60;
  const paneIds = tab?.panes ?? []; 

  // const tabs = useApp(s => s.tabs);
  const activeId = useApp(s => s.activeTabId);
  const setActive = useApp(s => s.setActiveTab);
  // const newTab = useApp(s => s.newTab);
  const renameTab = useApp(s => s.renameTab);
  const closeTab = useApp(s => s.closeTab);
  // const setFocusIndex = useApp(s => s.setFocusIndex); // ✅ action từ store (đã thêm ở bước 1)

  const [editing, setEditing] = useState<string|null>(null);
  const [buf, setBuf] = useState("");

  return (
    <div className="h-full bg-neutral-900 border-r border-neutral-800">
      <div className="h-10 flex items-center px-3 text-sm border-b border-neutral-800">
        <span className="font-medium text-neutral-400">Workspace</span>
        <button onClick={() => useApp.getState().newTab()}
          className="ml-auto text-neutral-400 hover:text-neutral-800">
          <Plus className="h-4 w-4"/>
        </button>
      </div>

      <PanelGroup
        direction="vertical"
        onLayout={([top]) => setLeftSplit(top)}
      >
        {/* Khu TAB dọc + workspace controls */}
        <Panel defaultSize={leftSplit} minSize={30}>
          <div className="space-y-1 mb-4 text-white">
            {tabs.map(t => {
              const active = t.id === activeId;
              return (
                <div
                  key={t.id}
                  className={`group flex items-center gap-2 px-2 py-1 rounded cursor-pointer
                    ${active ? "bg-neutral-800 border border-neutral-700" : "hover:bg-neutral-800/60"}`}
                  onClick={()=>setActive(t.id)}
                >
                  {editing === t.id ? (
                    <input
                      autoFocus
                      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-sm w-full"
                      value={buf}
                      onChange={e=>setBuf(e.target.value)}
                      onKeyDown={e=>{
                        // [step21] chặn hotkeys khi đang rename
                        e.stopPropagation();
                        if (e.key === "Enter") { renameTab(t.id, buf || t.name); setEditing(null); }
                        if (e.key === "Escape") { setEditing(null); }
                      }}
                      onBlur={()=>{ renameTab(t.id, buf || t.name); setEditing(null); }}
                    />
                  ) : (
                    <>
                      <div className="truncate text-sm flex-1">{t.name}</div>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                  <button onClick={(e)=>{ e.stopPropagation(); setEditing(t.id); setBuf(t.name); }}
                    className="p-1 rounded hover:bg-neutral-700" title="Rename">
                    <Pencil className="w-3.5 h-3.5 text-black"/>
                  </button>
                  <button onClick={(e)=>{ e.stopPropagation(); closeTab(t.id); }}
                    className="p-1 rounded hover:bg-neutral-700" title="Close">
                    <X className="w-3.5 h-3.5 text-black"/>
                  </button>
                </div>
              </>
            )}
          </div>
              );
            })}
          </div>
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
              <div className="p-3 rounded border border-neutral-800 bg-neutral-900/50 text-neutral-500 text-sm">
                Chưa có ảnh nào trong tab này.
              </div>
            )}

            {tab && paneIds.length > 0 && (() => {
              const tb = tab!; // ✅ từ đây trở xuống dùng tb an toàn
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
                      <button
                        key={`${tb.id}-${pid}`}
                        onClick={() => useApp.getState().setFocusIndex(i)}
                        className={`w-full px-2 py-1 rounded border text-left text-xs
                          ${hasFile || hasData
                            ? "border-neutral-700 bg-neutral-800/60 hover:bg-neutral-800"
                            : "border-dashed border-neutral-700 text-neutral-500"}`}
                        title={name}
                      >
                        <span className="truncate max-w-[180px] inline-block align-middle text-sm">
                          {name}
                        </span>
                      </button>
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
}
