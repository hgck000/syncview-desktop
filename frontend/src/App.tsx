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
import {
  normalizeSidebarSize,
  useApp,
  type PaneId,
} from "./app/store";
import Hotkeys from "./app/hotkeys";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  persistImageDataURL,
  prewarmImageSource,
  readLastSession,
  writeLastSession,
} from "./app/bridge";
import type { ImageLoadState } from "./app/useImageCanvas";
import AppEventDebug from "./dev/AppEventDebug";

type StartupPhase = "visible" | "leaving" | "hidden";

const MIN_STARTUP_VISIBLE_MS = 650;
const STARTUP_FADE_MS = 320;
const STARTUP_IMAGE_TIMEOUT_MS = 20_000;

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

function waitForBackgroundSlot(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      const requestIdle = (window as any).requestIdleCallback as
        | ((
            callback: () => void,
            options?: { timeout: number },
          ) => number)
        | undefined;

      if (requestIdle) {
        requestIdle(() => resolve(), { timeout: 600 });
      } else {
        resolve();
      }
    }, 60);
  });
}

function StartupScreen({
  phase,
  sessionReady,
}: {
  phase: Exclude<StartupPhase, "hidden">;
  sessionReady: boolean;
}) {
  return (
    <div
      className={[
        "fixed inset-0 z-[100] overflow-hidden",
        "bg-[#090b0f] text-neutral-100",
        "flex items-center justify-center",
        "transition-[opacity,transform] ease-out",
        phase === "leaving"
          ? "opacity-0 scale-[1.015] duration-300 pointer-events-none"
          : "opacity-100 scale-100 duration-200",
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="sv-startup-glow absolute w-72 h-72 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center select-none">
        <div className="relative w-[76px] h-[76px] flex items-center justify-center">
          <svg
            className="sv-startup-spinner absolute -inset-2 w-[92px] h-[92px]"
            viewBox="0 0 100 100"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="rgba(59,130,246,0.16)"
              strokeWidth="2"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="92 198"
            />
          </svg>
          <img
            src="/SyncView.ico"
            alt=""
            className="relative w-[76px] h-[76px] object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.5)]"
            draggable={false}
          />
        </div>

        <div className="mt-6 text-[20px] font-semibold tracking-[-0.02em]">
          SyncView
        </div>
        <div className="mt-1.5 text-[12px] text-neutral-500">
          {sessionReady
            ? "Preparing your workspace…"
            : "Restoring your session…"}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const setFileForPane = useApp((s) => s.setFileForPane);
  const setDataURLForPane = useApp((s) => s.setDataURLForPane);
  const tabs = useApp((s) => s.tabs);
  const active = useApp((s) => s.getActive());
  const activeTabId = useApp((s) => s.activeTabId);
  const setSidebarSize = useApp((s) => s.setSidebarSize);
  const loadFromSession = useApp((s) => s.loadFromSession);
  const markHydrated = useApp((s) => s.markHydrated);
  const hydrated = useApp((s) => s.hydrated);
  const sidebarSize = useApp((s) => s.sidebarSize);
  const leftSplit = useApp((s) => s.leftSplit);

  const sidebarCollapsed = useApp((s) => s.sidebarCollapsed);
  const sidebarPeek = useApp((s) => s.sidebarPeek);
  const sidebarExpandedSize = useApp((s) => s.sidebarExpandedSize);
  const setSidebarCollapsed = useApp((s) => s.setSidebarCollapsed);
  const setSidebarPeek = useApp((s) => s.setSidebarPeek);
  const setSidebarExpandedSize = useApp((s) => s.setSidebarExpandedSize);

  const [startupPhase, setStartupPhase] =
    useState<StartupPhase>("visible");
  const startupPhaseRef = useRef<StartupPhase>("visible");
  const startupStartedAtRef = useRef(performance.now());
  const startupTabIdRef = useRef("");
  const settledStartupPanesRef = useRef(new Set<PaneId>());
  const startupDismissQueuedRef = useRef(false);
  const startupExitTimerRef = useRef<number | null>(null);
  const startupRemoveTimerRef = useRef<number | null>(null);
  const autosaveInitializedRef = useRef(false);

  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const compact = sidebarCollapsed && !sidebarPeek;
  // const compact = sidebarCollapsed;
  const enterTimerRef = useRef<number | null>(null);

  const [renderFull, setRenderFull] = useState(false);

  const showFull = renderFull;
  const fadeIn = !sidebarCollapsed || sidebarPeek;
  const appReady = hydrated && startupPhase === "hidden";

  const dismissStartup = useCallback(() => {
    if (
      startupDismissQueuedRef.current ||
      startupPhaseRef.current !== "visible"
    ) {
      return;
    }

    startupDismissQueuedRef.current = true;
    const elapsed = performance.now() - startupStartedAtRef.current;
    const delay = Math.max(0, MIN_STARTUP_VISIBLE_MS - elapsed);

    startupExitTimerRef.current = window.setTimeout(() => {
      startupPhaseRef.current = "leaving";
      setStartupPhase("leaving");

      startupRemoveTimerRef.current = window.setTimeout(() => {
        startupPhaseRef.current = "hidden";
        setStartupPhase("hidden");
      }, STARTUP_FADE_MS);
    }, delay);
  }, []);

  const onStartupImageLoadState = useCallback(
    (pane: PaneId, state: ImageLoadState) => {
      if (startupPhaseRef.current !== "visible") return;

      const app = useApp.getState();
      const startupTab = app.tabs.find(
        (tab) => tab.id === startupTabIdRef.current,
      );
      if (!startupTab || app.activeTabId !== startupTab.id) return;

      if (state === "loading") {
        settledStartupPanesRef.current.delete(pane);
      } else {
        settledStartupPanesRef.current.add(pane);
      }

      const expectedPanes = startupTab.panes.filter(
        (id) => startupTab.files[id] || startupTab.dataURL[id],
      );
      if (
        expectedPanes.length > 0 &&
        expectedPanes.every((id) =>
          settledStartupPanesRef.current.has(id),
        )
      ) {
        dismissStartup();
      }
    },
    [dismissStartup],
  );

  const expandToSaved = () => {
    const size = normalizeSidebarSize(
      sidebarSize || sidebarExpandedSize
    );
    sidebarPanelRef.current?.resize(size);
  };

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
    sidebarPanelRef.current?.resize(
      normalizeSidebarSize(sidebarSize || sidebarExpandedSize)
    );
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
          startupTabIdRef.current = useApp.getState().activeTabId;
          settledStartupPanesRef.current.clear();
          markHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFromSession, markHydrated]);

  useEffect(() => {
    if (!hydrated || startupPhaseRef.current !== "visible") return;

    const state = useApp.getState();
    const startupTab = state.tabs.find(
      (tab) => tab.id === startupTabIdRef.current,
    );
    const expectedPanes =
      startupTab?.panes.filter(
        (id) => startupTab.files[id] || startupTab.dataURL[id],
      ) ?? [];

    if (expectedPanes.length === 0) {
      dismissStartup();
      return;
    }

    // A corrupt or unavailable image must not trap the user on the splash.
    const timeout = window.setTimeout(
      dismissStartup,
      STARTUP_IMAGE_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [dismissStartup, hydrated]);

  useEffect(() => {
    return () => {
      if (startupExitTimerRef.current) {
        window.clearTimeout(startupExitTimerRef.current);
      }
      if (startupRemoveTimerRef.current) {
        window.clearTimeout(startupRemoveTimerRef.current);
      }
      startupDismissQueuedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    if (!hydrated) return;

    const state = useApp.getState();
    const savedSize = normalizeSidebarSize(state.sidebarSize);
    setSidebarExpandedSize(savedSize);

    if (!state.sidebarCollapsed || state.sidebarPeek) {
      sidebarPanelRef.current?.resize(savedSize);
    }
  }, [hydrated, setSidebarExpandedSize]);

  // autosave: debounce 400ms khi tabs/activeTabId đổi
  useEffect(() => {
    if (!appReady) return;

    // Restoring a session is not a user edit. Avoid immediately writing the
    // same (possibly very large) JSON back while startup is still settling.
    if (!autosaveInitializedRef.current) {
      autosaveInitializedRef.current = true;
      return;
    }

    const t = setTimeout(async () => {
      const payload = useApp.getState().serialize();
      const ok = await writeLastSession(payload);
      console.log("[last-session] autosave ->", ok);
    }, 400);
    return () => clearTimeout(t);
  }, [appReady, tabs, activeTabId, sidebarSize, leftSplit]);

  useEffect(() => {
    if (!appReady) return;

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

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }

      if (!files.length) return;

      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });
      files.sort((a, b) => collator.compare(a.name, b.name));

      // mình xử lý paste image → chặn dán text vào đâu đó linh tinh
      ev.preventDefault();

      for (const f of files) {
        const dataURL = await blobToDataURL(f);
        if (!dataURL) continue;

        const state = useApp.getState();
        const tab = state.getActive();
        if (!tab) continue;
        const targetPane =
          state.nextEmptyPaneId() ??
          tab.panes[tab.focusIndex] ??
          tab.panes[0] ??
          "A";

        const persistedPath = await persistImageDataURL(dataURL, f.name);
        if (persistedPath) {
          setFileForPane(targetPane, persistedPath, f.name);
        } else {
          setDataURLForPane(targetPane, dataURL, f.name);
        }
      }
    }

    window.addEventListener("paste", onPaste as any);
    return () => window.removeEventListener("paste", onPaste as any);
  }, [appReady, setDataURLForPane, setFileForPane]);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      void (async () => {
        const state = useApp.getState();
        const queue = state.tabs
          .filter((tab) => tab.id !== state.activeTabId)
          .flatMap((tab) =>
            tab.panes.map((pane) => ({
              path: tab.files[pane],
              dataURL: tab.dataURL[pane],
            })),
          )
          .filter((item) => item.path || item.dataURL);

        // Decode one source per idle slot behind the splash. Decoded images
        // remain ready for later tab switches without mounting extra canvases.
        for (const item of queue) {
          await waitForBackgroundSlot();
          if (cancelled) return;
          await prewarmImageSource(item.path, item.dataURL);
        }
      })();
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
    };
  }, [hydrated]);

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

  useEffect(() => {
    if (!appReady) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e)) return;

      // Nếu đã có active tab thì để Hotkeys xử lý (tránh toggle 2 lần)
      const hasActive = !!useApp.getState().getActive?.();
      if (hasActive) return;

      // Chỉ bắt phím H (không kèm Ctrl/Alt/Cmd)
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== "h") return;

      e.preventDefault();
      useApp.getState().toggleHelp();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appReady]);

  if (!hydrated) {
    return <StartupScreen phase="visible" sessionReady={false} />;
  }

  return (
    <>
      <AppEventDebug />
      <div className="sv-shell h-screen w-screen bg-neutral-950 text-neutral-800">
        {active && appReady && <Hotkeys />}

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

          <PanelResizeHandle className="w-1 bg-neutral-700/50 hover:bg-neutral-500 cursor-col-resize transition-colors duration-150" />

          <Panel minSize={40}>
            <div className="flex flex-col h-full">
              <Toolbar />
              <div className="flex-1 overflow-hidden">
                <ViewerGrid
                  onImageLoadState={onStartupImageLoadState}
                />
              </div>
            </div>
          </Panel>
        </PanelGroup>
        <HelpOverlay />
      </div>
      {startupPhase !== "hidden" && (
        <StartupScreen
          phase={startupPhase}
          sessionReady
        />
      )}
    </>
  );
}
