type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  return (
    <div className="relative bg-neutral-900 border border-neutral-800 rounded">
      {/* EXIF inline (tiêu đề mảnh) */}
      <div className="absolute top-0 left-0 right-0 h-7 px-2 flex items-center justify-between
                      bg-neutral-900/90 border-b border-neutral-800 text-xs">
        <div className="truncate">{id}.jpg — 4032×3024 • ƒ1.9 • ISO100</div>
        <button className="text-neutral-600 hover:text-neutral-800">Details ▾</button>
      </div>
      {/* Vùng ảnh (placeholder) */}
      <div className="h-full min-h-[180px] flex items-center justify-center pt-7 text-neutral-500">
        Canvas {id}
      </div>
    </div>
  );
}
