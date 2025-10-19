// import tinykeys from "tinykeys";
import { useEffect } from "react";
import tinykeys from "../lib/tinykeys-compat";
import { useApp } from "./store";
import { openFileDialog } from "./bridge";

function isEditableTarget(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as any).isContentEditable || el.getAttribute?.("role")==="textbox";
}

// NEW: build id combo dạng 'ctrl+shift+tab', 'meta+o', 'ctrl+1'...
function comboKeyId(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  let k = e.key.toLowerCase();
  if (k === "arrowright") k = "arrowright";
  if (k === "arrowleft")  k = "arrowleft";
  return parts.length ? parts.join("+") + "+" + k : k;
}

// NEW: các helper “tự dò” tên hàm trong store để tránh lỗi đỏ
type StoreAny = ReturnType<typeof useApp.getState> & Record<string, any>;

function callSetActiveById(id: string) {
  const s = useApp.getState() as StoreAny;
  // thứ tự ưu tiên tên hàm thường gặp trong code tabs
  const fn =
    s.setActive ??
    s.setActiveTab ??
    s.setActiveTabId ??
    s.activate ??
    s.activateTab ??
    null;
  if (typeof fn === "function") {
    fn(id);
    return true;
  }
  console.warn("[Tabs] Không tìm thấy hàm setActive-like trong store");
  return false;
}

function callSaveSession() {
  const s = useApp.getState() as StoreAny;
  const fn =
    s.saveLastSession ??
    s.scheduleSave ??
    s.writeLastSession ??
    s.persistSession ??
    null;
  if (typeof fn === "function") {
    fn();
    return true;
  }
  // im lặng nếu không có, vì không bắt buộc
  return false;
}

export default function Hotkeys() {
  const t             = useApp(s => s.getActive());
  const toggleDetails = useApp(s => s.toggleDetails);
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  const focusNext     = useApp(s => s.focusNext);
  const focusPrev     = useApp(s => s.focusPrev);
  const setFileForPane= useApp(s => s.setFileForPane);
  const toggleGrid  = useApp(s => s.toggleGrid);
  const toggleLoupe = useApp(s => s.toggleLoupe);
  const toggleHelp = useApp(s => s.toggleHelp);

  const tabs            = useApp(s => s.tabs);

  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      "E": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); toggleLinkAll(); },
      "arrowright": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); focusNext(); },
      "arrowleft":  (e) => { if (isEditableTarget(e)) return; e.preventDefault(); focusPrev(); },
      "tab":        (e) => { if (isEditableTarget(e)) return; e.preventDefault(); focusNext(); },
      "shift+tab":  (e) => { if (isEditableTarget(e)) return; e.preventDefault(); focusPrev(); },
      "R": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); if (t.panes.length) toggleDetails(t.panes[t.focusIndex]); },
      "T": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); toggleGrid(); },  // Shift+3 trên US layout
      "F": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); toggleLoupe(); },
      "H": (e) => { if (isEditableTarget(e)) return; e.preventDefault(); toggleHelp(); },  // Shift+/
      "ctrl+o": async (e) => {
        if (isEditableTarget(e)) return; 
        e.preventDefault();
        const pane = t.panes[t.focusIndex];
        const path = await openFileDialog(pane);
        if (path) setFileForPane(pane, path);
      },
      "meta+o": async (e) => { // macOS Cmd+O
        if (isEditableTarget(e)) return; 
        e.preventDefault();
        const pane = t.panes[t.focusIndex];
        const path = await openFileDialog(pane);
        if (path) setFileForPane(pane, path);
      },
    });
    
 // 2) FALLBACK CHO TỔ HỢP (modifier) — fix WebView “không ăn combo”
    const onKeyDown = async (e: KeyboardEvent) => {
      if (isEditableTarget(e)) return;

      const id = comboKeyId(e);
      switch (id) {
        case "shift+tab":
          e.preventDefault(); e.stopPropagation();
          console.debug("[HK] fallback shift+tab");
          focusPrev();
          return;

        case "ctrl+o":
        case "meta+o":
          e.preventDefault(); e.stopPropagation();
          console.debug("[HK] fallback", id);
          if (!t?.panes?.length) return;
          {
            const pane = t.panes[t.focusIndex];
            const path = await openFileDialog(pane);
            if (path) setFileForPane(pane, path);
          }
          return;

        // Ctrl+1..9 → nhảy tab 1..9 (1-based)
        case "ctrl+1":
        case "ctrl+2":
        case "ctrl+3":
        case "ctrl+4":
        case "ctrl+5":
        case "ctrl+6":
        case "ctrl+7":
        case "ctrl+8":
        case "ctrl+9": {
          e.preventDefault(); e.stopPropagation();
          const n = parseInt(id.slice(-1), 10);   // 1..9
          const idx = n - 1;                      // 0..8
          if (idx >= 0 && idx < (tabs?.length ?? 0)) {
            const target = tabs[idx];
            const ok = callSetActiveById(target.id);
            callSaveSession();
            console.debug("[Tabs] ctrl+number →", { n, idx, id: target.id, ok });
          }
          return;
        }

        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      unsubscribe?.();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  // thêm deps tabs để cập nhật số tab
  }, [t, tabs, toggleLinkAll, focusNext, focusPrev, setFileForPane, toggleGrid, toggleLoupe, toggleDetails, toggleHelp]);

  return null;
}