/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect } from "react";
import tinykeys from "../lib/tinykeys-compat";
import { useApp } from "./store";
import { openFileDialog } from "./bridge";

function isEditableTarget(e: KeyboardEvent) {
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

function comboKeyId(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.metaKey) parts.push("meta");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  let k = e.key.toLowerCase();
  if (k === "arrowright") k = "arrowright";
  if (k === "arrowleft") k = "arrowleft";
  return parts.length ? parts.join("+") + "+" + k : k;
}

type StoreAny = ReturnType<typeof useApp.getState> & Record<string, any>;

function callSetActiveById(id: string) {
  const s = useApp.getState() as StoreAny;
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
  return false;
}

export default function Hotkeys() {
  const t = useApp((s) => s.getActive());
  const toggleDetails = useApp((s) => s.toggleDetails);
  const toggleLinkAll = useApp((s) => s.toggleLinkAll);
  const focusNext = useApp((s) => s.focusNext);
  const focusPrev = useApp((s) => s.focusPrev);
  const setFileForPane = useApp((s) => s.setFileForPane);
  const toggleGrid = useApp((s) => s.toggleGrid);
  const toggleLoupe = useApp((s) => s.toggleLoupe);
  const toggleHelp = useApp((s) => s.toggleHelp);
  const resetView = useApp((s) => s.resetView);
  const toggleDraw = useApp((s) => s.toggleDraw);
  const toggleErase = useApp((s) => s.toggleErase);
  const toggleText = useApp((s) => s.toggleText);
  const deleteTextBox = useApp((s) => s.deleteTextBox);

  const nextEmptyPaneId = useApp((s) => s.nextEmptyPaneId);

  const tabs = useApp((s) => s.tabs);

  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      E: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleLinkAll();
      },
      arrowright: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        focusNext();
      },
      arrowleft: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        focusPrev();
      },
      tab: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        focusNext();
      },
      R: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        if (t?.panes.length) toggleDetails(t.panes[t.focusIndex]);
      },
      V: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleLoupe();
      },
      H: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleHelp();
      },
      D: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        if (t?.panes?.length) resetView(t.panes[t.focusIndex]);
      },
      F: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleDraw();
      },
      G: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleErase();
      },
      T: (e) => {
        if (isEditableTarget(e)) return;
        e.preventDefault();
        toggleText();
      },
    });

    // 2) FALLBACK CHO TỔ HỢP (modifier) — fix WebView “không ăn combo”
    const onKeyDown = async (e: KeyboardEvent) => {
      if (isEditableTarget(e)) return;
      if (e.key === "Backspace" || e.key === "Delete") {
        const s = useApp.getState() as any;
        const t = s.getActiveSafe?.() ?? s.getActive?.();
        if (t?.textTool?.on) {
          if (!t.textUI?.editing) {
            let paneSel: any = null;
            let idSel: any = null;

            if (t.textUI?.editing) {
              paneSel = t.textUI.editing.pane;
              idSel = t.textUI.editing.id;
            } else {
              for (const p of ["A", "B", "C", "D"] as const) {
                const id = t.textUI?.selected?.[p] ?? null;
                if (id != null) {
                  paneSel = p;
                  idSel = id;
                  break;
                }
              }
            }

            if (paneSel != null && idSel != null) {
              e.preventDefault();
              e.stopPropagation();

              const panes = t.linkAll
                ? t.panes?.length
                  ? t.panes
                  : ["A", "B", "C", "D"]
                : [paneSel];

              deleteTextBox(panes, idSel);
              return;
            }
          }
        }
      }

      const id = comboKeyId(e);
      switch (id) {
        case "shift+tab":
          e.preventDefault();
          e.stopPropagation();
          console.debug("[HK] fallback shift+tab");
          focusPrev();
          return;

        case "ctrl+o":
        case "meta+o": {
          e.preventDefault();
          e.stopPropagation();
          console.debug("[HK] fallback", id, "→ open dialog");
          if (!t) return;
          const baseTarget = t.panes.length
            ? t.panes[t.focusIndex]
            : nextEmptyPaneId() ?? "D";

          const paths = await openFileDialog(baseTarget);
          if (!paths || !paths.length) return;

          // phân bổ paths: ưu tiên pane trống, hết trống thì replace pane đang focus
          for (const path of paths) {
            const empty = nextEmptyPaneId();
            const focused = t.panes.length ? t.panes[t.focusIndex] : baseTarget;
            const targetPane = empty ?? focused;

            console.debug("[HK] open assign", path, "->", targetPane);
            setFileForPane(targetPane, path);
          }
          return;
        }
        case "ctrl+1":
        case "meta+1":
        case "ctrl+2":
        case "meta+2":
        case "ctrl+3":
        case "meta+3":
        case "ctrl+4":
        case "meta+4":
        case "ctrl+5":
        case "meta+5":
        case "ctrl+6":
        case "meta+6":
        case "ctrl+7":
        case "meta+7":
        case "ctrl+8":
        case "meta+8":
        case "ctrl+9":
        case "meta+9": {
          e.preventDefault();
          e.stopPropagation();
          const n = parseInt(id.slice(-1), 10);
          const idx = n - 1;
          if (idx >= 0 && idx < (tabs?.length ?? 0)) {
            const target = tabs[idx];
            const ok = callSetActiveById(target.id);
            callSaveSession();
            console.debug("[Tabs]", id, "→", { n, idx, id: target.id, ok });
          }
          return;
        }
        case "ctrl+z":
        case "meta+z": {
          if (isEditableTarget(e)) return;
          e.preventDefault();
          useApp.getState().undo?.();
          return;
        }
        case "ctrl+y":
        case "meta+y": {
          if (isEditableTarget(e)) return;
          e.preventDefault();
          useApp.getState().redo?.();
          return;
        }
        case "ctrl+shift+z":
        case "meta+shift+z": {
          if (isEditableTarget(e)) return;
          e.preventDefault();
          useApp.getState().redo?.();
          return;
        }
        case "ctrl+v":
        case "meta+v":
          console.debug("[HK] paste combo detected");
          // KHÔNG cần preventDefault ở đây, để browser/WebView vẫn trigger sự kiện paste
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      unsubscribe?.();
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [
    t,
    tabs,
    toggleLinkAll,
    focusNext,
    focusPrev,
    setFileForPane,
    toggleGrid,
    toggleLoupe,
    toggleDetails,
    toggleHelp,
    resetView,
    nextEmptyPaneId,
    toggleDraw,
    toggleErase,
    toggleText,
    deleteTextBox,
  ]);

  return null;
}
