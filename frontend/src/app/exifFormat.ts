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

function exifNumberText(value: any): string | undefined {
  if (typeof value === "number") {
    return isFinite(value) ? String(value) : undefined;
  }

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const numerator = Number(value[0]);
      const denominator = Number(value[1]);
      if (isFinite(numerator) && isFinite(denominator) && denominator !== 0) {
        return String(numerator / denominator);
      }
    }
    return value.length > 0 ? exifNumberText(value[0]) : undefined;
  }

  if (value && typeof value === "object") {
    const numerator = Number(value.numerator);
    const denominator = Number(value.denominator);
    if (isFinite(numerator) && isFinite(denominator) && denominator !== 0) {
      return String(numerator / denominator);
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
        return String(numerator / denominator);
      }
    }

    const number = text.match(/-?\d+(?:\.\d+)?/);
    if (number && isFinite(Number(number[0]))) return number[0];
  }

  return undefined;
}

function fmtMillimeters(value: any) {
  const millimeters = exifNumberText(value);
  if (millimeters == null || Number(millimeters) <= 0) return undefined;
  return `${millimeters} mm`;
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
