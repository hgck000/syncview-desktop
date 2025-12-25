/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import ViewerGrid from "./components/ViewerGrid";
import HelpOverlay from "./components/HelpOverlay";
import { useApp } from "./app/store";
import Hotkeys from "./app/hotkeys";
import { useEffect, useRef, useState } from "react";
import { readLastSession, writeLastSession } from "./app/bridge";
import AppEventDebug from "./dev/AppEventDebug";

function isEditableTarget(e: Event): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    (el as any).isContentEditable ||
    el.getAttribute?.("role") === "textbox"
  );
}

export default function App() {
  const addImageFromDataURL = useApp((s) => s.addImageFromDataURL);
  const tabs = useApp((s) => s.tabs);
  const active = useApp((s) => s.getActive());
  const activeTabId = useApp((s) => s.activeTabId);
  const setSidebarSize = useApp((s) => s.setSidebarSize);
  const loadFromSession = useApp((s) => s.loadFromSession);
  const markHydrated = useApp((s) => s.markHydrated);
  const hydrated = useApp((s) => s.hydrated);

  const sidebarCollapsed = useApp((s) => s.sidebarCollapsed);
  const sidebarPeek = useApp((s) => s.sidebarPeek);
  const sidebarExpandedSize = useApp((s) => s.sidebarExpandedSize);
  const setSidebarCollapsed = useApp((s) => s.setSidebarCollapsed);
  const setSidebarPeek = useApp((s) => s.setSidebarPeek);
  const setSidebarExpandedSize = useApp((s) => s.setSidebarExpandedSize);

  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const sidebarSize = (active as any)?.sizes?.sidebar ?? 15;

  const compact = sidebarCollapsed && !sidebarPeek;
  // const compact = sidebarCollapsed;

  const expandToSaved = () => {
    const size = sidebarExpandedSize || sidebarSize || 15;
    sidebarPanelRef.current?.resize(size);
  };

  const enterTimerRef = useRef<number | null>(null);

  const [renderFull, setRenderFull] = useState(false);

  const showFull = renderFull;
  const fadeIn = !sidebarCollapsed || sidebarPeek;

  const onSidebarEnter = () => {
    const s = useApp.getState();
    if (!s.sidebarCollapsed) return;

    if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current);
    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);

    enterTimerRef.current = window.setTimeout(() => {
      setSidebarPeek(true);
      expandToSaved();
    }, 220);
  };

  const onSidebarLeave = () => {
    const s = useApp.getState();
    if (!s.sidebarCollapsed) return;

    if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
    if (leaveTimerRef.current) window.clearTimeout(leaveTimerRef.current);

    leaveTimerRef.current = window.setTimeout(() => {
      setSidebarPeek(false);
      sidebarPanelRef.current?.collapse();
    }, 240);
  };

  const pinOpen = () => {
    setSidebarPeek(false);
    setSidebarCollapsed(false);
    sidebarPanelRef.current?.resize(sidebarExpandedSize || sidebarSize || 15);
  };

  const collapsePinned = () => {
    setSidebarPeek(false);
    setSidebarCollapsed(true);
    sidebarPanelRef.current?.collapse();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await readLastSession();
        if (cancelled) return;

        if (data) {
          console.log("[session] read_last_session:", data);
          // loadFromSession tự check version/shape, nên mình cứ đưa vào
          loadFromSession(data as any);
        } else {
          console.log("[session] no last_session found");
        }
      } catch (e) {
        console.error("[session] error reading last_session:", e);
      } finally {
        if (!cancelled) {
          markHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromSession, markHydrated]);

  // autosave: debounce 400ms khi tabs/activeTabId đổi
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(async () => {
      const payload = useApp.getState().serialize();
      const ok = await writeLastSession(payload);
      console.log("[last-session] autosave ->", ok);
    }, 400);
    return () => clearTimeout(t);
  }, [hydrated, tabs, activeTabId]);

  useEffect(() => {
    function blobToDataURL(blob: Blob): Promise<string> {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(typeof reader.result === "string" ? reader.result : "");
        };
        reader.readAsDataURL(blob);
      });
    }

    async function onPaste(ev: ClipboardEvent) {
      if (isEditableTarget(ev)) return;

      const cd = ev.clipboardData;
      if (!cd) return;

      const items = cd.items;
      if (!items || !items.length) return;

      const blobs: Blob[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) blobs.push(file);
        }
      }

      if (!blobs.length) return;

      // mình xử lý paste image → chặn dán text vào đâu đó linh tinh
      ev.preventDefault();

      for (const blob of blobs) {
        const dataURL = await blobToDataURL(blob);
        if (dataURL) {
          addImageFromDataURL(dataURL);
        }
      }
    }

    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [addImageFromDataURL]);

  useEffect(() => {
    // Khi peek hoặc pinned → render full ngay
    if (!sidebarCollapsed || sidebarPeek) {
      setRenderFull(true);
      return;
    }

    // Khi collapsed và không peek → delay 180ms rồi mới unmount full
    const t = window.setTimeout(() => setRenderFull(false), 180);
    return () => window.clearTimeout(t);
  }, [sidebarCollapsed, sidebarPeek]);

  return (
    <>
      <AppEventDebug />
      <div className="sv-shell h-screen w-screen bg-neutral-950 text-neutral-800">
        {active && <Hotkeys />}

        <PanelGroup
          direction="horizontal"
          onLayout={([left]) => {
            const s = useApp.getState();

            const COLLAPSED_SIZE = 2.5;
            const EPS = 0.2; // chống sai số float (%)

            const collapsedBySize = left <= COLLAPSED_SIZE + EPS;

            // 1) Nếu panel thực sự đang collapsed theo size -> ép state về collapsed + tắt peek
            //    và tuyệt đối KHÔNG lưu 2.5 vào expandedSize.
            if (collapsedBySize) {
              if (!s.sidebarCollapsed || s.sidebarPeek) {
                setSidebarPeek(false);
                setSidebarCollapsed(true);
              }
              return;
            }

            // 2) Panel đang mở theo size
            //    - Nếu đang "collapsed nhưng không peek" => user vừa kéo mở -> coi như pinned open
            if (s.sidebarCollapsed && !s.sidebarPeek) {
              setSidebarCollapsed(false);
            }

            // 3) Lưu size khi đang mở (hoặc đang peek)
            setSidebarSize(left);
            setSidebarExpandedSize(left);
          }}
        >
          <Panel
            ref={sidebarPanelRef}
            collapsible
            collapsedSize={2.5}
            minSize={10}
            maxSize={20}
            defaultSize={sidebarSize}
          >
            <div
              className="h-full"
              onMouseEnter={onSidebarEnter}
              onMouseLeave={onSidebarLeave}
            >
              <Sidebar
                compact={compact}
                showFull={showFull}
                fullFadeIn={fadeIn}
                isPeek={sidebarCollapsed && sidebarPeek}
                isPinned={!sidebarCollapsed}
                onPinOpen={pinOpen}
                onCollapsePinned={collapsePinned}
              />
            </div>
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
    </>
  );
}
