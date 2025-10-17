import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import ViewerGrid from "./components/ViewerGrid";
import HelpOverlay from "./components/HelpOverlay";
import { useApp } from "./app/store";
import Hotkeys from "./app/hotkeys";

export default function App() {
  const { tabs, activeTabId, setSidebarSize } = useApp();
  const tab = tabs.find(t => t.id === activeTabId)!;
  
  // Hotkeys()
  return (
    <div className="h-screen w-screen bg-neutral-950 text-neutral-200">
      <Hotkeys />
      <PanelGroup
        direction="horizontal"
        onLayout={([left]) => setSidebarSize(left)}
      >
        <Panel defaultSize={tab.sizes.sidebar} minSize={16} maxSize={45}>
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
