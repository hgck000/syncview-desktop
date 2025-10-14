import { create } from "zustand";

export type Layout = "auto" | "1up" | "2up" | "3up" | "4up";
export type PaneId = "A" | "B" | "C" | "D";

type TabState = {
  id: string;
  name: string;
  layout: Layout;
  linkAll: boolean;
  sizes: { sidebar: number; leftSplit: number };
  panes: PaneId[];          // các slot đang hiển thị
  focusIndex: number;       // pane đang focus (0..panes.length-1)
  files: Record<PaneId, string | undefined>;
};

type AppState = {
  tabs: TabState[];
  activeTabId: string;
  // getters tiện dụng
  getActive: () => TabState;
  // actions UI
  setSidebarSize: (v: number) => void;
  setLeftSplit: (v: number) => void;
  toggleLinkAll: () => void;
  cycleLayout: () => void;        // đổi layout lần lượt 1→2→3→4
  setLayout: (l: Layout) => void; // ép layout
  focusNext: () => void;
  focusPrev: () => void;
  setPaneCount: (n: 1 | 2 | 3 | 4) => void; // đổi số pane nhanh để test
  setFileForPane: (pane: PaneId, path?: string) => void;
};

const initial: TabState = {
  id: "tab-1",
  name: "Untitled",
  layout: "auto",
  linkAll: true,
  sizes: { sidebar: 26, leftSplit: 70 },
  panes: ["A", "B", "C"],
  focusIndex: 0,
  files: { A: undefined, B: undefined, C: undefined, D: undefined },
};

const layoutForCount = (n: number): Layout =>
  n === 1 ? "1up" : n === 2 ? "2up" : n === 3 ? "3up" : "4up";

export const useApp = create<AppState>((set, get) => ({
  tabs: [initial],
  activeTabId: "tab-1",

  getActive: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId)!;
  },

  setSidebarSize: (v) => {
    const { tabs, activeTabId } = get();
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, sizes: { ...t.sizes, sidebar: v } } : t) });
  },
  setLeftSplit: (v) => {
    const { tabs, activeTabId } = get();
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, sizes: { ...t.sizes, leftSplit: v } } : t) });
  },

  toggleLinkAll: () => {
    const { tabs, activeTabId } = get();
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, linkAll: !t.linkAll } : t) });
  },

  cycleLayout: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        const n = t.panes.length;
        const next = n === 1 ? 2 : n === 2 ? 3 : n === 3 ? 4 : 1;
        return { ...t, panes: (["A","B","C","D"] as PaneId[]).slice(0, next), layout: layoutForCount(next), focusIndex: 0 };
      })
    });
  },

  setLayout: (l) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        const n = l === "1up" ? 1 : l === "2up" ? 2 : l === "3up" ? 3 : 4;
        return { ...t, layout: l, panes: (["A","B","C","D"] as PaneId[]).slice(0, n), focusIndex: 0 };
      })
    });
  },

  focusNext: () => {
    const t = get().getActive();
    const idx = (t.focusIndex + 1) % t.panes.length;
    set({
      tabs: get().tabs.map(x => x.id === t.id ? { ...x, focusIndex: idx } : x)
    });
  },
  focusPrev: () => {
    const t = get().getActive();
    const idx = (t.focusIndex - 1 + t.panes.length) % t.panes.length;
    set({
      tabs: get().tabs.map(x => x.id === t.id ? { ...x, focusIndex: idx } : x)
    });
  },

  setPaneCount: (n) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, panes: (["A","B","C","D"] as PaneId[]).slice(0, n), layout: layoutForCount(n), focusIndex: 0 }
        : t
      )
    });
  },
  // ... giữ nguyên các action cũ ...
  setFileForPane: (pane, path) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, files: { ...t.files, [pane]: path } }
        : t)
    });
  },
}));
