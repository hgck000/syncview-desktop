import { create } from "zustand";

export type Layout = "auto" | "1up" | "2up" | "3up" | "4up";

type TabState = {
  id: string;
  name: string;
  layout: Layout;
  linkAll: boolean;
  sizes: { sidebar: number; leftSplit: number }; // phần trăm
  panes: Array<"A" | "B" | "C" | "D">; // placeholder
};

type AppState = {
  tabs: TabState[];
  activeTabId: string;
  setSidebarSize: (v: number) => void;
  setLeftSplit: (v: number) => void;
};

const initial: TabState = {
  id: "tab-1",
  name: "Untitled",
  layout: "auto",
  linkAll: true,
  sizes: { sidebar: 26, leftSplit: 70 },
  // panes: ["A", "B", "C", "D"], // hiển thị 2 pane mặc định
  panes: ["A", "B", "C"], // hiển thị 2 pane mặc định
};

export const useApp = create<AppState>((set, get) => ({
  tabs: [initial],
  activeTabId: "tab-1",
  setSidebarSize: (v) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, sizes: { ...t.sizes, sidebar: v } } : t)
    });
  },
  setLeftSplit: (v) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, sizes: { ...t.sizes, leftSplit: v } } : t)
    });
  },
}));
