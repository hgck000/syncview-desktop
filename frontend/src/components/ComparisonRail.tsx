import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
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
  showShortcut,
  onSelect,
}: {
  pane: PaneId;
  index: number;
  active: boolean;
  showShortcut: boolean;
  onSelect: () => void;
}) {
  const thumbnail = usePaneThumbnail(pane);
  const path = useApp((s) => s.getActiveSafe().files[pane]);
  const customName = useApp((s) => s.getActiveSafe().names[pane]);
  const name =
    customName ??
    path?.split(/[/\\]/).pop() ??
    `Image ${index + 1}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${index + 1}. ${name}`}
      className={[
        "group relative min-h-0 overflow-hidden rounded-lg border text-left",
        "bg-neutral-900/70 cursor-pointer select-none",
        "transition-[border-color,box-shadow,opacity] duration-150",
        active
          ? "border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.25)]"
          : "border-neutral-800 hover:border-neutral-600",
      ].join(" ")}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          draggable={false}
          className={[
            "h-full w-full object-cover bg-neutral-950 transition-[opacity,filter,transform] duration-150",
            active
              ? "opacity-85 grayscale-[8%]"
              : "opacity-50 grayscale-[35%] group-hover:opacity-65 group-hover:grayscale-[20%]",
          ].join(" ")}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-neutral-900/60 text-neutral-700">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-11 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
      <div className="absolute inset-x-2 bottom-1.5 flex min-w-0 items-center gap-2 pointer-events-none">
        {showShortcut && (
          <span
            className={[
              "h-5 min-w-5 rounded px-1 flex shrink-0 items-center justify-center",
              "text-[10px] font-semibold border",
              active
                ? "border-blue-400/80 bg-blue-500/90 text-white"
                : "border-white/15 bg-black/55 text-neutral-300",
            ].join(" ")}
          >
            {index + 1}
          </span>
        )}
        <span
          className={[
            "truncate text-[11px]",
            active ? "font-medium text-white" : "text-neutral-300/80",
          ].join(" ")}
        >
          {name}
        </span>
      </div>
    </button>
  );
}

export default function ComparisonRail({
  panes,
  activePane,
  slotCount,
  showShortcuts = false,
  onSelect,
}: {
  panes: PaneId[];
  activePane?: PaneId;
  slotCount: 3 | 4;
  showShortcuts?: boolean;
  onSelect: (pane: PaneId) => void;
}) {
  const slots = Array.from({ length: slotCount }, (_, index) => panes[index]);

  return (
    <aside className="w-56 shrink-0 border-l border-neutral-800/80 bg-neutral-950 p-2">
      <div
        className="h-full min-h-0 grid gap-2"
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
              showShortcut={showShortcuts}
              onSelect={() => onSelect(pane)}
            />
          ) : (
            <div
              key={`empty-${index}`}
              className="min-h-0 rounded-lg border border-neutral-900 bg-neutral-900/20"
            />
          ),
        )}
      </div>
    </aside>
  );
}
