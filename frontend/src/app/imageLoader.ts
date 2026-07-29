export type LoadedHtmlImage = {
  image: HTMLImageElement;
  release: () => void;
};

type MaterializedSource = {
  url: string;
  release: () => void;
};

type ImageCacheEntry = {
  promise: Promise<HTMLImageElement>;
  image?: HTMLImageElement;
  releaseSource?: () => void;
};

// Decoded images live for the lifetime of the app. SyncView workspaces are
// intentionally small and tab switching must never discard an already-ready
// image only to decode it again later.
const decodedImageCache = new Map<string, ImageCacheEntry>();

async function materializeSource(source: string): Promise<MaterializedSource> {
  if (!/^https?:\/\//i.test(source)) {
    return { url: source, release: () => undefined };
  }

  const response = await fetch(source, {
    method: "GET",
    credentials: "omit",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`Image server returned HTTP ${response.status}.`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error(`Image server returned ${blob.type || "unknown data"}.`);
  }

  const objectUrl = URL.createObjectURL(blob);
  let released = false;
  return {
    url: objectUrl,
    release: () => {
      if (released) return;
      released = true;
      URL.revokeObjectURL(objectUrl);
    },
  };
}

function createCacheEntry(source: string): ImageCacheEntry {
  const entry: ImageCacheEntry = {
    promise: Promise.resolve(null as unknown as HTMLImageElement),
  };

  entry.promise = (async () => {
    const materialized = await materializeSource(source);
    entry.releaseSource = materialized.release;

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () =>
          reject(new Error("The browser could not decode the image."));
        nextImage.src = materialized.url;
      });

      // WebView2 may fire load before the decoded pixels are ready for canvas.
      // Waiting for decode makes a cached hit immediately drawable later.
      if (typeof image.decode === "function") {
        await image.decode();
      }

      entry.image = image;
      return image;
    } catch (error) {
      if (decodedImageCache.get(source) === entry) {
        decodedImageCache.delete(source);
      }
      entry.releaseSource?.();
      entry.releaseSource = undefined;
      throw error;
    }
  })();

  decodedImageCache.set(source, entry);
  return entry;
}

export async function loadHtmlImage(source: string): Promise<LoadedHtmlImage> {
  const entry = decodedImageCache.get(source) ?? createCacheEntry(source);
  const image = entry.image ?? (await entry.promise);
  return { image, release: () => undefined };
}

export async function preloadHtmlImage(source: string): Promise<boolean> {
  await loadHtmlImage(source);
  return true;
}
