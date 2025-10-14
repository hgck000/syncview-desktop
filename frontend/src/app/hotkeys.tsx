import { useEffect } from "react";
// import tinykeys from "tinykeys";
import tinykeys from "../lib/tinykeys-compat";   // ⬅️ đổi sang adapter
import { useApp } from "./store";
import { openFileDialog } from "./bridge";

export default function Hotkeys() {
  const t             = useApp(s => s.getActive());
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  // const cycleLayout   = useApp(s => s.cycleLayout);
  // const setLayout     = useApp(s => s.setLayout);
  const focusNext     = useApp(s => s.focusNext);
  const focusPrev     = useApp(s => s.focusPrev);
  const setFileForPane= useApp(s => s.setFileForPane);

  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      "l": (e) => { e.preventDefault(); toggleLinkAll(); },
      // "1": (e) => { e.preventDefault(); setLayout("1up"); },
      // "2": (e) => { e.preventDefault(); setLayout("2up"); },
      // "]": (e) => { e.preventDefault(); cycleLayout(); },
      "arrowright": (e) => { e.preventDefault(); focusNext(); },
      "arrowleft":  (e) => { e.preventDefault(); focusPrev(); },
      "tab":        (e) => { e.preventDefault(); focusNext(); },
      "shift+tab":  (e) => { e.preventDefault(); focusPrev(); },
      "ctrl+o": async (e) => {
        e.preventDefault();
        const pane = t.panes[t.focusIndex];
        const path = await openFileDialog(pane);
        if (path) setFileForPane(pane, path);
      },
      "meta+o": async (e) => { // macOS Cmd+O
        e.preventDefault();
        const pane = t.panes[t.focusIndex];
        const path = await openFileDialog(pane);
        if (path) setFileForPane(pane, path);
      },
    });
    return () => unsubscribe();
  }, [t, toggleLinkAll, focusNext, focusPrev, setFileForPane]);

  return null;
}