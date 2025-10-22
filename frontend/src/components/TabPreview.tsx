import { useApp } from "../app/store";
import { ImageIcon } from "lucide-react";

export function TabPreview({ tabId }: { tabId: string }) {
  const tab = useApp((s) => s.tabs.find((t) => t.id === tabId));
  const dataURL = useApp((s) => s.tabs.find((t) => t.id === tabId)?.dataURL);
  const firstPaneId = tab?.panes[0];
  const image = firstPaneId ? dataURL?.[firstPaneId] : undefined;

  return (
    <div className="w-full h-20 bg-neutral-800 rounded-md flex items-center justify-center overflow-hidden">
      {image ? (
        <img src={image} className="w-full h-full object-cover" />
      ) : (
        <ImageIcon className="w-8 h-8 text-neutral-500" />
      )}
    </div>
  );
}