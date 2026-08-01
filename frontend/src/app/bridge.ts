/* eslint-disable @typescript-eslint/no-explicit-any */
import { preloadHtmlImage } from "./imageLoader";

declare global {
  interface Window {
    pywebview?: {
      api: {
        open_dialog(pane: string): Promise<string[] | string | null>;
        get_image_url?(path: string): Promise<string | null>;
        persist_image_dataurl?(
          dataurl: string,
          suggested_name?: string
        ): Promise<string | null>;
        stage_image_dataurl?(dataurl: string): Promise<string | null>;
        read_image_dataurl(path: string): Promise<string | null>;
        read_image_thumbnail?(
          path: string,
          max_width: number,
          max_height: number
        ): Promise<string | null>;
        read_exif_from_path(path: string): Promise<any | null>;
        read_exif_from_dataurl(dataurl: string): Promise<any | null>;
        reverse_geocode?: (
          latitude: number,
          longitude: number
        ) => Promise<ReverseGeocodeResult | null>;
        read_keymap?: () => Promise<Record<string, string> | null>;
        save_png_dialog?: (
          dataurl: string,
          suggested_name: string
        ) => Promise<string | null>;
        save_image_dialog?: (
          dataurl: string,
          suggested_name: string,
          image_format: "png" | "jpeg"
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
export type ReverseGeocodeResult = {
  name: string;
  attribution: string;
};

const browserImageDataUrl =
  /^data:image\/(?:gif|jpe?g|png|webp);base64,/i;
const stagedDataUrlSources = new Map<string, Promise<string | null>>();
const MAX_STAGED_DATA_URL_SOURCES = 16;
const localImageSources = new Map<string, Promise<string | null>>();

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

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult | null> {
  try {
    const api = await waitForPywebviewApi();
    if (!api?.reverse_geocode) return null;
    return (await api.reverse_geocode(latitude, longitude)) ?? null;
  } catch (error) {
    console.warn("[bridge] reverseGeocode error", error);
    return null;
  }
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

export async function persistImageDataURL(
  dataurl: string,
  suggestedName?: string,
): Promise<string | null> {
  try {
    const api = await waitForPywebviewApi();
    if (!api?.persist_image_dataurl) return null;
    return (
      (await api.persist_image_dataurl(dataurl, suggestedName)) ?? null
    );
  } catch (error) {
    console.warn("[bridge] persist_image_dataurl failed", error);
    return null;
  }
}

export function invalidateImageSource(path?: string) {
  if (path) localImageSources.delete(path);
}

export async function readImageSource(path: string) {
  const cached = localImageSources.get(path);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const api = await waitForPywebviewApi();
      if (api?.get_image_url) {
        const url = await api.get_image_url(path);
        if (url) return url;
      }
    } catch (error) {
      console.warn(
        "[bridge] get_image_url failed, using DataURL fallback",
        error,
      );
    }
    return readImageDataURL(path);
  })();

  localImageSources.set(path, pending);

  const resolved = await pending;
  // A fallback DataURL can be hundreds of megabytes. Do not keep another copy
  // in this short URL cache; the decoded-image cache handles its lifetime.
  if (!resolved || resolved.startsWith("data:")) {
    localImageSources.delete(path);
  }
  return resolved;
}

export async function readDataUrlImageSource(
  dataurl: string,
): Promise<string | null> {
  // These formats are decoded natively and should avoid backend work.
  if (browserImageDataUrl.test(dataurl)) return dataurl;

  const cached = stagedDataUrlSources.get(dataurl);
  if (cached) return cached;

  const pending = (async () => {
    try {
      const api = await waitForPywebviewApi();
      if (!api?.stage_image_dataurl) {
        console.warn("[bridge] stage_image_dataurl api not available");
        return null;
      }
      return (await api.stage_image_dataurl(dataurl)) ?? null;
    } catch (error) {
      console.warn("[bridge] stage_image_dataurl failed", error);
      return null;
    }
  })();

  if (stagedDataUrlSources.size >= MAX_STAGED_DATA_URL_SOURCES) {
    const oldest = stagedDataUrlSources.keys().next().value;
    if (oldest) stagedDataUrlSources.delete(oldest);
  }
  stagedDataUrlSources.set(dataurl, pending);

  const resolved = await pending;
  if (!resolved) stagedDataUrlSources.delete(dataurl);
  return resolved;
}

export async function prewarmImageSource(
  path?: string,
  dataurl?: string,
): Promise<boolean> {
  try {
    const source = dataurl
      ? await readDataUrlImageSource(dataurl)
      : path
        ? await readImageSource(path)
        : null;

    if (!source) return false;
    // This reaches HTMLImageElement.decode(), not merely response.blob().
    // A warmed image is therefore immediately drawable when its tab mounts.
    return await preloadHtmlImage(source);
  } catch (error) {
    console.warn("[bridge] image prewarm failed", error);
    return false;
  }
}

export async function readImageThumbnail(
  path: string,
  maxWidth = 384,
  maxHeight = 384
) {
  try {
    const api = await waitForPywebviewApi();
    if (!api?.read_image_thumbnail) return null;
    return (
      (await api.read_image_thumbnail(path, maxWidth, maxHeight)) ?? null
    );
  } catch (error) {
    console.warn("[bridge] readImageThumbnail error", error);
    return null;
  }
}

async function waitForPywebviewApi(maxWaitMs = 3000): Promise<any | null> {
  const getApi = () => (window as any)?.pywebview?.api ?? null;

  const initialApi = getApi();
  if (initialApi) return initialApi;

  // The ready event can fire before React installs this listener. Poll at the
  // same time so startup never waits for a timeout after the API already exists.
  return new Promise<any | null>((resolve) => {
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;

    const finish = (api: any | null) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(timeoutTimer);
      window.removeEventListener("pywebviewready", onReady as any);
      resolve(api);
    };

    const check = () => {
      const api = getApi();
      if (api) finish(api);
    };

    const onReady = () => {
      check();
    };

    window.addEventListener("pywebviewready", onReady as any);
    pollTimer = window.setInterval(check, 50);
    timeoutTimer = window.setTimeout(() => finish(null), maxWaitMs);

    // Close the small race between the initial check and listener setup.
    check();
  });
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

export async function saveImageDialog(
  dataurl: string,
  suggestedName: string,
  format: "png" | "jpeg",
): Promise<string | null> {
  const api = await waitForPywebviewApi();
  if (api?.save_image_dialog) {
    return (
      (await api.save_image_dialog(dataurl, suggestedName, format)) ?? null
    );
  }

  // A PNG export can still work against an older backend during development.
  if (format === "png" && api?.save_png_dialog) {
    return (await api.save_png_dialog(dataurl, suggestedName)) ?? null;
  }

  alert("Save dialog chưa sẵn sàng. Hãy khởi động lại backend mới nhất.");
  return null;
}
