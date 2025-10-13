import { useApp } from "../app/store";

type Props = { id: "A" | "B" | "C" | "D" };

export default function Pane({ id }: Props) {
  const t = useApp(s => s.getActive());
  const idx = t.panes.indexOf(id);
  const focused = idx === t.focusIndex;

  // return (
  //   <div className={`relative border rounded bg-neutral-900 ${focused ? "border-blue-600" : "border-neutral-800"}`}>
  //     <div className="absolute top-0 left-0 right-0 h-7 px-2 flex items-center justify-between bg-neutral-900/90 border-b border-neutral-800 text-xs">
  //       <div className="truncate">{id}.jpg — 4032×3024 • ƒ1.9 • ISO100</div>
  //       <button className="text-neutral-600 hover:text-neutral-800">Details ▾</button>
  //     </div>
  //     <div className="h-full min-h-[180px] flex items-center justify-center pt-7 text-neutral-500 select-none">
  //       Canvas {id} {focused && "• focus"}
  //     </div>
  //   </div>
  // );

    return (
    <div className={`relative min-h-0 bg-neutral-900 border rounded ${focused ? "border-blue-600" : "border-neutral-800"}`}>
      {/* EXIF inline */}
      <div className="absolute top-0 left-0 right-0 h-7 px-2 flex items-center justify-between
                      bg-neutral-900/90 border-b border-neutral-800 text-xs">
        <div className="truncate">{id}.jpg — 4032×3024 • ƒ1.9 • ISO100</div>
        <button className="text-neutral-600 hover:text-neutral-800">Details ▾</button>
      </div>

      {/* vùng ảnh chiếm hết phần còn lại */}
      <div className="h-full min-h-[180px] pt-7 flex items-center justify-center text-neutral-500 select-none">
        Canvas {id} {focused && "• focus"}
      </div>
    </div>
  );
}
