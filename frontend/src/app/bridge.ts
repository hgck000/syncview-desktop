/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    pywebview?: {
      api: {
        open_dialog(pane: string): Promise<string | null>;
        read_image_dataurl(path: string): Promise<string | null>;
        read_exif_from_path(path: string): Promise<any | null>;
        read_exif_from_dataurl(dataurl: string): Promise<any | null>;
        read_keymap?: () => Promise<Record<string, string> | null>;
        save_png_dialog?: (
          dataurl: string,
          suggested_name: string
        ) => Promise<string | null>;
      };
    };
    api?: {
      read_keymap?: () => Promise<Record<string, string> | null>;
    };
  }
}
// export {};

export type Keymap = Record<string, string>;

export async function readKeymap(): Promise<Keymap | null> {
  try {
    // 1) Ưu tiên gọi API từ backend (pywebview expose)
    const api = window.pywebview?.api ?? window.api;
    if (api?.read_keymap) {
      const km = await api.read_keymap();
      if (km && typeof km === "object") return km as Keymap;
    }
  } catch {
    /* ignore */
  }

  try {
    // 2) Fallback: localStorage (nếu bạn có lưu ở FE)
    const raw = localStorage.getItem("keymap");
    if (raw) return JSON.parse(raw) as Keymap;
  } catch {
    /* ignore */
  }

  return null;
}

export async function readExifFromPath(path: string) {
  console.log("[FE] readExifFromPath ->", path);
  // console.log(exif)
  return window.pywebview?.api?.read_exif_from_path
    ? await window.pywebview.api.read_exif_from_path(path)
    : null;
}

export async function readExifFromDataURL(dataurl: string) {
  console.log("[FE] readExifFromDataURL ->", dataurl?.slice(0, 32) + "...");
  return window.pywebview?.api?.read_exif_from_dataurl
    ? await window.pywebview.api.read_exif_from_dataurl(dataurl)
    : null;
}

export async function openFileDialog(pane: string): Promise<string[] | null> {
  console.log("[FE] openFileDialog ->", pane);
  if (!window.pywebview?.api?.open_dialog) {
    console.warn("[FE] pywebview api not available");
    alert("Hãy chạy bằng backend/run_dev.py để dùng file dialog hệ thống.");
    return null;
  }
  const res = await window.pywebview.api.open_dialog(pane);
  console.log("[FE] openFileDialog <-", res);
  if (!res) return null;
  // backend nên trả về [] hoặc ["path1", "path2", ...]
  return Array.isArray(res) ? (res as string[]) : [String(res)];
}

export async function readImageDataURL(path: string) {
  console.log("[FE] readImageDataURL ->", path);
  if (!window.pywebview?.api?.read_image_dataurl) {
    console.warn("[FE] read_image_dataurl api not available");
    return null;
  }
  const res = await window.pywebview.api.read_image_dataurl(path);
  console.log("[FE] readImageDataURL <-", res ? "ok" : "null");
  return res;
}

async function waitForPywebviewApi(maxWaitMs = 3000): Promise<any | null> {
  const hasApi = () => (window as any)?.pywebview?.api;

  if (hasApi()) return hasApi();

  // Wait for event first
  const api = await new Promise<any | null>((resolve) => {
    const t = setTimeout(() => resolve(null), maxWaitMs);
    const onReady = () => {
      clearTimeout(t);
      resolve(hasApi() || null);
      window.removeEventListener("pywebviewready", onReady as any);
    };
    window.addEventListener("pywebviewready", onReady as any);
  });

  if (api) return api;
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    if (hasApi()) return hasApi();
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

export async function readLastSession(): Promise<any | null> {
  try {
    const api = await waitForPywebviewApi();
    if (!api) {
      console.warn(
        "[bridge] pywebview api not ready -> readLastSession skipped"
      );
      return null;
    }
    const data = await api.read_last_session();
    return data ?? null;
  } catch (e) {
    console.error("[bridge] readLastSession error", e);
    return null;
  }
}

export async function writeLastSession(data: any): Promise<boolean> {
  try {
    const api = await waitForPywebviewApi();
    if (!api) {
      console.warn(
        "[bridge] pywebview api not ready -> writeLastSession skipped"
      );
      return false;
    }
    return !!(await api.write_last_session(data));
  } catch (e) {
    console.error("[bridge] writeLastSession error", e);
    return false;
  }
}

export async function savePngDialog(
  dataurl: string,
  suggestedName: string
): Promise<string | null> {
  const api = await waitForPywebviewApi();
  if (!api?.save_png_dialog) {
    alert("Save dialog chưa sẵn sàng. Hãy chạy bằng backend (pywebview).");
    return null;
  }
  return (await api.save_png_dialog(dataurl, suggestedName)) ?? null;
}
