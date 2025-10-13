// frontend/src/types/tinykeys.d.ts
declare module "tinykeys" {
  export type Handler = (event: KeyboardEvent) => void;
  export type KeyBindingMap = Record<string, Handler>;

  export default function tinykeys(
    target: Window | Document | HTMLElement,
    bindings: KeyBindingMap,
    options?: { event?: "keydown" | "keyup" }
  ): () => void;
}
