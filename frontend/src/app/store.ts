import { create } from "zustand";

export type PaneId = "A" | "B" | "C" | "D";
export type View = { scale: number; offsetX: number; offsetY: number; imgW?: number; imgH?: number };

export type Exif = Record<string, any>;

type GridState = { on: boolean; size: number; opacity: number };
type PaneSize = { cw: number; ch: number };

const ORDER: PaneId[] = ["A","B","C","D"];


type TabState = {
  id: string;
  name: string;
  layout: "auto";
  linkAll: boolean;
  sizes: { sidebar: number; leftSplit: number };
  panes: PaneId[];          // các slot đang hiển thị
  focusIndex: number;       // pane đang focus (0..panes.length-1)
  // files: Record<PaneId, string | undefined>;
  files:   Record<PaneId, string|undefined>;     // path tuyệt đối (từ Open)
  dataURL: Record<PaneId, string|undefined>;     // dùng khi drop không có path
  names:   Record<PaneId, string|undefined>;     // label ưu tiên hiển thị
  view: Record<PaneId, View>;
  paneSize: Record<PaneId, PaneSize>; // <— NEW: kích thước khung vẽ theo pane
  grid: GridState;
  exif: Record<PaneId, Exif | undefined>;
  showDetails: Record<PaneId, boolean>;
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
  // cycleLayout: () => void;        // đổi layout lần lượt 1→2→3→4
  // setLayout: (l: Layout) => void; // ép layout
  focusNext: () => void;
  focusPrev: () => void;
  // setPaneCount: (n: 1 | 2 | 3 | 4) => void; // đổi số pane nhanh để test
  // setFileForPane: (pane: PaneId, path?: string) => void;
  nextEmptyPaneId: () => PaneId | null; // để Open khi chưa có pane nào

  setFileForPane: (pane: PaneId, path?: string, nameOverride?: string) => void;
  setDataURLForPane: (pane: PaneId, dataURL?: string, name?: string) => void;

  // view & meta
  setImageMeta: (pane: PaneId, w: number, h: number) => void;
  setView: (pane: PaneId, patch: Partial<View>) => void;
  fitView: (pane: PaneId, cw: number, ch: number) => void;
  // resetView: (pane: PaneId) => void;
  applyPan: (pane: PaneId, dx: number, dy: number) => void;
  // applyZoom: (pane: PaneId, factor: number, around?: { cx: number; cy: number; cw: number; ch: number }) => void;

  setPaneSize: (pane: PaneId, cw: number, ch: number) => void;
  resetView: (pane: PaneId) => void;  // (sẽ áp cho ALL khi linkAll)
  applyZoom: (pane: PaneId, factor: number, around:
    | { type: 'abs', cx: number, cy: number, cw: number, ch: number }
    | { type: 'norm', u: number, v: number }
  ) => void;

  toggleGrid: () => void;
  setGridSize: (px: number) => void;      // theo pixel ảnh (chưa nhân zoom)
  setGridOpacity: (v: number) => void;    // 0..1
  setExif: (pane: PaneId, exif?: Exif) => void;
  toggleDetails: (pane: PaneId) => void;
};

function panesFromSources(files: Record<PaneId, string | undefined>, dataURL: Record<PaneId, string|undefined>): PaneId[] {
  const used = ORDER.filter(id => !!files[id] || !!dataURL[id]);
  // log tiện debug
  console.log("[store] panesFromFiles ->", used);
  return used;
}

const initial: TabState = {
  id: "tab-1",
  name: "Untitled",
  layout: "auto",
  linkAll: true,
  sizes: { sidebar: 26, leftSplit: 70 },
  panes: [],
  focusIndex: 0,
  files:   { A: undefined, B: undefined, C: undefined, D: undefined },
  dataURL: { A: undefined, B: undefined, C: undefined, D: undefined },
  names:   { A: undefined, B: undefined, C: undefined, D: undefined },
  view: {
    A: { scale: 1, offsetX: 0, offsetY: 0 },
    B: { scale: 1, offsetX: 0, offsetY: 0 },
    C: { scale: 1, offsetX: 0, offsetY: 0 },
    D: { scale: 1, offsetX: 0, offsetY: 0 },
  },
  paneSize: { A:{cw:1,ch:1}, B:{cw:1,ch:1}, C:{cw:1,ch:1}, D:{cw:1,ch:1} }, // tránh chia 0
  grid: { on: false, size: 32, opacity: 0.35 },
  exif: { A: undefined, B: undefined, C: undefined, D: undefined },
  showDetails: { A: false, B: false, C: false, D: false },
};

// function panesFromSources(files: Record<PaneId, string|undefined>, dataURL: Record<PaneId, string|undefined>): PaneId[] {
//   const used = (["A","B","C","D"] as PaneId[]).filter(id => !!files[id] || !!dataURL[id]);
//   console.log("[store] panesFromSources ->", used);
//   return used;
// }

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

  focusNext: () => {
    const t = get().getActive();
    const len = t.panes.length || 1;
    const idx = (t.focusIndex + 1) % len;
    set({
      tabs: get().tabs.map(x => x.id === t.id ? { ...x, focusIndex: idx } : x)
    });
  },
  focusPrev: () => {
    const t = get().getActive();
    const len = t.panes.length || 1;
    const idx = (t.focusIndex - 1 + len) % len;
    set({
      tabs: get().tabs.map(x => x.id === t.id ? { ...x, focusIndex: idx } : x)
    });
  },

  setFileForPane: (pane, path, nameOverride) => {
    console.log("[store] setFileForPane", pane, path);
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        // cập nhật files
        const files =   { ...t.files,   [pane]: path };
        const dataURL = { ...t.dataURL, [pane]: undefined }; // path có thì bỏ dataURL cũ
        const names   = { ...t.names,   [pane]: nameOverride ?? t.names[pane] };
        // suy ra panes mới
        const panes = panesFromSources(files, dataURL).slice(0, 4);
        // clamp focus
        const view    = { ...t.view, [pane]: { scale: 1, offsetX: 0, offsetY: 0 } };
        const focusIndex = panes.length ? Math.min(t.focusIndex, panes.length - 1) : 0;
        return { ...t, files, dataURL, names, panes, view, focusIndex };
      })
    });
  },

  setPaneSize: (pane, cw, ch) => {
    const { tabs, activeTabId } = get();
    console.log("[store] setPaneSize", pane, {cw, ch});
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, paneSize: { ...t.paneSize, [pane]: { cw, ch } } }
        : t
      )
    });
  },
  setDataURLForPane: (pane, data, name) => {
    console.log("[store] setDataURLForPane", pane, data ? data.slice(0,22)+"..." : null);
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        const dataURL = { ...t.dataURL, [pane]: data };
        const files   = { ...t.files,   [pane]: undefined }; // ưu tiên dataURL
        const names   = { ...t.names,   [pane]: name ?? t.names[pane] };
        const panes   = panesFromSources(files, dataURL).slice(0, 4);
        const view    = { ...t.view, [pane]: { scale: 1, offsetX: 0, offsetY: 0 } };
        const focusIndex = panes.length ? Math.min(t.focusIndex, panes.length - 1) : 0;
        return { ...t, files, dataURL, names, panes, view, focusIndex };
      })
    });
  },

  setImageMeta: (pane, w, h) => {
    console.log("[store] setImageMeta", pane, w, h);
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, view: { ...t.view, [pane]: { ...t.view[pane], imgW: w, imgH: h } } }
        : t
      )
    });
  },

  setView: (pane, patch) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, view: { ...t.view, [pane]: { ...t.view[pane], ...patch } } }
        : t
      )
    });
  },

  fitView: (pane, cw, ch) => {
    const t = get().getActive();
    const v = t.view[pane]; const iw = v.imgW ?? 1, ih = v.imgH ?? 1;
    const fit = Math.min(cw / iw, ch / ih);
    console.log("[store] fitView", pane, {cw, ch, iw, ih, fit});
    get().setView(pane, { scale: 1, offsetX: 0, offsetY: 0 }); // scale tương đối (1=fit)
  },

  resetView: (pane) => {
    const t = get().getActive();
    const ids = t.linkAll ? t.panes : [pane];
    console.log("[store] resetView", ids);
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(tab => {
        if (tab.id !== activeTabId) return tab;
        const view = { ...tab.view };
        ids.forEach(id => { view[id] = { ...view[id], scale: 1, offsetX: 0, offsetY: 0 }; });
        return { ...tab, view };
      })
    });
  },

  applyPan: (pane, dx, dy) => {
    const t = get().getActive();
    const ids = t.linkAll ? t.panes : [pane];
    ids.forEach(id => {
      const v = t.view[id];
      get().setView(id, { offsetX: v.offsetX + dx, offsetY: v.offsetY + dy });
    });
  },

  applyZoom: (pane, factor, around) => {
    const t = get().getActive();
    const ids = t.linkAll ? t.panes : [pane];

    // Nếu nhận ABS từ pane focus, chuyển về NORM để áp cho pane khác
    let norm: {u:number,v:number} | null = null;
    if ('type' in around && around.type === 'abs') {
      const { cx, cy, cw, ch } = around;
      norm = { u: cw ? cx / cw : 0.5, v: ch ? cy / ch : 0.5 };
    } else if ('type' in around && around.type === 'norm') {
      norm = around;
    }


    ids.forEach(id => {
      const v = t.view[id];
      const { cw, ch } = t.paneSize[id] || { cw: 1, ch: 1 };
      // zoom quanh tâm khi linkAll để đồng bộ (đơn giản & mượt)
      const iw = v.imgW ?? 1, ih = v.imgH ?? 1;

      const fit = Math.min(cw / iw, ch / ih);
      const w   = iw * fit * v.scale;
      const h   = ih * fit * v.scale;

      const newScale = Math.max(1, Math.min(10, v.scale * factor));
      const w2  = iw * fit * newScale;
      const h2  = ih * fit * newScale;

      const cx = norm ? norm.u * cw : (cw / 2);
      const cy = norm ? norm.v * ch : (ch / 2);

      const center  = (CW:number, W:number) => (CW - W) / 2;
      const c1x = center(cw, w),  c1y = center(ch, h);
      const c2x = center(cw, w2), c2y = center(ch, h2);

      // const newScale = Math.max(0.1, Math.min(8, v.scale * factor));
      // Giữ điểm (cx,cy) tương đối: dịch offset theo thay đổi scale
      const k = newScale / v.scale;
      const nx = k * v.offsetX + k * c1x - c2x + (1 - k) * cx;
      const ny = k * v.offsetY + k * c1y - c2y + (1 - k) * cy;

      get().setView(id, { scale: newScale, offsetX: nx, offsetY: ny });
      console.log("[store] applyZoom", id, { old: v.scale, new: newScale, cx, cy, cw, ch });
    });
  },
  nextEmptyPaneId: () => {
  const t = get().getActive();
  for (const id of ORDER) {
    if (!t.files[id] && !t.dataURL[id]) return id;
  }
  return null; // đã đủ 4 ảnh
  },
  toggleGrid: () => {
    const { tabs, activeTabId } = get();
    console.log("[store] toggleGrid");
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, grid: { ...t.grid, on: !t.grid.on } } : t)
    });
  },
  setGridSize: (px) => {
    const { tabs, activeTabId } = get();
    console.log("[store] setGridSize", px);
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, grid: { ...t.grid, size: Math.max(4, Math.min(512, Math.round(px))) } } : t)
    });
  },
  setGridOpacity: (v) => {
    const { tabs, activeTabId } = get();
    console.log("[store] setGridOpacity", v);
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, grid: { ...t.grid, opacity: Math.max(0, Math.min(1, v)) } } : t)
    });
  },
  setExif: (pane, exif) => {
    console.log("[store] setExif", pane, exif);
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, exif: { ...t.exif, [pane]: exif } }
        : t
      )
    });
  },
  toggleDetails: (pane) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, showDetails: { ...t.showDetails, [pane]: !t.showDetails[pane] } }
        : t
      )
    });
  },
}));
