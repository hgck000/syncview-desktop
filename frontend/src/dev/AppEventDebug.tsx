import { useEffect } from "react";

export default function AppEventDebug() {
  useEffect(() => {
    const mk = (label: string) => (e: Event) => {
      const t = e.target as HTMLElement | null;
      const info = t ? `${t.tagName}.${t.className || ""}` : "null";
      console.debug(`[EV] ${label}`, { info, id: t?.id });
    };
    const opts: AddEventListenerOptions = { capture: true };

    window.addEventListener("pointerdown", mk("window pointerdown"), opts);
    window.addEventListener("mousedown",   mk("window mousedown"),   opts);
    window.addEventListener("click",       mk("window click"),       opts);
    document.addEventListener("pointerdown", mk("doc pointerdown"), opts);
    document.addEventListener("mousedown",   mk("doc mousedown"),   opts);

    return () => {
      window.removeEventListener("pointerdown", mk("window pointerdown"), opts);
      window.removeEventListener("mousedown",   mk("window mousedown"),   opts);
      window.removeEventListener("click",       mk("window click"),       opts);
      document.removeEventListener("pointerdown", mk("doc pointerdown"), opts);
      document.removeEventListener("mousedown",   mk("doc mousedown"),   opts);
    };
  }, []);
  return null;
}
