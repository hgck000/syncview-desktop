import { useEffect } from "react";
import { readKeymap } from "./bridge";
import { useApp } from "./store";

export function useLoadKeymap() {
  const setKeymap = useApp(s => s.setKeymap);
  useEffect(() => {
    (async () => {
      const km = await readKeymap();
      if (km) setKeymap(km);
    })();
  }, [setKeymap]);
}
