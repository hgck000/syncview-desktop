// Adapter tương thích mọi biến thể export của tinykeys (default / named / function)
// Không dùng `any`, qua được eslint no-explicit-any
import * as TK from "tinykeys";

export type TinykeysHandler = (e: KeyboardEvent) => void;
export type TinykeysMap = Record<string, TinykeysHandler>;
export type TinykeysFn = (
  target: Window | Document | HTMLElement,
  bindings: TinykeysMap,
  options?: { event?: "keydown" | "keyup" }
) => () => void;

function hasDefaultFn(m: unknown): m is { default: unknown } {
  return typeof m === "object" && m !== null && "default" in m;
}
function hasNamedFn(m: unknown): m is { tinykeys: unknown } {
  return typeof m === "object" && m !== null && "tinykeys" in m;
}

function toTinykeys(m: unknown): TinykeysFn {
  // TH1: ESM chuẩn: export default
  if (hasDefaultFn(m) && typeof (m as { default: unknown }).default === "function") {
    return (m as { default: unknown }).default as TinykeysFn;
  }
  // TH2: Named export: export { tinykeys }
  if (hasNamedFn(m) && typeof (m as { tinykeys: unknown }).tinykeys === "function") {
    return (m as { tinykeys: unknown }).tinykeys as TinykeysFn;
  }
  // TH3: Module bản thân là function (CJS)
  if (typeof m === "function") {
    return m as TinykeysFn;
  }
  throw new Error("Unsupported tinykeys module shape");
}

const tinykeys = toTinykeys(TK);
export default tinykeys;
