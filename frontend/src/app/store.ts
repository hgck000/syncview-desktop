/* eslint-disable @typescript-eslint/no-explicit-any */

import { create } from "zustand";
export type PaneId = "A" | "B" | "C" | "D";
export type View = {
  scale: number; offsetX: number; offsetY: number;
  imgW?: number; imgH?: number
};
export type Exif = Record<string, any>;
export type LoupeState = { on: boolean; size: number; zoom: number; shape: 'circle'|'square' };

type GridState = { on: boolean; size: number; opacity: number };
type PaneSize = { cw: number; ch: number };
type Keymap = Record<string, string>;
const ORDER: PaneId[] = ["A","B","C","D"];
const genId = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

const SAFE_EMPTY_TAB: TabState = {
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
  loupe: { on: false, size: 160, zoom: 2, shape: 'circle' },
  pointerNorm: { A:{u:0.5,v:0.5}, B:{u:0.5,v:0.5}, C:{u:0.5,v:0.5}, D:{u:0.5,v:0.5} },
};

type TabState = {
  id: string;
  name: string;
  layout: "auto";
  linkAll: boolean;
  // sizes: { sidebar: number; leftSplit: number };
  panes: PaneId[];          // các slot đang hiển thị
  focusIndex: number;       // pane đang focus (0..panes.length-1)
  files:   Record<PaneId, string|undefined>;     // path tuyệt đối (từ Open)
  dataURL: Record<PaneId, string|undefined>;     // dùng khi drop không có path
  names:   Record<PaneId, string|undefined>;     // label ưu tiên hiển thị
  view: Record<PaneId, View>;
  paneSize: Record<PaneId, PaneSize>; // <— NEW: kích thước khung vẽ theo pane
  grid: GridState;
  exif: Record<PaneId, Exif | undefined>;
  showDetails: Record<PaneId, boolean>;
  loupe: LoupeState;
  pointerNorm: Record<PaneId, {u:number; v:number}>; // vị trí con trỏ chuẩn hoá 0..1

  // title: string;
  sizes?: { sidebar?: number; leftSplit?: number };
};

type AppState = {
  tabs: TabState[];
  activeTabId: string;
  sidebarSize: number;
  newTab: (title?: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;
  closeTab: (id: string) => void;

  serialize: () => any;
  loadFromSession: (data: any) => void;

  getActive: () => TabState | null;
  getActiveSafe: () => TabState;
  hasActive: () => boolean;

  setSidebarSize: (v: number) => void;
  setLeftSplit: (v: number) => void;
  toggleLinkAll: () => void;

  focusNext: () => void;
  focusPrev: () => void;

  nextEmptyPaneId: () => PaneId | null;
  
  setFileForPane: (pane: PaneId, path?: string, nameOverride?: string) => void;
  setDataURLForPane: (pane: PaneId, dataURL?: string, name?: string) => void;
  
  setImageMeta: (pane: PaneId, w: number, h: number) => void;
  setView: (pane: PaneId, patch: Partial<View>) => void;
  fitView: (pane: PaneId, cw: number, ch: number) => void;
  applyPan: (pane: PaneId, dx: number, dy: number) => void;
  // applyZoom: (pane: PaneId, factor: number, around?: { cx: number; cy: number; cw: number; ch: number }) => void;
  
  setPaneSize: (pane: PaneId, cw: number, ch: number) => void;
  resetView: (pane: PaneId) => void;
  resetAllViews: () => void;
  applyZoom: (pane: PaneId, factor: number, around:
    | { type: 'abs', cx: number, cy: number, cw: number, ch: number }
    | { type: 'norm', u: number, v: number }
  ) => void;
  
  toggleGrid: () => void;
  setGridSize: (px: number) => void;
  setGridOpacity: (v: number) => void;
  setExif: (pane: PaneId, exif?: Exif) => void;
  toggleDetails: (pane: PaneId) => void;
  
  toggleLoupe: () => void;
  setLoupeSize: (px: number) => void;
  // setLoupeZoom: (z: number) => void;
  setPointerNorm: (pane: PaneId, u: number, v: number) => void;
  setPointerNormAll: (u: number, v: number) => void;

  helpOn: boolean;
  toggleHelp: () => void;
  clearPane: (pane: PaneId) => void;
  clearAllPanes: () => void,
  setFocusIndex: (i: number) => void;
  hydrated: boolean;
  markHydrated: (v: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  keymap: Keymap;
  setKeymap: (km: Keymap) => void;
};

function makeEmptyTab(name = "Untitled"): TabState {
  return {
    id: genId(),
    name,
    panes: [],
    files:   { A:undefined, B:undefined, C:undefined, D:undefined },
    dataURL: { A:undefined, B:undefined, C:undefined, D:undefined },
    names:   { A:undefined, B:undefined, C:undefined, D:undefined },
    view: {
      A:{scale:1,offsetX:0,offsetY:0},
      B:{scale:1,offsetX:0,offsetY:0},
      C:{scale:1,offsetX:0,offsetY:0},
      D:{scale:1,offsetX:0,offsetY:0},
    },
    showDetails: { A:false, B:false, C:false, D:false },
    linkAll: false,
    grid: { on:false, size:32, opacity:0.2 },
    loupe:{ on:false, size:220, zoom:2, shape:"circle" },
    sizes: { sidebar: 24, leftSplit: 60 },
    focusIndex: 0,
    exif: { A:undefined, B:undefined, C:undefined, D:undefined },
    pointerNorm: { A:{u:0.5,v:0.5}, B:{u:0.5,v:0.5}, C:{u:0.5,v:0.5}, D:{u:0.5,v:0.5} },
    paneSize: { A:{cw:0,ch:0}, B:{cw:0,ch:0}, C:{cw:0,ch:0}, D:{cw:0,ch:0} },
    layout: "auto",
  };
}
function panesFromSources(files: Record<PaneId, string | undefined>, dataURL: Record<PaneId, string|undefined>): PaneId[] {
  const used = ORDER.filter(id => !!files[id] || !!dataURL[id]);
  console.log("[store] panesFromFiles ->", used);
  return used;
}
function usedPanes(
  files: Record<PaneId, string|undefined>,
  dataURL: Record<PaneId, string|undefined>
): PaneId[] {
  return (["A","B","C","D"] as PaneId[]).filter(id => !!files[id] || !!dataURL[id]);
}

export const useApp = create<AppState>((set, get) => ({
  tabs: [],
  activeTabId: "",
  sidebarSize: 24,
  helpOn: false,
  toggleHelp: () => set(s => ({ helpOn: !s.helpOn })),
  hydrated: false,
  markHydrated: (v) => set({ hydrated: v }),

  keymap: {},

  setKeymap: (km) => set({ keymap: km }),
  newTab: (title) => set(state => {
    const t = makeEmptyTab(title ?? `Tab ${state.tabs.length + 1}`);
    return { ...state, tabs: [...state.tabs, t], activeTabId: t.id };
  }),

  setActiveTab: (id) => set(state => ({ ...state, activeTabId: id })),

  renameTab: (id, title) => set(state => ({
    ...state,
    tabs: state.tabs.map(t => t.id === id ? { ...t, title: title || t.name } : t)
  })),

  closeTab: (id) => set(state => {
    const idx = state.tabs.findIndex(x => x.id === id);
    if (idx === -1) return state;
    const tabs = state.tabs.filter(x => x.id !== id);
    let activeTabId = state.activeTabId;
    if (id === state.activeTabId) {
      activeTabId = tabs.length ? tabs[Math.max(0, idx-1)].id : "";
    }
    return { ...state, tabs, activeTabId };
  }),

  setSidebarSize: (pct) => set(state => {
    const t = state.tabs.find(x => x.id === state.activeTabId);
    if (!t) return { ...state, sidebarSize: pct };
    const tabs = state.tabs.map(tab => tab.id === t.id
      ? { ...tab, sizes: { ...(tab.sizes||{}), sidebar: pct } }
      : tab
    );
    return { ...state, tabs, sidebarSize: pct };
  }),

  getActive: () => {
    const s = get();
    return s.tabs.find(t => t.id === s.activeTabId) || null;
  },

  serialize: () => {
    const s = get();
    return {
      version: 1,
      activeTabId: s.activeTabId,
      tabs: s.tabs,
    };
  },

  loadFromSession: (data:any) => set(state => {
    if (!data || !Array.isArray(data.tabs)) return state;
    // đảm bảo tab nào cũng có id
    const tabs: TabState[] = data.tabs.map((t:any) => ({ ...t, id: t.id || genId() }));
    const activeTabId =
      tabs.find(x => x.id === data.activeTabId)?.id || (tabs[0]?.id ?? "");
    return { ...state, tabs, activeTabId };
  }),

  setLeftSplit: (v) => {
    const { tabs, activeTabId } = get();
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, sizes: { ...t.sizes, leftSplit: v } } : t) });
  },

  toggleLinkAll: () => {
    const { tabs, activeTabId } = get();
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, linkAll: !t.linkAll } : t) });
  },

  focusNext: () => {
    const t = get().getActive()!;
    const len = t.panes.length || 1;
    const idx = (t.focusIndex + 1) % len;
    set({
      tabs: get().tabs.map(x => x.id === t.id ? { ...x, focusIndex: idx } : x)
    });
  },
  focusPrev: () => {
    const t = get().getActive()!;
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
        const dataURL = { ...t.dataURL, [pane]: undefined };
        const names   = { ...t.names,   [pane]: nameOverride ?? t.names[pane] };
        // suy ra panes mới
        const panes = panesFromSources(files, dataURL).slice(0, 4);
         const showDetails = { ...t.showDetails, [pane]: false };
        // clamp focus
        const view    = { ...t.view, [pane]: { scale: 1, offsetX: 0, offsetY: 0 } };
        const focusIndex = panes.length ? Math.min(t.focusIndex, panes.length - 1) : 0;
        return { ...t, files, dataURL, names, panes, view, focusIndex, showDetails };
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
        const files   = { ...t.files,   [pane]: undefined };
        const names   = { ...t.names,   [pane]: name ?? t.names[pane] };
        const panes   = panesFromSources(files, dataURL).slice(0, 4);
        const view    = { ...t.view, [pane]: { scale: 1, offsetX: 0, offsetY: 0 } };
        const showDetails = { ...t.showDetails, [pane]: false };
        const focusIndex = panes.length ? Math.min(t.focusIndex, panes.length - 1) : 0;
        return { ...t, files, dataURL, names, panes, view, focusIndex, showDetails };
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
    const t = get().getActive()!;
    const v = t.view[pane]; const iw = v.imgW ?? 1, ih = v.imgH ?? 1;
    const fit = Math.min(cw / iw, ch / ih);
    console.log("[store] fitView", pane, {cw, ch, iw, ih, fit});
    get().setView(pane, { scale: 1, offsetX: 0, offsetY: 0 });
  },

  resetView: (pane) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const { imgW, imgH } = tab.view[pane];
    if (!imgW || !imgH) return;
    const { cw, ch } = tab.paneSize[pane];
    const scale = Math.min(cw / imgW, ch / imgH);
    const offsetX = (cw - imgW * scale) / 2;
    const offsetY = (ch - imgH * scale) / 2;
    const newView = { ...tab.view, [pane]: { ...tab.view[pane], scale, offsetX, offsetY } };
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, view: newView } : t) });
  },

  resetAllViews: () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    let newView = { ...tab.view };
    for (const pane of tab.panes) {
      const { imgW, imgH } = tab.view[pane];
      if (!imgW || !imgH) continue;
      const { cw, ch } = tab.paneSize[pane];
      const scale = Math.min(cw / imgW, ch / imgH);
      const offsetX = (cw - imgW * scale) / 2;
      const offsetY = (ch - imgH * scale) / 2;
      newView = { ...newView, [pane]: { ...newView[pane], scale: 1, offsetX: 0, offsetY: 0 } };
    }
    set({ tabs: tabs.map(t => t.id === activeTabId ? { ...t, view: newView } : t) });
    console.log('[reset-view] done');
  },

  applyZoom: (pane, factor, around) => {
    const t = get().getActive()!;
    const ids = t.linkAll ? t.panes : [pane];

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
      const iw = v.imgW ?? 1, ih = v.imgH ?? 1;

      const fit = Math.min(cw / iw, ch / ih);
      const w   = iw * fit * v.scale;
      const h   = ih * fit * v.scale;

      const newScale = Math.max(0.8, Math.min(10, v.scale * factor));
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
  const t = get().getActive()!;
  for (const id of ORDER) {
    if (!t.files[id] && !t.dataURL[id]) return id;
  }
  return null;
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

  // LOUPE && SYNC LOUPE
  toggleLoupe: () => {
  const { tabs, activeTabId, getActive } = get();
  const tab = getActive();
  const next = !tab?.loupe.on;
  console.log("[store] toggleLoupe ->", next);
  set({
    tabs: tabs.map(t => {
      if (t.id !== activeTabId) return t;
      return {
        ...t,
        loupe: { ...t.loupe, on: next, zoom: next ? 2 : t.loupe.zoom }
      };
    })
  });
  if (next && tab?.linkAll && tab.panes.length) {
    const focus = tab.panes[tab.focusIndex] || tab.panes[0];
    const p = tab.pointerNorm[focus] || { u: 0.5, v: 0.5 };
    get().setPointerNormAll(p.u, p.v);
  }
},

  setLoupeSize: (px) => {
    const { tabs, activeTabId } = get();
    const size = Math.max(150, Math.min(500, Math.round(px)));
    console.log("[store] setLoupeSize", size);
    set({
      tabs: tabs.map(t => t.id === activeTabId ? { ...t, loupe: { ...t.loupe, size } } : t)
    });
  },

  setPointerNorm: (pane, u, v) => {
    const { tabs, activeTabId } = get();
    const clamp = (x:number)=> Math.max(0, Math.min(1, x));
    const val = { u: clamp(u), v: clamp(v) };
    set({
      tabs: tabs.map(t => t.id === activeTabId
        ? { ...t, pointerNorm: { ...t.pointerNorm, [pane]: val } }
        : t
      )
    });
  },

  setPointerNormAll: (u, v) => {
    const { tabs, activeTabId } = get();
    const clamp = (x:number)=> Math.max(0, Math.min(1, x));
    const val = { u: clamp(u), v: clamp(v) };
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        const pn = { ...t.pointerNorm };
        t.panes.forEach(id => { pn[id] = val; });
        return { ...t, pointerNorm: pn };
      })
    });
  },

  clearPane: (pane) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;
        const files   = { ...t.files,   [pane]: undefined };
        const dataURL = { ...t.dataURL, [pane]: undefined };
        const names   = { ...t.names,   [pane]: undefined };
        const exif    = t.exif ? { ...t.exif, [pane]: undefined } : t.exif;
        const view    = { ...t.view, [pane]: { scale: 1, offsetX: 0, offsetY: 0 } };
        const panes   = usedPanes(files, dataURL);
        const focusIndex = panes.length ? Math.min(t.focusIndex, panes.length-1) : 0;
        const showDetails = { ...t.showDetails, [pane]: false };
        console.log("[store] clearPane", pane, "->", panes);
        return { ...t, files, dataURL, names, exif, view, panes, focusIndex, showDetails };
      })
    });
  },

  clearAllPanes: () => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map(t => {
        if (t.id !== activeTabId) return t;

        // reset toàn bộ slot A–D về rỗng
        const empty = { A: undefined, B: undefined, C: undefined, D: undefined } as Record<PaneId, undefined>;
        const freshView = {
          A: { scale: 1, offsetX: 0, offsetY: 0 },
          B: { scale: 1, offsetX: 0, offsetY: 0 },
          C: { scale: 1, offsetX: 0, offsetY: 0 },
          D: { scale: 1, offsetX: 0, offsetY: 0 },
        } as Record<PaneId, View>;
        const showDetails = { A:false, B:false, C:false, D:false } as Record<PaneId, boolean>;

        return {
          ...t,
          files:   { ...empty },
          dataURL: { ...empty },
          names:   { ...empty },
          exif:    { ...empty },
          panes:   [],
          focusIndex: 0,
          view: freshView,
          showDetails,
        };
      }),
    });
    try { (get() as any).saveLastSession?.() } catch (e) { void e }
  },

  setFocusIndex: (i: number) => set(state => {
    const t = state.getActive?.() as any;
    if (!t) return state;
    const tabs = state.tabs.map(tab => tab.id === state.activeTabId ? { ...tab, focusIndex: i } : tab);
    return { ...state, tabs };
  }),

  getActiveSafe: () => {
    const s = get();
    return s.tabs.find(t => t.id === s.activeTabId) ?? SAFE_EMPTY_TAB;
  },

  hasActive: () => {
    const s = get();
    return !!s.tabs.find(t => t.id === s.activeTabId);
  },

  reorderTabs: (fromIndex: number, toIndex: number) => {
    const s = get();
    const n = s.tabs.length;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= n || toIndex >= n) return;
    const tabs = s.tabs.slice();
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    set({ tabs });
  },
}));
