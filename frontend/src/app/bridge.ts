// Simple wrapper cho window.pywebview.api
declare global {
  interface Window {
    pywebview?: { api: { open_dialog(pane: string): Promise<string | null> } };
  }
}

export async function openFileDialog(pane: string): Promise<string | null> {
  if (window.pywebview?.api?.open_dialog) {
    try { return await window.pywebview.api.open_dialog(pane); }
    catch { return null; }
  } else {
    alert("Không chạy trong PyWebview: mở app dev bằng backend/run_dev.py để dùng file dialog hệ thống.");
    return null;
  }
}
