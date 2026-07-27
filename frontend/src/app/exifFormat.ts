/* eslint-disable @typescript-eslint/no-explicit-any */

function cleanExifText(value: unknown) {
  if (value == null) return "";
  return String(value).replace(/\0/g, "").replace(/\s+/g, " ").trim();
}

export function formatDeviceName(exif: any) {
  const make = cleanExifText(exif?.Make);
  const model = cleanExifText(exif?.Model);

  if (!make) return model || "—";
  if (!model) return make;

  const normalizedMake = make.toLocaleLowerCase();
  const normalizedModel = model.toLocaleLowerCase();
  const suffix = normalizedModel.slice(normalizedMake.length);
  const modelAlreadyContainsMake =
    normalizedModel === normalizedMake ||
    (normalizedModel.startsWith(normalizedMake) &&
      (suffix.length === 0 || /^[\s\-_:/.]/.test(suffix)));

  return modelAlreadyContainsMake ? model : `${make} ${model}`;
}

function firstExifValue(exif: any, keys: string[]) {
  const containers = [
    exif,
    exif?.Exif,
    exif?.Photo,
    exif?.SubIFD,
    exif?.tags,
    exif?.ExifIFD,
    exif?.Image,
  ];

  for (const container of containers) {
    if (!container) continue;
    for (const key of keys) {
      const value = container[key];
      if (value != null && value !== "") return value;
    }
  }

  return undefined;
}

function exifNumber(value: any): number | undefined {
  if (typeof value === "number") {
    return isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const numerator = Number(value[0]);
      const denominator = Number(value[1]);
      if (isFinite(numerator) && isFinite(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }
    return value.length > 0 ? exifNumber(value[0]) : undefined;
  }

  if (value && typeof value === "object") {
    const numerator = Number(value.numerator);
    const denominator = Number(value.denominator);
    if (isFinite(numerator) && isFinite(denominator) && denominator !== 0) {
      return numerator / denominator;
    }
  }

  if (typeof value === "string") {
    const text = value.trim();
    const fraction = text.match(
      /^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)/
    );
    if (fraction) {
      const numerator = Number(fraction[1]);
      const denominator = Number(fraction[2]);
      if (isFinite(numerator) && isFinite(denominator) && denominator !== 0) {
        return numerator / denominator;
      }
    }

    const number = text.match(/-?\d+(?:\.\d+)?/);
    if (number) {
      const parsed = Number(number[0]);
      return isFinite(parsed) ? parsed : undefined;
    }
  }

  return undefined;
}

function fmtMillimeters(value: any) {
  const millimeters = exifNumber(value);
  if (millimeters == null || millimeters <= 0) return undefined;

  const decimals = millimeters >= 100 ? 0 : millimeters >= 10 ? 1 : 2;
  const rounded = millimeters
    .toFixed(decimals)
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  return `${rounded} mm`;
}

export function formatFocalLengths(exif: any) {
  return {
    focalLength: fmtMillimeters(firstExifValue(exif, ["FocalLength"])),
    focalLength35mm: fmtMillimeters(
      firstExifValue(exif, [
        "FocalLengthIn35mmFilm",
        "FocalLengthIn35mmFormat",
        "FocalLength35efl",
      ])
    ),
  };
}
