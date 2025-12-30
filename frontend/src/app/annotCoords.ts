export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

// Map (x,y) theo pixel ảnh -> (u,v) trong square space 0..1 (isotropic)
export function imgPxToStrokeUV(
  iw: number,
  ih: number,
  xImg: number,
  yImg: number
) {
  const S = Math.max(iw, ih);
  const padX = (S - iw) / 2;
  const padY = (S - ih) / 2;

  const u = (xImg + padX) / S;
  const v = (yImg + padY) / S;

  return { u: clamp(u, 0, 1), v: clamp(v, 0, 1) };
}

// Map (u,v) square space -> (x,y) pixel ảnh
export function strokeUVToImgPx(iw: number, ih: number, u: number, v: number) {
  const S = Math.max(iw, ih);
  const padX = (S - iw) / 2;
  const padY = (S - ih) / 2;

  const x = u * S - padX;
  const y = v * S - padY;

  return { x, y };
}
