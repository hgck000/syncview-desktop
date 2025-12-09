/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApp } from "../app/store";
import { basename } from "../app/path";
import { useImageCanvas } from "../app/useImageCanvas";
import { useRef, useState, useEffect } from "react";
import { readExifFromPath, readExifFromDataURL } from "../app/bridge";
import {
  ChevronDown,
  ChevronUp,
  Camera,
  Calendar,
  MapPin,
  HardDrive,
  Aperture,
  Timer,
  SunMedium,
  CircleX,
} from "lucide-react";

type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  const t = useApp((s) => s.getActive())!;

  const idx = t.panes.indexOf(id);
  const focused = idx === t.focusIndex;

  const path = t.files[id];
  const data = t.dataURL[id];
  // const label = t.names[id] ?? basename(path) ?? `${id}: Empty`;
  const view = t.view[id];

  const setMeta = useApp((s) => s.setImageMeta);
  const setSize = useApp((s) => s.setPaneSize); // <— NEW
  const applyPan = useApp((s) => s.applyPan);
  const applyZoom = useApp((s) => s.applyZoom);
  const resetView = useApp((s) => s.resetView);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  // lưu vị trí con trỏ đã biết (chuẩn hoá) để dblclick dùng đúng chỗ đó
  const lastNormRef = useRef<{ u: number; v: number }>({ u: 0.5, v: 0.5 });

  const grid = t.grid;
  const loupe = t.loupe;

  const pointer = t.pointerNorm[id];
  const canvasRef = useImageCanvas({
    path,
    dataURL: data,
    view,
    grid,
    loupe,
    pointer,
    onImageMeta: (w, h) => setMeta(id, w, h),
  });
  const exif = t.exif[id];
  // const shutter = extractShutter(exif);
  // const aperture = extractAperture(exif);
  // const iso = extractISO(exif);
  // const location = extractLocation(exif);

  const showDetails = t.showDetails[id];
  const setExif = useApp((s) => s.setExif);
  const toggleDetails = useApp((s) => s.toggleDetails);

  const setPointerNorm = useApp((s) => s.setPointerNorm);
  const setPointerNormAll = useApp((s) => s.setPointerNormAll);
  const setLoupeSize = useApp((s) => s.setLoupeSize);

  const [rdrag, setRdrag] = useState<{
    startX: number;
    startSize: number;
  } | null>(null);

  const clearPane = useApp((s) => s.clearPane);
  const displayName =
    t.names[id] ??
    (t.files[id]
      ? basename(t.files[id]!)
      : t.dataURL[id]
      ? "(dropped image)"
      : "(Empty)");

  const device =
    exif?.Make && exif?.Model
      ? `${exif.Make} ${exif.Model}`
      : exif?.Model || exif?.Make || "—";

  const sizeLabel = view.imgW && view.imgH ? `${view.imgW}×${view.imgH}` : "—";

  function dataURLByteLength(u?: string) {
    if (!u) return undefined;
    const i = u.indexOf(",");
    const b64 = i >= 0 ? u.slice(i + 1) : u;
    const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return Math.max(0, (b64.length * 3) / 4 - pad) | 0;
  }
  const fileSizeBytes =
    exif?.FileSize ?? (data ? dataURLByteLength(data) : undefined);
  const dateRaw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.DateTime;

  const shutterRaw = (() => {
    const et =
      exif?.ExposureTime ??
      exif?.Exif?.ExposureTime ??
      exif?.Photo?.ExposureTime ??
      exif?.tags?.ExposureTime ??
      exif?.ShutterSpeed ??
      exif?.Exif?.ShutterSpeed ??
      exif?.Photo?.ShutterSpeed ??
      exif?.tags?.ShutterSpeed;

    if (typeof et === "number" && isFinite(et)) return et;

    if (typeof et === "string") {
      const s = et
        .trim()
        .toLowerCase()
        .replace(/\s*(sec|s)\s*$/, "");
      const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
      if (frac) {
        const a = parseFloat(frac[1]);
        const b = parseFloat(frac[2]);
        if (b) return a / b;
      }
      const n = parseFloat(s);
      if (isFinite(n)) return n;
    }

    const sv =
      exif?.ShutterSpeedValue ??
      exif?.Exif?.ShutterSpeedValue ??
      exif?.Photo?.ShutterSpeedValue ??
      exif?.tags?.ShutterSpeedValue;

    if (typeof sv === "number" && isFinite(sv)) return Math.pow(2, -sv);
    return undefined;
  })();

  // ---------- APERTURE: chuẩn hoá sang f-number ----------
  const apertureRaw = (() => {
    const fn =
      exif?.FNumber ??
      exif?.Exif?.FNumber ??
      exif?.Photo?.FNumber ??
      exif?.SubIFD?.FNumber ??
      exif?.tags?.FNumber ??
      exif?.Aperture ??
      exif?.Exif?.Aperture ??
      exif?.Photo?.Aperture ??
      exif?.tags?.Aperture;

    if (typeof fn === "number" && isFinite(fn)) return fn;

    if (typeof fn === "string") {
      const m = fn.match(/(\d+(?:\.\d+)?)/i);
      if (m) {
        const n = parseFloat(m[1]);
        if (isFinite(n)) return n;
      }
    }

    const av =
      exif?.ApertureValue ??
      exif?.Exif?.ApertureValue ??
      exif?.Photo?.ApertureValue ??
      exif?.tags?.ApertureValue;

    if (typeof av === "number" && isFinite(av)) return Math.pow(2, av / 2);
    return undefined;
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!path && !data) return;
        // tránh nạp lại nếu exif đã có & nguồn không đổi
        if (t.exif?.[id] && (t.files[id] === path || t.dataURL[id] === data))
          return;

        console.log(`[pane:${id}] read exif...`, path ? "path" : "dataURL");
        const meta = path
          ? await readExifFromPath(path)
          : await readExifFromDataURL(data!);
        if (!cancelled && meta) setExif(id, meta);
      } catch (e) {
        console.warn(`[pane:${id}] exif error`, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, path, data, setExif, t.exif, t.files, t.dataURL]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const send = () => {
      const r = el.getBoundingClientRect();
      setSize(
        id,
        Math.max(1, Math.floor(r.width)),
        Math.max(1, Math.floor(r.height))
      );

      // setSize(id, Math.max(1, Math.floor(r.width)), Math.max(1, Math.floor(r.height)));
    };
    send();
    const ro = new ResizeObserver(send);
    ro.observe(el);
    return () => ro.disconnect();
  }, [id, setSize]);

  useEffect(() => {
    if (exif) {
      console.log("[Pane][EXIF]", id, exif);
    }
  }, [id, exif]);

  function Row({
    icon,
    label,
    value,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
  }) {
    return (
      <div className="flex items-center gap-2 py-1.5">
        <div className="text-neutral-300">{icon}</div>
        <div className="text-neutral-400 w-20 shrink-0 text-[12px] font-semibold">
          {label}
        </div>
        <div className="text-neutral-100 truncate" title={value}>
          {value ?? "—"}
        </div>
      </div>
    );
  }

  function fmtFileSize(bytes?: number | string) {
    const b = Number(bytes);
    if (!isFinite(b) || b <= 0) return undefined;
    const units = ["B", "KB", "MB", "GB", "TB"];
    let i = 0,
      n = b;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
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
    if (v == null || !isFinite(v) || v <= 0) return "—";
    return v < 1
      ? `1/${Math.round(1 / v)}`
      : `${v < 10 ? v.toFixed(2).replace(/\.?0+$/, "") : Math.round(v)}s`;
  }

  function fmtIso(exif: any) {
    const v =
      exif?.ISO ??
      exif?.ISOSpeedRatings ??
      exif?.PhotographicSensitivity ??
      exif?.Exif?.ISO ??
      exif?.Photo?.ISO ??
      exif?.SubIFD?.ISO ??
      exif?.tags?.ISO ??
      exif?.ExifIFD?.ISO ??
      exif?.Image?.ISO;

    if (v == null) return undefined;

    if (Array.isArray(v)) {
      const n = Number(v[0]);
      return isFinite(n) ? String(n) : undefined;
    }

    const n = Number(v);
    if (isFinite(n)) return String(n);

    if (typeof v === "string") {
      const m = v.match(/(\d+)/);
      return m ? m[1] : undefined;
    }

    return undefined;
  }

  function fmtGps(exif: any) {
    const lat =
      exif?.GPSLatitude ??
      exif?.GPS?.GPSLatitude ??
      exif?.gps?.GPSLatitude ??
      exif?.latitude ??
      exif?.GPS?.latitude;

    const lon =
      exif?.GPSLongitude ??
      exif?.GPS?.GPSLongitude ??
      exif?.gps?.GPSLongitude ??
      exif?.longitude ??
      exif?.GPS?.longitude;

    // Một số lib gộp sẵn thành chuỗi "lat, lon"
    const pos =
      exif?.GPSPosition ?? exif?.GPS?.GPSPosition ?? exif?.gps?.GPSPosition;
    if ((lat == null || lon == null) && typeof pos === "string") {
      const m = pos.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) {
        const la = parseFloat(m[1]),
          lo = parseFloat(m[2]);
        if (isFinite(la) && isFinite(lo))
          return `${la.toFixed(6)}, ${lo.toFixed(6)}`;
      }
    }

    const latRef =
      exif?.GPSLatitudeRef ??
      exif?.GPS?.GPSLatitudeRef ??
      exif?.gps?.GPSLatitudeRef;
    const lonRef =
      exif?.GPSLongitudeRef ??
      exif?.GPS?.GPSLongitudeRef ??
      exif?.gps?.GPSLongitudeRef;

    const toNum = (val: any): number | undefined => {
      if (typeof val === "number" && isFinite(val)) return val;

      if (Array.isArray(val) && val.length >= 1) {
        const d = Number(val[0]) || 0;
        const m = Number(val[1]) || 0;
        const s = Number(val[2]) || 0;
        return d + m / 60 + s / 3600;
      }

      if (typeof val === "string") {
        const s = val.trim();

        // DMS chuỗi có ký hiệu độ/phút/giây: 20° 30' 10.2" N (N/S/E/W có thể kèm hoặc tách)
        const dms1 = s.match(
          /^(\d+(?:\.\d+)?)\s*[°deg]?\s*(\d+(?:\.\d+)?)?'\s*(\d+(?:\.\d+)?)?"?\s*([NSEW])?$/i
        );
        if (dms1) {
          let res =
            parseFloat(dms1[1]) +
            (parseFloat(dms1[2]) || 0) / 60 +
            (parseFloat(dms1[3]) || 0) / 3600;
          const ref = dms1[4]?.toUpperCase();
          if (ref === "S" || ref === "W") res = -Math.abs(res);
          return res;
        }

        // fraction "a/b"
        const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (frac) {
          const a = parseFloat(frac[1]);
          const b = parseFloat(frac[2]);
          if (b) return a / b;
        }

        const n = parseFloat(s);
        if (isFinite(n)) return n;
      }

      return undefined;
    };

    let latNum = toNum(lat);
    let lonNum = toNum(lon);
    if (latNum == null || lonNum == null) return undefined;

    if (typeof latRef === "string" && latRef.toUpperCase() === "S")
      latNum = -Math.abs(latNum);
    if (typeof lonRef === "string" && lonRef.toUpperCase() === "W")
      lonNum = -Math.abs(lonNum);

    const f = (x: number) => x.toFixed(6);
    return `${f(latNum)}, ${f(lonNum)}`;
  }

  function onContextMenu(e: React.MouseEvent) {
    if (loupe.on) e.preventDefault();
  }
  function onMouseDown(e: React.MouseEvent) {
    if (!path && !data) return;
    // LMB pan như cũ
    if (e.button === 0) setDrag({ x: e.clientX, y: e.clientY });
    // RMB bắt đầu resize loupe
    if (e.button === 2 && loupe.on) {
      setRdrag({ startX: e.clientX, startSize: loupe.size });
    }
  }
  function onMouseMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top) / rect.height;
      lastNormRef.current = { u: uN, v: vN };
      if (t.linkAll) setPointerNormAll(uN, vN);
      else setPointerNorm(id, uN, vN);
    }

    if (rdrag && loupe.on) {
      const dx = e.clientX - rdrag.startX;
      const next = rdrag.startSize + Math.round(dx / 4) * 10;
      setLoupeSize(next);
    }

    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ x: e.clientX, y: e.clientY });
    applyPan(id, dx, dy);
  }

  function onMouseUp() {
    setDrag(null);
    setRdrag(null);
  }
  function onMouseLeave() {
    setDrag(null);
    setRdrag(null);
  }

  function onWheel(e: React.WheelEvent) {
    if (!path && !data) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top) / rect.height;
      lastNormRef.current = { u: uN, v: vN };

      if (t.linkAll) setPointerNormAll(uN, vN);
      else setPointerNorm(id, uN, vN);
      applyZoom(id, factor, { type: "norm", u: uN, v: vN });
    } else {
      applyZoom(id, factor, { type: "norm", u: 0.5, v: 0.5 });
    }
  }

  function onDoubleClick() {
    if (!wrapRef.current || (!path && !data)) return;
    const { u, v } = lastNormRef.current;
    if (Math.abs(view.scale - 1) < 0.01) {
      applyZoom(id, 3, { type: "norm", u, v });
      if (t.linkAll) setPointerNormAll(u, v);
      else setPointerNorm(id, u, v);
    } else {
      resetView(id);
    }
  }

  return (
    <div
      ref={wrapRef}
      className={`relative min-h-0 bg-neutral-900 border rounded overflow-hidden ${
        focused ? "border-neutral-400" : "border-neutral-800"
      }`}
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
      <div className="absolute top-1 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-start justify-center mt-1">
          <div className="pointer-events-auto w-[300px] sm:w-[320px]">
            {/* Header */}
            <div
              className={
                "px-3 py-2 bg-black border border-neutral-700/70 shadow-sm " +
                (showDetails
                  ? "rounded-t-xl rounded-b-none border-b-0"
                  : "rounded-xl")
              }
            >
              <div className="flex items-start gap-2">
                <Camera className="w-4 h-4 opacity-70 mt-[2px] text-neutral-100" />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[13px] font-semibold text-neutral-100 truncate"
                    title={displayName}
                  >
                    {displayName}
                  </div>
                  <div className="text-[12px] text-neutral-300 truncate">
                    {device} • {sizeLabel}
                  </div>
                </div>
                <div
                  onClick={() => toggleDetails(id)}
                  className="ml-1 w-6 h-6 rounded-full flex items-center justify-center
                            bg-transparent text-white cursor-pointer
                            hover:bg-white/10 active:bg-white/20 active:scale-95 transition"
                  title={showDetails ? "Ẩn thông tin" : "Hiện thông tin"}
                >
                  {showDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>
            </div>

            {/* Details – gắn liền khung, không khe hở */}
            {showDetails && (t.files[id] || t.dataURL[id]) && (
              <div
                className="bg-black border border-neutral-700/70 border-t-0
                          rounded-b-xl shadow-sm p-3"
              >
                {/* subtitle */}

                {/* rows */}
                <div className="flex flex-col divide-y divide-neutral-800/80 text-[12px]">
                  <Row
                    icon={<HardDrive className="w-4 h-4" />}
                    label="File size"
                    value={
                      fileSizeBytes != null ? fmtFileSize(fileSizeBytes) : "—"
                    }
                  />

                  <Row
                    icon={<Calendar className="w-4 h-4" />}
                    label="Date"
                    value={dateRaw ? fmtDate(dateRaw) : "—"}
                  />

                  <Row
                    icon={<MapPin className="w-4 h-4" />}
                    label="Location"
                    value={fmtGps(exif) || "—"}
                  />

                  <Row
                    icon={<Camera className="w-4 h-4" />}
                    label="Device"
                    value={device !== "—" ? device : "—"}
                  />

                  <Row
                    icon={<Timer className="w-4 h-4" />}
                    label="Shutter"
                    value={shutterRaw ? fmtShutter(shutterRaw) : "—"}
                  />

                  <Row
                    icon={<SunMedium className="w-4 h-4" />}
                    label="ISO"
                    value={fmtIso(exif) || "—"}
                  />

                  <Row
                    icon={<Aperture className="w-4 h-4" />}
                    label="Aperture"
                    value={
                      apertureRaw
                        ? `f/${(+apertureRaw).toFixed(1).replace(/\.0$/, "")}`
                        : "—"
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Nút X nhỏ, tròn – đã làm ở lần trước, giữ nguyên */}
        {(t.files[id] || t.dataURL[id]) && (
          <div className="absolute top-1.5 right-1.5 pointer-events-auto">
            <div
              onClick={() => {
                console.log(`[pane:${id}] delete via CircleX`);
                clearPane(id);
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center
                        bg-white text-neutral-800/80
                        hover:text-neutral-800
                        active:scale-95 cursor-pointer transition"
              title="Remove image"
            >
              <CircleX className="w-5 h-5" strokeWidth={2.2} />
            </div>
          </div>
        )}
      </div>

      <div className="h-full min-h-[180px]">
        {path || data ? (
          <canvas ref={canvasRef} className="w-full h-full block bg-black" />
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 select-none">
            Empty • {id}
          </div>
        )}
      </div>
    </div>
  );
}
