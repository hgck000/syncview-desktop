import { describe, expect, it } from "vitest";
import {
  buildExifLines,
  formatExportFocalLength,
  formatPixelDimensions,
  getExportEncoding,
} from "./exportWorkspace";

describe("export encoding", () => {
  it("keeps PNG lossless and encodes JPEG at high quality", () => {
    expect(getExportEncoding("png")).toEqual({
      mimeType: "image/png",
      quality: undefined,
    });
    expect(getExportEncoding("jpeg")).toEqual({
      mimeType: "image/jpeg",
      quality: 0.95,
    });
  });
});

describe("export EXIF focal length", () => {
  it("keeps at most three decimal places", () => {
    expect(formatExportFocalLength(1.23456)).toBe("1.235 mm");
    expect(formatExportFocalLength(1.54)).toBe("1.54 mm");
    expect(formatExportFocalLength(7)).toBe("7 mm");
  });

  it("supports rational EXIF values", () => {
    expect(formatExportFocalLength([4637, 1000])).toBe("4.637 mm");
    expect(
      formatExportFocalLength({ numerator: 12345, denominator: 10_000 }),
    ).toBe("1.235 mm");
  });
});

describe("export EXIF lines", () => {
  it("places source pixel dimensions beside file size", () => {
    expect(formatPixelDimensions(4000, 3000)).toBe("4000x3000");
    expect(formatPixelDimensions(0, 3000)).toBeUndefined();
  });

  it("keeps four lines and labels only the exported focal length", () => {
    const pane = {
      image: { naturalWidth: 4000, naturalHeight: 3000 },
      exif: {
        Make: "HUAWEI",
        Model: "HUAWEI Pura 90 Pro Max",
        FileSize: 2_202_010,
        FocalLength: { numerator: 12_345, denominator: 10_000 },
        FocalLengthIn35mmFilm: 24,
        ISO: 50,
        FNumber: 2,
        ExposureTime: 1 / 496,
      },
    } as unknown as Parameters<typeof buildExifLines>[0];

    expect(buildExifLines(pane)).toEqual([
      "HUAWEI Pura 90 Pro Max",
      "2.1 MB · 4000x3000",
      "1.235 mm · Focal length",
      "24 mm · ISO 50 · f/2 · 1/496",
    ]);
  });
});
