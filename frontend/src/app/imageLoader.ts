export type LoadedHtmlImage = {
  image: HTMLImageElement;
  release: () => void;
};

async function materializeSource(source: string) {
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

export async function loadHtmlImage(source: string): Promise<LoadedHtmlImage> {
  const materialized = await materializeSource(source);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () =>
        reject(new Error("The browser could not decode the image."));
      nextImage.src = materialized.url;
    });

    // WebView2 may fire load before the decoded pixels are ready for canvas.
    // Waiting for decode keeps the first draw deterministic.
    if (typeof image.decode === "function") {
      await image.decode();
    }

    return { image, release: materialized.release };
  } catch (error) {
    materialized.release();
    throw error;
  }
}
