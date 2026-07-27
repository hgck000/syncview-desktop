/* eslint-disable @typescript-eslint/no-explicit-any */

import { useApp } from "../app/store";

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
const imageExtRe = /\.(png|jpe?g|webp|gif|bmp|tiff?|heic)$/i;

export default function DropZone({ children }: { children: React.ReactNode }) {
  const t = useApp((s) => s.getActive());
  const setFileForPane = useApp((s) => s.setFileForPane);
  const setDataURLForPane = useApp((s) => s.setDataURLForPane);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    if (!t) return;
    const files = Array.from(e.dataTransfer.files);
    // console.log("[DropZone] dropped", files);
    if (!files.length) return;

    const imgs = files.filter(
      (f) => (f.type?.startsWith("image/") ?? false) || imageExtRe.test(f.name)
    );
    if (!imgs.length) {
      alert("Không phải file ảnh!");
      return;
    }

    imgs.sort((a, b) => collator.compare(a.name, b.name));

    // danh sách slot trống theo ORDER
    const emptySlots = (["A", "B", "C", "D"] as const).filter(
      (id) => !t.files[id] && !t.dataURL[id]
    );
    // console.log("[DropZone] emptySlots =", emptySlots);

    imgs.slice(0, emptySlots.length).forEach((f, i) => {
      const id = emptySlots[i];
      const abs = (f as any).path as string | undefined;

      if (abs) {
        // console.log("[DropZone] set path", id, "=>", abs);
        setFileForPane(id, abs, f.name);
      } else {
        // không có path: đọc DataURL
        const reader = new FileReader();
        reader.onload = () => {
          const data = reader.result as string;
          // console.log("[DropZone] set dataURL", id, "len=", data.length);
          setDataURLForPane(id, data, f.name);
        };
        // reader.onerror = (err) => console.warn("[DropZone] FileReader error", err);
        reader.readAsDataURL(f);
      }
    });
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="relative w-full h-full"
    >
      {children}
      <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-transparent hover:border-blue-500/50 transition-all" />
    </div>
  );
}
