import { useEffect } from "react";
// import tinykeys from "tinykeys";
import tinykeys from "../lib/tinykeys-compat";   // ⬅️ đổi sang adapter
import { useApp } from "./store";

export default function Hotkeys() {
  const toggleLinkAll = useApp(s => s.toggleLinkAll);
  const cycleLayout  = useApp(s => s.cycleLayout);
  const setLayout    = useApp(s => s.setLayout);
  const focusNext    = useApp(s => s.focusNext);
  const focusPrev    = useApp(s => s.focusPrev);

  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      "l": (e) => { e.preventDefault(); toggleLinkAll(); },       // L = Link All on/off
      "g": (e) => { e.preventDefault(); /* Grid toggle (sẽ nối sau) */ },
      "1": (e) => { e.preventDefault(); setLayout("1up"); },
      "2": (e) => { e.preventDefault(); /* 100% zoom sau này */ setLayout("2up"); },
      "r": (e) => { e.preventDefault(); /* Reset view (sẽ nối sau) */ },
      "ctrl+o": (e) => { e.preventDefault(); /* Open for focused pane (nối bridge sau) */ },
      "arrowright": (e) => { e.preventDefault(); focusNext(); },
      "arrowleft":  (e) => { e.preventDefault(); focusPrev(); },
      "shift+tab":  (e) => { e.preventDefault(); focusPrev(); },
      "tab":        (e) => { e.preventDefault(); focusNext(); },
      "space":      (e) => { e.preventDefault(); /* A/B toggle khi 1-up (sau) */ },
      // Layout cycle nhanh:
      "]":          (e) => { e.preventDefault(); cycleLayout(); },
    });
    return () => unsubscribe();
  }, [toggleLinkAll, cycleLayout, setLayout, focusNext, focusPrev]);

  return null;
}
