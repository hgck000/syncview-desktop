import { useApp } from "../app/store";
import { buildFeatures } from "../app/buildFeatures";
import { X } from "lucide-react";

export default function HelpOverlay() {
  const helpOn = useApp((s) => s.helpOn);
  const toggleHelp = useApp((s) => s.toggleHelp);
  if (!helpOn) return null;

  const Row = ({ k, d }: { k: string; d: string }) => (
    <div className="flex items-center justify-between py-1">
      <div className="text-neutral-300">{d}</div>
      {k.trim() ? (
        <kbd className="px-2 py-0.5 rounded bg-neutral-300 text-black">{k}</kbd>
      ) : null}
    </div>
  );

  return (
    <div
      className="sv-overlay-enter fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center"
      onClick={toggleHelp}
    >
      <div
        className="sv-dialog-enter bg-neutral-950/95 border border-neutral-700 rounded-xl p-5 w-[720px] max-w-[95%]
                   shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
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
                      active:scale-90 cursor-pointer
                      transition-[background-color,color,transform] duration-200 ease-out"
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
            <Row k="R" d="Show EXIF" />
            <Row k="E" d="Link pictures" />
            <Row k="D" d="Reset view" />
            <Row k="1–4" d="Switch image in Blink mode" />
            <Row k="Ctrl+num/Cmd+num" d="Switch tab" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3">
            <div className="font-medium mb-2 text-neutral-100">Tools</div>
            <Row k="F" d="on/off brush" />
            <Row k="G" d="on/off erase" />
            <Row k="T" d="on/off text" />
            <Row k="S" d="on/off shape" />
            <Row k="Shift+drag" d="circle / square / snap angle" />
            <Row k="V" d="on/off loup" />
            <Row k="Drag right mouse" d="adjust tool size" />
          </div>

          <div className="bg-neutral-800/50 rounded p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium mb-2 text-neutral-100">Author</div>
              <Row k="" d="Nguyễn Quang Minh" />
              <Row k="" d="github.com/hgck000" />
            </div>

            {buildFeatures.coffee ? (
              <div className="shrink-0">
                <div className="font-medium mb-2 text-neutral-100 flex justify-center">
                  Buy me a coffee
                </div>
                <img
                  src="/syncview-qr.png"
                  alt="SyncView QR"
                  draggable={false}
                  className="w-35 h-35 rounded bg-white p-1"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 text-xs text-neutral-400">
          Press <b>H</b> again to close
        </div>
      </div>
    </div>
  );
}
