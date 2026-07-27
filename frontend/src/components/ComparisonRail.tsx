import { useEffect, useMemo, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import {
  readDataUrlImageSource,
  readImageThumbnail,
} from "../app/bridge";
import { useApp, type PaneId } from "../app/store";

const thumbnailCache = new Map<string, string>();
const MAX_CACHE_ITEMS = 64;
const THUMBNAIL_MAX_WIDTH = 384;
const THUMBNAIL_MAX_HEIGHT = 384;
const THUMBNAIL_QUALITY = 0.76;

function rememberThumbnail(key: string, value: string) {
  if (thumbnailCache.size >= MAX_CACHE_ITEMS) {
    const oldest = thumbnailCache.keys().next().value;
    if (oldest) thumbnailCache.delete(oldest);
  }
  thumbnailCache.set(key, value);
}

function makeDataUrlThumbnail(
  source: string,
  maxWidth = THUMBNAIL_MAX_WIDTH,
  maxHeight = THUMBNAIL_MAX_HEIGHT,
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
      resolve(canvas.toDataURL("image/jpeg", THUMBNAIL_QUALITY));
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
      ? readImageThumbnail(
          path,
          THUMBNAIL_MAX_WIDTH,
          THUMBNAIL_MAX_HEIGHT,
        )
      : dataURL
        ? readDataUrlImageSource(dataURL).then((source) =>
            source ? makeDataUrlThumbnail(source) : null,
          )
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
        "!m-0 !block !min-h-0 !w-full !overflow-hidden !rounded-lg",
        "!border-0 !bg-transparent !p-0 !outline-none",
        "cursor-pointer select-none transition-opacity duration-150",
        active ? "opacity-80" : "opacity-60",
      ].join(" ")}
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          draggable={false}
          className="h-full w-full object-cover bg-neutral-950"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-neutral-900/60 text-neutral-700">
          <ImageIcon className="h-6 w-6" />
        </div>
      )}
    </button>
  );
}

export default function ComparisonRail({
  panes,
  activePane,
  slotCount,
  onSelect,
}: {
  panes: PaneId[];
  activePane?: PaneId;
  slotCount: 3 | 4;
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
              onSelect={() => onSelect(pane)}
            />
          ) : (
            <div
              key={`empty-${index}`}
              className="min-h-0 rounded-lg bg-neutral-900/20"
            />
          ),
        )}
      </div>
    </aside>
  );
}
