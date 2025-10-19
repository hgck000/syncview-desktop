import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import ViewerGrid from "./components/ViewerGrid";
import HelpOverlay from "./components/HelpOverlay";
import { useApp } from "./app/store";
import Hotkeys from "./app/hotkeys";
// [step21] imports
import { useEffect, useRef } from "react";
import { readLastSession, writeLastSession } from "./app/bridge";

export default function App() {
  // const { tabs, activeTabId, setSidebarSize } = useApp();
  // const tab = tabs.find(t => t.id === activeTabId)!;

  const tabs = useApp(s => s.tabs);
  const active = useApp(s => s.getActive());
  const activeTabId = useApp(s => s.activeTabId);
  const setSidebarSize = useApp(s => s.setSidebarSize);
  const loadFromSession = useApp(s => s.loadFromSession);
  const markHydrated = useApp(s => s.markHydrated);
  const hydrated = useApp(s => s.hydrated);
  // const tRef = useRef<number|null>(null);


  // [step21] load last session 1 lần khi khởi động
  useEffect(() => {
    (async () => {
      const data = await readLastSession();
      if (data && Array.isArray(data.tabs)) {
        loadFromSession(data);
        console.log('[last-session] loaded');
      } else {
        console.log('[last-session] none/invalid -> empty start');
      }
      markHydrated(true);
    })();
  }, [loadFromSession, markHydrated]);

  // autosave: debounce 400ms khi tabs/activeTabId đổi
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(async () => {
      const payload = useApp.getState().serialize();
      const ok = await writeLastSession(payload);
      console.log('[last-session] autosave ->', ok);
    }, 400);
    return () => clearTimeout(t);
  }, [hydrated, tabs, activeTabId]);

  // [step21] autosave 400ms sau mỗi thay đổi tabs/activeTabId
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(async () => {
      const payload = useApp.getState().serialize();
      const ok = await writeLastSession(payload);
      console.log("[step21] autosave last_session ->", ok);
    }, 400);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
  }, [tabs, activeTabId]);

  // [step21] Fallback size khi chưa có tab để PanelGroup vẫn hiện bình thường
  const sidebarSize = (active as any)?.sizes?.sidebar ?? 24;

return (
  <div className="h-screen w-screen bg-neutral-950 text-neutral-800">
    {active && <Hotkeys />}

    <PanelGroup direction="horizontal" onLayout={([left]) => setSidebarSize(left)}>
      <Panel defaultSize={sidebarSize} minSize={16} maxSize={45}>
        <Sidebar />
      </Panel>
      <PanelResizeHandle className="w-1 bg-neutral-700/50 hover:bg-neutral-600 cursor-col-resize" />
      <Panel minSize={40}>
        <div className="flex flex-col h-full">
          <Toolbar />
          <div className="flex-1 overflow-hidden">
            <ViewerGrid />
          </div>
        </div>
      </Panel>
    </PanelGroup>
    <HelpOverlay />
  </div>
  );
}