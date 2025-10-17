import { useApp } from "../app/store";
import { basename } from "../app/path";
import { useImageCanvas } from "../app/useImageCanvas";
import { useRef, useState, useEffect } from "react";
import { readExifFromPath, readExifFromDataURL } from "../app/bridge";
import { X, ChevronDown, ChevronUp, Camera, Calendar, MapPin, HardDrive, Aperture, Timer, SunMedium } from "lucide-react";


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
  const loupe = t.loupe;
  
  const pointer = t.pointerNorm[id];
  const canvasRef = useImageCanvas({
    path, dataURL: data, view, grid, loupe, pointer,
    onImageMeta: (w,h) => setMeta(id, w, h),
  });
  const exif = t.exif[id];
  const showDetails = t.showDetails[id];
  const setExif = useApp(s => s.setExif);
  const toggleDetails = useApp(s => s.toggleDetails);

  const setPointerNorm = useApp(s => s.setPointerNorm);
  const setPointerNormAll= useApp(s => s.setPointerNormAll);
  const setLoupeSize     = useApp(s => s.setLoupeSize);

  const [rdrag, setRdrag] = useState<{startX:number; startSize:number} | null>(null);

  const clearPane     = useApp(s => s.clearPane);          // hoặc action xoá sẵn có của bạn
  // Tên ảnh hiển thị
  const displayName =
    t.names[id] ??
    (t.files[id] ? basename(t.files[id]!) : (t.dataURL[id] ? "(dropped image)" : "(Empty)"));

  // Thiết bị
  const device =
    (exif?.Make && exif?.Model) ? `${exif.Make} ${exif.Model}` :
    (exif?.Model || exif?.Make || "—");

  // Kích thước gốc (đã set qua onImageMeta ở useImageCanvas)
  const sizeLabel = (view.imgW && view.imgH) ? `${view.imgW}×${view.imgH}` : "—";


  
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


  function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <div className="text-neutral-300">{icon}</div>
        <div className="text-neutral-400 w-20 shrink-0 text-[12px] font-semibold">{label}</div>
        <div className="text-neutral-100 truncate" title={value}>{value ?? "—"}</div>
      </div>
    );
  }

  function fmtFileSize(bytes?: number|string) {
    const b = Number(bytes);
    if (!isFinite(b) || b <= 0) return undefined;
    const units = ["B","KB","MB","GB","TB"];
    let i = 0, n = b;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    const v = n < 10 && i > 0 ? n.toFixed(1) : Math.round(n).toString();
    return `${v} ${units[i]}`;
  }

  function fmtDate(s?: string) {
    if (!s) return undefined;
    // EXIF thường "YYYY:MM:DD HH:MM:SS"
    const norm = s.replace(/^(\d{4}):(\d{2}):(\d{2})\s+/, "$1-$2-$3 ");
    return norm;
  }

  function fmtShutter(v: number) {
    return v < 1 ? `1/${Math.round(1 / v)}` : `${v}s`;
  }

  function fmtIso(exif: any) {
    return String(exif?.ISOSpeedRatings ?? exif?.PhotographicSensitivity ?? "");
  }

  function fmtGps(exif: any) {
    const lat = exif?.GPSLatitude, lon = exif?.GPSLongitude;
    if (lat == null || lon == null) return undefined;
    const f = (x:number)=> (Math.abs(x).toFixed(6));
    return `${lat >= 0 ? "" : "-"}${f(lat)}, ${lon >= 0 ? "" : "-"}${f(lon)}`;
  }


//   function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
//   return (
//     <div className="flex items-start gap-2">
//       <div className="text-neutral-300 mt-[1px]">{icon}</div>
//       <div className="flex-1 min-w-0">
//         <div className="text-neutral-400">{label}</div>
//         <div className="text-neutral-200 truncate">{value ?? "—"}</div>
//       </div>
//     </div>
//   );
// }
//   function fmtFileSize(bytes?: number|string) {
//     const b = Number(bytes);
//     if (!isFinite(b) || b <= 0) return undefined;
//     const units = ["B","KB","MB","GB"];
//     let i = 0, n = b;
//     while (n >= 1024 && i < units.length-1) { n /= 1024; i++; }
//     return `${n % 1 ? n.toFixed(1) : n} ${units[i]}`;
//   }
//   function fmtDate(s?: string) {
//     if (!s) return undefined;
//     // EXIF DateTimeOriginal thường "YYYY:MM:DD HH:MM:SS"
//     const t = s.replace(/:/, "-").replace(/:/, "-"); // khá đủ cho hiển thị
//     return t;
//   }
//   function fmtShutter(v: number) {
//     // nếu < 1 → 1/x, nếu >=1 → x s
//     return v < 1 ? `1/${Math.round(1/v)}` : `${v}s`;
//   }
//   function fmtGps(exif: any) {
//     // nếu BE chưa parse GPS → trả undefined (sau này có thể bổ sung bridge đọc GPS)
//     const lat = exif?.GPSLatitude;
//     const lon = exif?.GPSLongitude;
//     if (lat == null || lon == null) return undefined;
//     return `${lat}, ${lon}`;
//   }

  function onContextMenu(e: React.MouseEvent) {
    if (loupe.on) e.preventDefault();
  }
  // function onMouseDown(e: React.MouseEvent) {
  //   if (!path && !data) return;
  //   setDrag({ x: e.clientX, y: e.clientY });
  // }
  function onMouseDown(e: React.MouseEvent) {
    if (!path && !data) return;
    // LMB pan như cũ
    if (e.button === 0) setDrag({ x: e.clientX, y: e.clientY });
    // RMB bắt đầu resize loupe
    if (e.button === 2 && loupe.on) {
      setRdrag({ startX: e.clientX, startSize: loupe.size });
    }
  }
  // function onMouseMove(e: React.MouseEvent) {
  //   const rect = wrapRef.current?.getBoundingClientRect();
  //   if (rect) {
  //     const uN = (e.clientX - rect.left) / rect.width;
  //     const vN = (e.clientY - rect.top)  / rect.height;
  //     lastNormRef.current = { u: uN, v: vN };
  //     setPointerNorm(id, uN, vN);
  //   }
  //   if (!drag) return;
  //   const dx = e.clientX - drag.x;
  //   const dy = e.clientY - drag.y;
  //   setDrag({ x: e.clientX, y: e.clientY });
  //   applyPan(id, dx, dy);
  // }
  function onMouseMove(e: React.MouseEvent) {
    // cập nhật pivot chuẩn hóa (u,v)
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top)  / rect.height;
      lastNormRef.current = { u: uN, v: vN };
      // LinkAll ON → broadcast vị trí tới tất cả panes; OFF → chỉ pane hiện tại
      if (t.linkAll) setPointerNormAll(uN, vN); else setPointerNorm(id, uN, vN);
    }

    // RMB drag để đổi size
    if (rdrag && loupe.on) {
      const dx = e.clientX - rdrag.startX;
      // nhạy vừa phải: mỗi 4px → +/− 10px
      const next = rdrag.startSize + Math.round(dx / 4) * 10;
      setLoupeSize(next);
    }

    // LMB pan như cũ
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ x: e.clientX, y: e.clientY });
    applyPan(id, dx, dy);
  }

  function onMouseUp() { setDrag(null); setRdrag(null); }
  function onMouseLeave() { setDrag(null); setRdrag(null); }

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
      
      if (t.linkAll) setPointerNormAll(uN, vN); else setPointerNorm(id, uN, vN);
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
      if (t.linkAll) setPointerNormAll(u, v); else setPointerNorm(id, u, v);
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
      onContextMenu={onContextMenu}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
    >
      {/* [step19] TOP BAR + DELETE */}
      {/* === HEADER + DETAILS: liền mạch === */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-start justify-center mt-1">
          <div className="pointer-events-auto w-[300px] sm:w-[320px]">
            {/* Header */}
            <div
              className={
                "px-3 py-2 bg-neutral-900/90 border border-neutral-700/70 shadow-sm " +
                (showDetails
                  ? "rounded-t-xl rounded-b-none border-b-0"
                  : "rounded-xl")
              }
            >
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 opacity-70 mt-[2px]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-neutral-100 truncate" title={displayName}>
                    {displayName}
                  </div>
                  <div className="text-[12px] text-neutral-300 truncate">
                    {device} • {sizeLabel} 
                  </div>
                </div>
                <button
                  onClick={() => toggleDetails(id)}
                  className="ml-1 p-1 rounded hover:bg-neutral-800 text-neutral-800"
                  title={showDetails ? "Ẩn thông tin" : "Hiện thông tin"}
                >
                  {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Details – gắn liền khung, không khe hở */}
            {showDetails && (t.files[id] || t.dataURL[id]) && (
              <div
                className="bg-neutral-900/90 border border-neutral-700/70 border-t-0
                          rounded-b-xl shadow-sm p-3"
              >
                {/* subtitle */}

                {/* rows */}
                <div className="flex flex-col divide-y divide-neutral-800/80">
                  <Row icon={<HardDrive className="w-4 h-4" />} label="File size"  value={fmtFileSize(exif?.FileSize)} />
                  <Row icon={<Calendar  className="w-4 h-4" />} label="Date"       value={fmtDate(exif?.DateTimeOriginal || exif?.DateTime)} />
                  <Row icon={<MapPin    className="w-4 h-4" />} label="Location"   value={fmtGps(exif)} />
                  <Row icon={<Camera    className="w-4 h-4" />} label="Device"     value={device !== "—" ? device : undefined} />
                  <Row icon={<Timer     className="w-4 h-4" />} label="Shutter"    value={exif?.ExposureTime ? fmtShutter(exif.ExposureTime) : undefined} />
                  <Row icon={<SunMedium className="w-4 h-4" />} label="ISO"        value={fmtIso(exif)} />
                  <Row icon={<Aperture  className="w-4 h-4" />} label="Aperture"   value={exif?.FNumber ? `f/${exif.FNumber}` : undefined} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nút X nhỏ, tròn – đã làm ở lần trước, giữ nguyên */}
        {(t.files[id] || t.dataURL[id]) && (
          <div className="absolute top-1.5 right-1.5 pointer-events-auto">
            <button
              onClick={() => { console.log(`[pane:${id}] delete via X`); clearPane(id); }}
              className="w-6 h-6 rounded-full bg-neutral-900/90 border border-neutral-700/70
                        flex items-center justify-center
                        hover:bg-red-600/90 hover:border-red-500
                        text-neutral-800 hover:text-white transition-colors"
              title="Remove image"
            >x
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="h-full min-h-[180px]">
      {path || data ? (
        <canvas ref={canvasRef} className="w-full h-full block bg-black" />
      ) : (
        <div className="h-full flex items-center justify-center text-neutral-500 select-none">Empty • {id}</div>
      )}
      </div>
    </div>
  );
}
