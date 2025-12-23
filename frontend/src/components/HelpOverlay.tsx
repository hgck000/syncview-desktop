import { useApp } from "../app/store";
import { X } from "lucide-react";

export default function HelpOverlay() {
  const helpOn = useApp((s) => s.helpOn);
  const toggleHelp = useApp((s) => s.toggleHelp);
  if (!helpOn) return null;

  const Row = ({ k, d }: { k: string; d: string }) => (
    <div className="flex items-center justify-between py-1">
      <div className="text-neutral-300">{d}</div>
      <kbd className="px-2 py-0.5 rounded bg-neutral-300 text-black">{k}</kbd>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      onClick={toggleHelp}
    >
      <div
        className="bg-black border border-neutral-700 rounded-xl p-5 w-[720px] max-w-[95%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-neutral-100 font-semibold">Keybind Guide</h2>

          <div
            onClick={toggleHelp}
            title="Close"
            className="w-7 h-7 rounded-md flex items-center justify-center
                      text-neutral-400 hover:text-neutral-100
                      hover:bg-[rgba(211,213,216,0.10)]
                      active:scale-95 cursor-pointer transition"
          >
            <X className="w-6 h-6" strokeWidth={2.2} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2 text-neutral-100">File</div>
            <Row k="Ctrl+O/Cmd+O" d="Open file" />
            <Row k="Ctrl+V/Cmd+V" d="Enter picture" />
            <Row k="Double-click" d="Fit ↔ Zoom x2" />
            <Row k="Wheel" d="Zoom in/out" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2 text-neutral-100">View</div>
            <Row k="R" d="Hiển thị thông số" />
            <Row k="E" d="Đồng bộ các ảnh" />
            <Row k="D" d="Reset view" />
            <Row k="Ctl+num/Cmd+num" d="Đổi tab" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2 text-neutral-100">Tools</div>
            <Row k="F" d="Bật/tắt bút vẽ" />
            <Row k="G" d="Bật/tắt tẩy xóa" />
            <Row k="V" d="Bật/tắt kính lúp" />
            <Row k="Kéo chuột phải" d="Phóng to công cụ" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2 text-neutral-100">Author</div>
            <Row k="Author" d="Nguyễn Quang Minh" />
            <Row k="Github" d="github.com/hgck000" />
          </div>
        </div>

        <div className="mt-3 text-xs text-neutral-400">
          Nhấn <b>H</b> lần nữa để đóng • Các thao tác chuột áp dụng cho cả
          Windows & macOS.
        </div>
      </div>
    </div>
  );
}
