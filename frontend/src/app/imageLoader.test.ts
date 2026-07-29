import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHtmlImage } from "./imageLoader";

describe("decoded image cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one browser decode between concurrent requests", async () => {
    let imageCount = 0;
    let decodeCount = 0;

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor() {
        imageCount += 1;
      }

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }

      async decode() {
        decodeCount += 1;
      }
    }

    vi.stubGlobal("Image", MockImage);

    const source = "data:image/png;base64,shared-decode-test";
    const [first, second] = await Promise.all([
      loadHtmlImage(source),
      loadHtmlImage(source),
    ]);

    expect(first.image).toBe(second.image);
    expect(imageCount).toBe(1);
    expect(decodeCount).toBe(1);
  });
});
