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
    
    return () => unsubscribe();
  }, [t, toggleLinkAll, focusNext, focusPrev, setFileForPane,
      toggleGrid, toggleLoupe, toggleDetails,
      toggleHelp
      // activePaneId    
    ]);
  return null;
}