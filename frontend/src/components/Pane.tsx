/* eslint-disable @typescript-eslint/no-explicit-any */
import { useApp } from "../app/store";
import { useAnnotCanvas } from "../app/useAnnotCanvas";
import { basename } from "../app/path";
import { useImageCanvas } from "../app/useImageCanvas";
import { useRef, useState, useEffect } from "react";
import {
  readExifFromPath,
  readExifFromDataURL,
  reverseGeocode,
  type ReverseGeocodeResult,
} from "../app/bridge";
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
  Focus,
  Ruler,
} from "lucide-react";
import { imgPxToStrokeUV, clamp } from "../app/annotCoords";
import TextLayer from "./TextLayer";
import { cursorSet, cursorClear } from "../app/cursorManager";
import { formatDeviceName, formatFocalLengths } from "../app/exifFormat";

type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  const panes = useApp((s) => s.getActiveSafe().panes);
  const focusIndex = useApp((s) => s.getActiveSafe().focusIndex);

  const path = useApp((s) => s.getActiveSafe().files[id]);
  const data = useApp((s) => s.getActiveSafe().dataURL[id]);

  const view = useApp((s) => s.getActiveSafe().view[id]);
  const grid = useApp((s) => s.getActiveSafe().grid);
  const loupe = useApp((s) => s.getActiveSafe().loupe);
  const pointer = useApp((s) => s.getActiveSafe().pointerNorm[id]);
  const linkAll = useApp((s) => s.getActiveSafe().linkAll);

  const toolMode = useApp((s) => s.getActiveSafe().annotate.mode);
  const brushSize = useApp((s) => s.getActiveSafe().annotate.size);
  const eraserSize = useApp((s) => s.getActiveSafe().annotate.eraserSize);

  const exporting = useApp((s) => s.exporting);
  const clearPane = useApp((s) => s.clearPane);

  const startStroke = useApp((s) => s.startStroke);
  const appendStrokePoint = useApp((s) => s.appendStrokePoint);
  const setStrokeLineEnd = useApp((s) => s.setStrokeLineEnd);
  const setEraserSize = useApp((s) => s.setEraserSize);
  const setBrushSize = useApp((s) => s.setBrushSize);

  const setHoveredPane = useApp((s) => s.setHoveredPane);
  const uiActive = useApp((s) => s.hoveredPane === id);

  const drawRef = useRef<null | {
    panes: ("A" | "B" | "C" | "D")[];
    strokeId: string;
    last?: { u: number; v: number };
    raf: number | null;
    pending?: { u: number; v: number };
    lineMode?: boolean;
  }>(null);

  const idx = panes.indexOf(id);
  const focused = idx === focusIndex;

  const setMeta = useApp((s) => s.setImageMeta);
  const setSize = useApp((s) => s.setPaneSize);
  const applyPan = useApp((s) => s.applyPan);
  const applyZoom = useApp((s) => s.applyZoom);
  const resetView = useApp((s) => s.resetView);
  const setView = useApp((s) => s.setView);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);

  const hasImage = !!(path || data);

  const loupeForCanvas = !hasImage
    ? { ...loupe, on: false }
    : loupe.on && !linkAll && !hovered
    ? { ...loupe, on: false }
    : loupe;

  const spaceDownRef = useRef(false);
  const shiftDownRef = useRef(false);

  // lưu vị trí con trỏ đã biết (chuẩn hoá) để dblclick dùng đúng chỗ đó
  const lastNormRef = useRef<{ u: number; v: number }>({ u: 0.5, v: 0.5 });

  const canvasRef = useImageCanvas({
    path,
    dataURL: data,
    view,
    grid,
    loupe: loupeForCanvas,
    pointer,
    exporting,
    uiActive,
    onImageMeta: (w, h) => setMeta(id, w, h),
    onViewCompensate: (v) => setView(id, v),
  });

  const annotCanvasRef = useAnnotCanvas({
    paneId: id,
    view,
    loupe: loupeForCanvas,
    pointer,
    exporting,
    uiActive,
  });

  const exif = useApp((s) => s.getActiveSafe().exif?.[id]);

  const showDetails = useApp((s) => s.getActiveSafe().showDetails[id]);
  const name = useApp((s) => s.getActiveSafe().names[id]);
  const detailsOpen = showDetails && hasImage;
  const setExif = useApp((s) => s.setExif);
  const toggleDetails = useApp((s) => s.toggleDetails);

  const setPointerNorm = useApp((s) => s.setPointerNorm);
  const setPointerNormAll = useApp((s) => s.setPointerNormAll);
  const setLoupeSize = useApp((s) => s.setLoupeSize);

  const [rdrag, setRdrag] = useState<null | {
    startX: number;
    startSize: number;
    kind: "loupe" | "eraser" | "brush";
  }>(null);
  // RMB resize: dùng pointer lock để cursor không “bay” khỏi pane

  const displayName =
    name ?? (path ? basename(path) : data ? "(dropped image)" : "(Empty)");

  const device = formatDeviceName(exif);

  const sizeLabel = view.imgW && view.imgH ? `${view.imgW}×${view.imgH}` : "—";

  const fileSizeBytes =
    exif?.FileSize ?? (data ? dataURLByteLength(data) : undefined);
  const fileSizeLabel =
    fileSizeBytes != null ? fmtFileSize(fileSizeBytes) : undefined;
  const fileDetails = [
    fileSizeLabel,
    sizeLabel !== "—" ? `${sizeLabel} px` : undefined,
  ]
    .filter(Boolean)
    .join(" • ");
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

  const { focalLength, focalLength35mm } = formatFocalLengths(exif);
  const gpsCoordinates = fmtGps(exif);
  const [resolvedLocation, setResolvedLocation] =
    useState<ReverseGeocodeResult | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedLocation(null);

    if (!gpsCoordinates || !detailsOpen) {
      setLocationLoading(false);
      return;
    }

    const [latitude, longitude] = gpsCoordinates
      .split(",")
      .map((value) => Number(value.trim()));
    if (!isFinite(latitude) || !isFinite(longitude)) {
      setLocationLoading(false);
      return;
    }

    setLocationLoading(true);
    reverseGeocode(latitude, longitude).then((result) => {
      if (cancelled) return;
      setResolvedLocation(result);
      setLocationLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [gpsCoordinates, detailsOpen]);

  useEffect(() => {
    if (!rdrag) return;

    cursorSet("rdrag", "ew-resize", 100);

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - rdrag.startX;
      const step = rdrag.kind === "brush" ? 1 : 10;
      const next = rdrag.startSize + Math.round(dx / 4) * step;

      if (rdrag.kind === "brush") setBrushSize(next);
      else if (rdrag.kind === "eraser") setEraserSize(next);
      else setLoupeSize(next);
    };

    const stop = () => {
      cursorClear("rdrag");
      setRdrag(null);
    };

    const onUp = () => stop();
    const onCtx = (ev: MouseEvent) => ev.preventDefault();

    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("contextmenu", onCtx, true);

    return () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("contextmenu", onCtx, true);
      cursorClear("rdrag");
    };
  }, [rdrag, setBrushSize, setEraserSize, setLoupeSize]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!path && !data) return;
      if (exif) return;

      const res = path
        ? await readExifFromPath(path)
        : data
        ? await readExifFromDataURL(data)
        : undefined;

      if (!cancelled) setExif(id, res);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, path, data, exif, setExif]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let raf = 0;
    let lastCw = 0;
    let lastCh = 0;

    const measureAndSend = () => {
      const r = el.getBoundingClientRect();
      const cw = Math.max(1, Math.floor(r.width));
      const ch = Math.max(1, Math.floor(r.height));
      if (cw === lastCw && ch === lastCh) return;
      lastCw = cw;
      lastCh = ch;
      setSize(id, cw, ch);
    };

    measureAndSend();

    const ro = new ResizeObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measureAndSend();
      });
    });

    ro.observe(el);

    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [id, setSize]);

  useEffect(() => {
    if (exif) {
      console.log("[Pane][EXIF]", id, exif);
    }
  }, [id, exif]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Shift: dùng để vẽ nét thẳng khi đang vẽ
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        if (isEditableTarget(e)) return;
        shiftDownRef.current = true;
        return;
      }

      if (e.code !== "Space") return;
      if (isEditableTarget(e)) return;

      // preventDefault (chặn mặc định) để không bị scroll/nhảy focus khi giữ Space
      e.preventDefault();
      spaceDownRef.current = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        shiftDownRef.current = false;
        return;
      }
      if (e.code !== "Space") return;
      spaceDownRef.current = false;
    };

    // capture (bắt ở pha capture) để ăn Space sớm, tránh webview/DOM xử lý trước
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
    };
  }, []);

  function Row({
    icon,
    label,
    value,
    title,
    wrap = false,
  }: {
    icon: React.ReactNode;
    label: string;
    value?: string;
    title?: string;
    wrap?: boolean;
  }) {
    return (
      <div
        className={`flex gap-1.5 py-1 ${
          wrap ? "items-start" : "items-center"
        }`}
      >
        <div className={`text-neutral-300 ${wrap ? "mt-0.5" : ""}`}>
          {icon}
        </div>
        <div className="text-neutral-400 w-20 shrink-0 text-[11px] font-medium">
          {label}
        </div>
        <div
          className={`text-neutral-100 min-w-0 flex-1 ${
            wrap ? "whitespace-normal break-words leading-4" : "truncate"
          }`}
          title={title ?? value}
        >
          {value ?? "—"}
        </div>
      </div>
    );
  }

  function dataURLByteLength(u?: string) {
    if (!u) return undefined;
    const i = u.indexOf(",");
    const b64 = i >= 0 ? u.slice(i + 1) : u;
    const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
    return Math.max(0, (b64.length * 3) / 4 - pad) | 0;
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

  function onWheel(e: React.WheelEvent) {
    if (!path && !data) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top) / rect.height;
      lastNormRef.current = { u: uN, v: vN };

      if (linkAll) setPointerNormAll(uN, vN);
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
      if (linkAll) setPointerNormAll(u, v);
      else setPointerNorm(id, u, v);
    } else {
      resetView(id);
    }
  }

  function mouseToImageUV(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (!view.imgW || !view.imgH) return null;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cwCss = rect.width,
      chCss = rect.height;

    const iw = view.imgW,
      ih = view.imgH;

    const fit = Math.min(cwCss / iw, chCss / ih);
    const total = fit * view.scale;

    const w = iw * total,
      h = ih * total;
    const x0 = (cwCss - w) / 2 + view.offsetX;
    const y0 = (chCss - h) / 2 + view.offsetY;

    // (xImg, yImg) theo pixel ảnh
    const xImg = clamp((mx - x0) / total, 0, iw);
    const yImg = clamp((my - y0) / total, 0, ih);

    // LƯU stroke theo square space isotropic
    return imgPxToStrokeUV(iw, ih, xImg, yImg);
  }

  function onContextMenu(e: React.MouseEvent) {
    if (loupe.on || toolMode === "none") e.preventDefault();
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!path && !data) return;

    // LMB
    if (e.button === 0 && toolMode !== "none") {
      if (spaceDownRef.current) {
        setDrag({ x: e.clientX, y: e.clientY });
        return;
      }

      const p0 = mouseToImageUV(e);
      if (!p0) return;

      const targets = linkAll ? panes : [id];
      const strokeId = startStroke(
        targets as any,
        toolMode === "erase" ? "erase" : "draw",
        p0
      );

      drawRef.current = {
        panes: targets as any,
        strokeId,
        last: p0,
        raf: null,
      };
      return;
    }

    // LMB pan như cũ
    if (e.button === 0) setDrag({ x: e.clientX, y: e.clientY });

    // RMB: giữ nguyên logic resize hiện tại
    if (e.button === 2) {
      if (toolMode === "erase") {
        setRdrag({
          startX: e.clientX,
          startSize: eraserSize,
          kind: "eraser",
        });
        return;
      }
      if (toolMode === "draw") {
        setRdrag({
          startX: e.clientX,
          startSize: brushSize,
          kind: "brush",
        });
        return;
      }
      if (loupe.on) {
        setRdrag({ startX: e.clientX, startSize: loupe.size, kind: "loupe" });
        return;
      }
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const uN = (e.clientX - rect.left) / rect.width;
      const vN = (e.clientY - rect.top) / rect.height;
      lastNormRef.current = { u: uN, v: vN };
      if (linkAll) setPointerNormAll(uN, vN);
      else setPointerNorm(id, uN, vN);
    }

    // nếu đang vẽ → append point (throttle rAF)
    if (drawRef.current) {
      const p = mouseToImageUV(e);
      if (p) {
        drawRef.current.pending = p;
        if (drawRef.current.raf == null) {
          drawRef.current.raf = requestAnimationFrame(() => {
            const cur = drawRef.current;
            if (!cur?.pending) return;
            const next = cur.pending;
            cur.pending = undefined;
            cur.raf = null;

            // SHIFT: nếu đang giữ Shift (hoặc đã vào lineMode) thì ép stroke thành 1 đoạn thẳng (2 điểm)
            const cur2 = drawRef.current;
            const line = !!cur2 && (cur2.lineMode || shiftDownRef.current);
            if (cur2 && line) {
              cur2.lineMode = true;
              setStrokeLineEnd(cur2.panes as any, cur2.strokeId, next);
              cur2.last = next;
              return;
            }

            // bỏ điểm quá dày để giảm nặng
            const last = cur.last;
            if (
              !last ||
              Math.hypot(next.u - last.u, next.v - last.v) > 0.0015
            ) {
              appendStrokePoint(cur.panes as any, cur.strokeId, next);
              cur.last = next;
            }
          });
        }
      }
      return;
    }

    // RMB resize đã xử lý bằng document mousemove + pointer lock
    if (rdrag) return;

    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    setDrag({ x: e.clientX, y: e.clientY });
    applyPan(id, dx, dy);
  }

  function onMouseUp() {
    if (drawRef.current?.raf) cancelAnimationFrame(drawRef.current.raf);
    drawRef.current = null;
    setDrag(null);
    setRdrag(null);
  }

  function onMouseLeave() {
    setHovered(false);

    if (drawRef.current?.raf) cancelAnimationFrame(drawRef.current.raf);
    drawRef.current = null;
    setDrag(null);
    setRdrag(null);

    if (useApp.getState().hoveredPane === id) setHoveredPane(null);
  }

  function isEditableTarget(ev: KeyboardEvent) {
    const el = ev.target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      (el as any).isContentEditable ||
      el.getAttribute?.("role") === "textbox"
    );
  }

  return (
    <div
      ref={wrapRef}
      data-role="pane-wrap"
      data-pane={id}
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
      onMouseEnter={() => {
        setHovered(true);
        setHoveredPane(id);
      }}
    >
      <div className="absolute top-1 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-start justify-center mt-1">
          <div className="pointer-events-auto w-[240px] sm:w-[260px]">
            <div
              className={
                "px-2.5 py-1.5 bg-black border border-neutral-700/70 shadow-sm " +
                (detailsOpen
                  ? "rounded-t-xl rounded-b-none border-b-0"
                  : "rounded-xl")
              }
            >
              <div className="flex items-start gap-2">
                <Camera className="w-3.5 h-3.5 opacity-70 mt-[2px] text-neutral-100" />
                <div className="min-w-0 flex-1">
                  <div
                    className="text-[12px] font-semibold text-neutral-100 truncate"
                    title={displayName}
                  >
                    {displayName}
                  </div>
                  <div className="text-[11px] text-neutral-300 truncate">
                    {device}
                  </div>
                </div>
                <div
                  onClick={() => toggleDetails(id)}
                  className="ml-1 w-5 h-5 rounded-full flex items-center justify-center
                            bg-transparent text-white cursor-pointer
                            hover:bg-white/10 active:bg-white/20 active:scale-95 transition"
                  title={detailsOpen ? "Ẩn thông tin" : "Hiện thông tin"}
                >
                  {detailsOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </div>
            </div>

            {hasImage && (
              <div
                className={[
                  "overflow-hidden",
                  "transition-[max-height,opacity,transform] duration-200 ease-out",
                  detailsOpen
                    ? "max-h-[320px] opacity-100 translate-y-0"
                    : "max-h-0 opacity-0 -translate-y-1 pointer-events-none",
                ].join(" ")}
              >
                <div
                  className="bg-black border border-neutral-700/70 border-t-0
                          rounded-b-xl shadow-sm p-2"
                >
                  <div className="flex flex-col divide-y divide-neutral-800/80 text-[11px]">
                    <Row
                      icon={<HardDrive className="w-3.5 h-3.5" />}
                      label="File size"
                      value={fileDetails || "—"}
                    />

                    <Row
                      icon={<Calendar className="w-3.5 h-3.5" />}
                      label="Date"
                      value={dateRaw ? fmtDate(dateRaw) : "—"}
                    />

                    <Row
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      label="Location"
                      wrap
                      value={
                        resolvedLocation
                          ? `© OSM · ${resolvedLocation.name}`
                          : locationLoading
                          ? "Looking up…"
                          : gpsCoordinates || "—"
                      }
                      title={
                        resolvedLocation
                          ? [
                              resolvedLocation.name,
                              gpsCoordinates,
                              resolvedLocation.attribution,
                            ]
                              .filter(Boolean)
                              .join("\n")
                          : gpsCoordinates
                      }
                    />

                    <Row
                      icon={<Camera className="w-3.5 h-3.5" />}
                      label="Device"
                      value={device !== "—" ? device : "—"}
                    />

                    <Row
                      icon={<Timer className="w-3.5 h-3.5" />}
                      label="Shutter"
                      value={shutterRaw ? fmtShutter(shutterRaw) : "—"}
                    />

                    <Row
                      icon={<SunMedium className="w-3.5 h-3.5" />}
                      label="ISO"
                      value={fmtIso(exif) || "—"}
                    />

                    <Row
                      icon={<Aperture className="w-3.5 h-3.5" />}
                      label="Aperture"
                      value={
                        apertureRaw
                          ? `f/${(+apertureRaw).toFixed(1).replace(/\.0$/, "")}`
                          : "—"
                      }
                    />

                    <Row
                      icon={<Focus className="w-3.5 h-3.5" />}
                      label="Focal"
                      value={focalLength || "—"}
                    />

                    <Row
                      icon={<Ruler className="w-3.5 h-3.5" />}
                      label="Full-frame"
                      value={focalLength35mm || "—"}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {(path || data) && (
          <div className="absolute top-1.5 right-1.5 pointer-events-auto">
            <div
              onClick={() => {
                console.log(`[pane:${id}] delete via CircleX`);
                clearPane(id);
              }}
              className="w-5 h-5 rounded-full flex items-center justify-center
           bg-neutral-800/90 text-neutral-300
           border border-neutral-700/60 shadow-sm
           hover:bg-neutral-700 hover:text-white
           active:scale-95 cursor-pointer transition
           backdrop-blur-sm"
              title="Remove image"
            >
              <CircleX className="w-5 h-5" strokeWidth={2.2} />
            </div>
          </div>
        )}
      </div>

      <div className="h-full min-h-[180px]">
        {path || data ? (
          <div className="relative w-full h-full bg-black">
            {/* canvas ảnh */}
            <canvas
              ref={canvasRef}
              data-role="pane-image"
              className="absolute inset-0 w-full h-full"
            />

            {/* canvas annotation vẽ đè */}
            <canvas
              ref={annotCanvasRef}
              data-role="pane-annot"
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
            {/* Text layer: DOM overlay (select/edit/resize). Text thực tế sẽ được vẽ lên canvas annot để export. */}
            <TextLayer paneId={id} view={view} />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-500 select-none">
            Empty • {id}
          </div>
        )}
      </div>
    </div>
  );
}
