import { useApp } from "../app/store";
import { basename } from "../app/path";
import { useImageCanvas } from "../app/useImageCanvas";
import { useRef, useState, useEffect } from "react";
import { readExifFromPath, readExifFromDataURL } from "../app/bridge";


type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  const t = useApp(s => s.getActive());
  const idx = t.panes.indexOf(id);
  const focused = idx === t.focusIndex;

  const path = t.files[id];
  const data = t.dataURL[id];
  const label = t.names[id] ?? basename(path) ?? `${id}: Empty`;
  const view = t.view[id];
  

  const setMeta  = useApp(s => s.setImageMeta);
  const setSize    = useApp(s => s.setPaneSize);   // <— NEW
  const applyPan = useApp(s => s.applyPan);
  const applyZoom= useApp(s => s.applyZoom);
  const resetView= useApp(s => s.resetView);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{x:number; y:number} | null>(null);

  // lưu vị trí con trỏ đã biết (chuẩn hoá) để dblclick dùng đúng chỗ đó
  const lastNormRef = useRef<{u:number; v:number}>({u:0.5, v:0.5});

  const grid = t.grid;

  const canvasRef = useImageCanvas({
    path, dataURL: data, view, grid,
    onImageMeta: (w,h) => setMeta(id, w, h),
  });

  const exif = t.exif[id];
  const showDetails = t.showDetails[id];
  const setExif = useApp(s => s.setExif);
  const toggleDetails = useApp(s => s.toggleDetails);
  
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      setSize(id, Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));

      // setSize(id, Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, setSize]);

  // const name = basename(path) ?? `${id}: Empty`;
  async function onToggleDetails() {
    // bật panel trước để có phản hồi
    toggleDetails(id);

    // nếu chưa có EXIF thì fetch (theo path hoặc dataURL)
    if (!exif && (path || data)) {
      const info = path
        ? await readExifFromPath(path)
        : await readExifFromDataURL(data!);
      setExif(id, info || {});
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!path && !data) return;
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onMouseMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    // if (rect) {
    //   lastNormRef.current = {
    //     u: (e.clientX - rect.left) / rect.width,
    //     v: (e.clientY - rect.top) / rect.height,
    //   };
    // }
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top)  / rect.height;
      lastNormRef.current = { u: uN, v: vN };
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ x: e.clientX, y: e.clientY });
    applyPan(id, dx, dy);
  }
  function onMouseUp() { setDrag(null); }
  function onMouseLeave() { setDrag(null); }

  // function onWheel(e: React.WheelEvent) {
  //   if (!path && !data) return;
  //   e.preventDefault();
  //   const rect = wrapRef.current?.getBoundingClientRect();
  //   const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
  //   if (rect) {
  //     const u = (e.clientX - rect.left) / rect.width;
  //     const v = (e.clientY - rect.top)  / rect.height;
  //     lastNormRef.current = {u, v}; // ghi nhớ để dblclick kế tiếp hợp lý
  //     applyZoom(id, factor, { type: 'norm', u, v });
  //   } else {
  //     applyZoom(id, factor, { type: 'norm', u: 0.5, v: 0.5 });
  //   }
  // }

  function onWheel(e: React.WheelEvent) {
    if (!path && !data) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top)  / rect.height;
      lastNormRef.current = { u: uN, v: vN };
      applyZoom(id, factor, { type: 'norm', u: uN, v: vN });
    } else {
      applyZoom(id, factor, { type: 'norm', u: 0.5, v: 0.5 });
    }
  }

  function onDoubleClick() {
    // Toggle Fit<->100%
    if (!wrapRef.current || (!path && !data)) return;
    const { u, v } = lastNormRef.current; // dùng đúng vị trí con trỏ đã lưu
    if (Math.abs(view.scale - 1) < 0.01) {
      // 100% = scale sao cho total = 1 * (cw/iw)^{-1}? Không—ta coi 1 là fit.
      // Ở đây: phóng to gấp 2 lần fit cho dễ thấy.
      applyZoom(id, 3, { type: 'norm', u, v });  // <— Link All sẽ áp cho tất cả
    } else {
      resetView(id);
    }
  }

  return (
    // <div className={`relative min-h-0 bg-neutral-900 border rounded ${focused ? "border-blue-600" : "border-neutral-800"}`}>
    <div
      ref={wrapRef}
      className={`relative min-h-0 bg-neutral-900 border rounded overflow-hidden ${focused ? "border-blue-600" : "border-neutral-800"}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}  
    >
      
      <div className="absolute top-0 left-0 right-0 h-7 px-2 flex items-center justify-between bg-neutral-900/90 border-b border-neutral-800 text-xs z-10">
        <div className="truncate">{label}</div>
        <div className="text-neutral-400">{Math.round(view.scale*100)}%</div>
        {/* <button className="text-neutral-400 hover:text-neutral-200">Details ▾</button> */}
        <button onClick={onToggleDetails} className="text-neutral-400 hover:text-neutral-200">
          Details ▾
          {showDetails && (path || data) && (
            <div className="absolute top-7 left-0 right-0 z-10 bg-neutral-950/95 border-b border-neutral-800 p-2 text-[12px] leading-5">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span><b>Make</b>: {exif?.Make ?? "-"}</span>
                <span><b>Model</b>: {exif?.Model ?? "-"}</span>
                <span><b>Date</b>: {exif?.DateTimeOriginal ?? "-"}</span>
                <span><b>ƒ</b>: {exif?.FNumber ? `ƒ${exif.FNumber}` : "-"}</span>
                <span><b>ISO</b>: {exif?.ISOSpeedRatings ?? "-"}</span>
                <span><b>Shutter</b>: {exif?.ExposureTime ? `${exif.ExposureTime}s` : "-"}</span>
                <span><b>Focal</b>: {exif?.FocalLength ? `${exif.FocalLength}mm` : "-"}</span>
                <span><b>Size</b>: {view.imgW && view.imgH ? `${view.imgW}×${view.imgH}` : "-"}</span>
                <span><b>Lens</b>: {exif?.LensModel ?? "-"}</span>
                <span><b>Orient</b>: {exif?.Orientation ?? "-"}</span>
              </div>
            </div>
          )}
        </button>
      </div>


      <div className="h-full min-h-[180px] pt-7">
        {path || data ? (
          <canvas ref={canvasRef} className="w-full h-full block bg-black" />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 select-none">Empty • {id}</div>
        )}
      </div>
    </div>
  );
}
