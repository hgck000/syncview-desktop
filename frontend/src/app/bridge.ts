// Simple wrapper cho window.pywebview.api
declare global {
  interface Window {
    pywebview?: { api: {
      open_dialog(pane: string): Promise<string | null>,
      read_image_dataurl(path: string): Promise<string | null>,
      read_exif_from_path(path: string): Promise<any | null>,
      read_exif_from_dataurl(dataurl: string): Promise<any | null>,
     }};
  }
}

export async function readExifFromPath(path: string) {
  console.log("[FE] readExifFromPath ->", path);
  return window.pywebview?.api?.read_exif_from_path
    ? await window.pywebview.api.read_exif_from_path(path)
    : null;
}
export async function readExifFromDataURL(dataurl: string) {
  console.log("[FE] readExifFromDataURL ->", dataurl?.slice(0,32)+"...");
  return window.pywebview?.api?.read_exif_from_dataurl
    ? await window.pywebview.api.read_exif_from_dataurl(dataurl)
    : null;
}

export async function openFileDialog(pane: string) {
  console.log("[FE] openFileDialog ->", pane);
  if (!window.pywebview?.api?.open_dialog) {
    console.warn("[FE] pywebview api not available");
    alert("Hãy chạy bằng backend/run_dev.py để dùng file dialog hệ thống.");
    return null;
  }
  const res = await window.pywebview.api.open_dialog(pane);
  console.log("[FE] openFileDialog <-", res);
  return res ?? null;
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
