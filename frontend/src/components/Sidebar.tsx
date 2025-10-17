import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useApp } from "../app/store";
import { basename } from "../app/path";


export default function Sidebar() {
  const { tabs, activeTabId, setLeftSplit } = useApp();
  const tab = tabs.find(t => t.id === activeTabId)!;

  return (
    <div className="h-full bg-neutral-900 border-r border-neutral-800">
      <div className="h-10 flex items-center px-3 text-sm border-b border-neutral-800">
        <span className="font-medium">Workspace</span>
      </div>

      <PanelGroup
        direction="vertical"
        onLayout={([top]) => setLeftSplit(top)}
      >
        {/* Khu TAB dọc + workspace controls */}
        <Panel defaultSize={tab.sizes.leftSplit} minSize={30}>
          <div className="h-full overflow-auto p-3 space-y-3">
            <div>
              <div className="text-xs uppercase text-neutral-400 mb-2">Tabs</div>
              <div className="space-y-2">
                <div className="px-2 py-1.5 rounded bg-neutral-800 text-neutral-100">
                  Untitled (active)
                </div>
                <button className="px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                  + New Tab
                </button>
              </div>
            </div>

            <div>
              <div className="text-xs uppercase text-neutral-400 mb-2">Workspace</div>
              <div className="space-y-2 text-neutral-300">
                <button className="w-full px-2 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700">
                  Open Image…
                </button>
                <div className="text-xs text-neutral-500">Drag & drop 1–4 ảnh vào viewer</div>
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="h-1 bg-neutral-700/50 hover:bg-neutral-600 cursor-row-resize" />

        {/* IMAGE PANEL CONTROL BOX */}
        <Panel minSize={20}>
          <div className="h-full p-3 border-t border-neutral-800">
            <div className="text-xs uppercase text-neutral-400 mb-2">
              Images in this tab
            </div>
            <div className="flex flex-wrap gap-2">
              {tab.panes.map((p) => {
                const name = tab.names[p] ?? basename(tab.files[p]) ?? `${p}: Empty`;
                const has  = !!tab.files[p] || !!tab.dataURL[p];
                return (
                  <div key={p} className={`flex items-center gap-1 px-2 py-1 rounded ${has ? "bg-neutral-800 text-neutral-200" : "border border-dashed border-neutral-700 text-neutral-500"}`}>
                    <span className="truncate max-w-[140px]">{name}</span>
                    {/* {has && (
                      <button
                        className={`ml-1 ${has ? "text-neutral-400 hover:text-red-400" : "text-neutral-700 cursor-not-allowed"}`}
                        onClick={() => has && useApp.getState().setDataURLForPane(p, undefined) || useApp.getState().setFileForPane(p, undefined)}
                        // onClick={() => has && useApp.getState().setFileForPane(p, undefined)}
                        title={has ? "Remove" : "No image to remove"}
                      >✕</button>
                    )} */}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
