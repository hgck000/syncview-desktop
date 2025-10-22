import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import ViewerGrid from "./components/ViewerGrid";
import HelpOverlay from "./components/HelpOverlay";
import { useApp } from "./app/store";
import Hotkeys from "./app/hotkeys";
import { useEffect, useRef } from "react";
import { readLastSession, writeLastSession } from "./app/bridge";
import AppEventDebug from "./dev/AppEventDebug";
// import DndProbe from "./dev/DndProbe";
import { HotkeyHint } from "./components/HotkeyHint";

export default function App() {
  const tabs = useApp(s => s.tabs);
  const active = useApp(s => s.getActive());
  const activeTabId = useApp(s => s.activeTabId);
  const setSidebarSize = useApp(s => s.setSidebarSize);
  const loadFromSession = useApp(s => s.loadFromSession);
  const markHydrated = useApp(s => s.markHydrated);
  const hydrated = useApp(s => s.hydrated);
  const setFileForPane = useApp((s) => s.setFileForPane);
  const resetAllViews = useApp((s) => s.resetAllViews);

  // load last session
  useEffect(() => {
    (async () => {
      const data = await readLastSession();
      if (data && Array.isArray(data.tabs)) {
        loadFromSession(data);
        console.log("[last-session] loaded");
      } else {
        console.log("[last-session] none/invalid -> empty start");
      }
      markHydrated(true);
    })();
  }, [loadFromSession, markHydrated]);

  // autosave 400ms
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(async () => {
      const payload = useApp.getState().serialize();
      const ok = await writeLastSession(payload);
      console.log("[autosave] last_session ->", ok);
    }, 400);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
  }, [hydrated, tabs, activeTabId]);

  // keydown events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      console.log("[App.tsx] keydown", key);
      if (key === "d") {
        resetAllViews();
      }
      if (key === "o") {
        const t = useApp.getState();
        const target = t.panes.length ? t.panes[t.focusIndex] : (t.nextEmpty?.() ?? "D");
        console.log("Open target:", target);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resetAllViews]);

  const sidebarSize = (active as any)?.sizes?.sidebar ?? 15;

  return (
    <>
      <AppEventDebug />
      {/* <DndProbe /> */}
      <div className="h-screen w-screen bg-neutral-950 text-neutral-800">
        {active && <Hotkeys />}

        <PanelGroup direction="horizontal" onLayout={([left]) => setSidebarSize(left)}>
          <Panel defaultSize={sidebarSize} minSize={12} maxSize={20}>
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
        <HotkeyHint />
      </div>
    </>
  );
}
