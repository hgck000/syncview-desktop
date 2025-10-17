import { useApp } from "../app/store";

export default function HelpOverlay() {
  const helpOn = useApp(s => s.helpOn);
  const toggleHelp = useApp(s => s.toggleHelp);
  if (!helpOn) return null;

  const Row = ({k, d}:{k:string; d:string}) => (
    <div className="flex items-center justify-between py-1">
      <div className="text-neutral-300">{d}</div>
      <kbd className="px-2 py-0.5 rounded bg-neutral-700">{k}</kbd>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={toggleHelp}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-5 w-[720px] max-w-[95%]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Keybind Guide</h2>
          <button onClick={toggleHelp} className="text-neutral-400 hover:text-neutral-100">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2">File & Link</div>
            <Row k="Ctrl/Cmd + O" d="Open file" />
            <Row k="E" d="Đồng bộ các ảnh" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2">Viewer</div>
            <Row k="Wheel" d="Zoom in/out" />
            <Row k="Double-click" d="Fit ↔ Zoom x2" />
            <Row k="R" d="Hiển thị thông số" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2">Loupe & Grid</div>
            <Row k="T" d="Bật/tắt lưới tĩnh theo viewer" />
            <Row k="F" d="Bật/tắt kính lúp" />
            <Row k="Drag (chuột phải)" d="Đổi kích thước lúp" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2">Author</div>
            <Row k="Author" d="Nguyễn Quang Minh" />
            <Row k="Github" d="github.com/hgck000" />
          </div>
        </div>

        <div className="mt-3 text-xs text-neutral-400">
          Nhấn <b>H</b> lần nữa để đóng • Các thao tác chuột áp dụng cho cả Windows & macOS.
        </div>
      </div>
    </div>
  );
}
