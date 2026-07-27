import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { readImageThumbnail } from "../app/bridge";
import { useApp, type PaneId } from "../app/store";

const thumbnailCache = new Map<string, string>();
const MAX_CACHE_ITEMS = 64;

function rememberThumbnail(key: string, value: string) {
  if (thumbnailCache.size >= MAX_CACHE_ITEMS) {
    const oldest = thumbnailCache.keys().next().value;
    if (oldest) thumbnailCache.delete(oldest);
  }
  thumbnailCache.set(key, value);
}

function makeDataUrlThumbnail(
  source: string,
  maxWidth = 192,
  maxHeight = 160,
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(
        1,
        maxWidth / Math.max(1, image.naturalWidth),
        maxHeight / Math.max(1, image.naturalHeight),
      );
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      ctx.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.68));
      canvas.width = 1;
      canvas.height = 1;
    };
    image.onerror = () => resolve(null);
    image.src = source;
  });
}

function usePaneThumbnail(pane: PaneId) {
  const path = useApp((s) => s.getActiveSafe().files[pane]);
  const dataURL = useApp((s) => s.getActiveSafe().dataURL[pane]);
  const key = useMemo(
    () =>
      path
        ? `path:${path}`
        : dataURL
          ? `data:${dataURL.length}:${dataURL.slice(0, 48)}:${dataURL.slice(-48)}`
          : "",
    [path, dataURL],
  );
  const [thumbnail, setThumbnail] = useState<string | null>(
    key ? (thumbnailCache.get(key) ?? null) : null,
  );

  useEffect(() => {
    let cancelled = false;
    if (!key) {
      setThumbnail(null);
      return;
    }

    const cached = thumbnailCache.get(key);
    if (cached) {
      setThumbnail(cached);
      return;
    }

    setThumbnail(null);
    const load = path
      ? readImageThumbnail(path)
      : dataURL
        ? makeDataUrlThumbnail(dataURL)
        : Promise.resolve(null);

    load.then((result) => {
      if (cancelled || !result) return;
      rememberThumbnail(key, result);
      setThumbnail(result);
    });

    return () => {
      cancelled = true;
    };
  }, [key, path, dataURL]);

  return thumbnail;
}

function ThumbnailSlot({
  pane,
  index,
  active,
  onSelect,
}: {
  pane: PaneId;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const thumbnail = usePaneThumbnail(pane);
  const tab = useApp((s) => s.getActiveSafe());
  const path = tab.files[pane];
  const name =
    tab.names[pane] ??
    path?.split(/[/\\]/).pop() ??
    `Image ${index + 1}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${index + 1}. ${name}`}
      className={[
        "group relative min-h-0 overflow-hidden rounded-md border",
        "bg-neutral-900 text-left cursor-pointer select-none",
        "transition-[border-color,box-shadow,background-color] duration-150",
        active
          ? "border-blue-400 ring-2 ring-blue-500/70 bg-blue-950/30"
          : "border-neutral-700/80 hover:border-neutral-500",
      ].join(" ")}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          draggable={false}
          className={[
            "h-full w-full object-contain bg-neutral-950",
            active
              ? "opacity-75 grayscale-[15%]"
              : "opacity-45 grayscale-[35%] group-hover:opacity-60",
          ].join(" ")}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-neutral-950/80 text-neutral-600">
          <ImageIcon className="h-5 w-5" />
        </div>
      )}

      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div
        className={[
          "absolute left-1 top-1 min-w-5 h-5 px-1 rounded",
          "flex items-center justify-center text-[10px] font-semibold",
          active
            ? "bg-blue-500 text-white"
            : "bg-black/70 text-neutral-300",
        ].join(" ")}
      >
        {index + 1}
      </div>
    </button>
  );
}

export default function ComparisonRail({
  title,
  panes,
  activePane,
  slotCount,
  onSelect,
  onClose,
}: {
  title: string;
  panes: PaneId[];
  activePane?: PaneId;
  slotCount: 3 | 4;
  onSelect: (pane: PaneId) => void;
  onClose: () => void;
}) {
  const slots = Array.from({ length: slotCount }, (_, index) => panes[index]);

  return (
    <aside className="w-28 shrink-0 border-l border-neutral-800 bg-neutral-900 p-1.5 flex flex-col gap-1.5">
      <div className="h-6 shrink-0 flex items-center gap-1 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
        <span className="truncate">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-white hover:bg-neutral-800 cursor-pointer"
          title={`Exit ${title.toLowerCase()}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        className="min-h-0 flex-1 grid gap-1.5"
        style={{
          gridTemplateRows: `repeat(${slotCount}, minmax(0, 1fr))`,
        }}
      >
        {slots.map((pane, index) =>
          pane ? (
            <ThumbnailSlot
              key={pane}
              pane={pane}
              index={index}
              active={pane === activePane}
              onSelect={() => onSelect(pane)}
            />
          ) : (
            <div
              key={`empty-${index}`}
              className="min-h-0 rounded-md border border-dashed border-neutral-800 bg-neutral-950/40"
            />
          ),
        )}
      </div>
    </aside>
  );
}
