/* eslint-disable @typescript-eslint/no-explicit-any */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

export type PaneId = "A" | "B" | "C" | "D";
export type View = {
  scale: number;
  offsetX: number;
  offsetY: number;
  imgW?: number;
  imgH?: number;
};
export type Exif = Record<string, any>;
export type LoupeState = {
  on: boolean;
  size: number;
  zoom: number;
  shape: "circle" | "square";
};

// draw & erase
export type StrokePt = { u: number; v: number }; // u/v theo ảnh (0..1)
export type StrokeMode = "draw" | "erase";
export type Stroke = {
  id: string;
  mode: StrokeMode;
  color: string; // dùng cho draw
  size: number; // px trong viewer (sẽ scale theo loupe nếu bị zoom)
  pts: StrokePt[];
};

export type AnnotateState = {
  mode: "none" | "draw" | "erase";
  color: string;
  size: number; // brush size
  eraserSize: number;
};

type GridState = { on: boolean; size: number; opacity: number };
type PaneSize = { cw: number; ch: number };
type Keymap = Record<string, string>;
const ORDER: PaneId[] = ["A", "B", "C", "D"];
const genId = () =>
  `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const clamp = (x: number, min: number, max: number) =>
  Math.max(min, Math.min(max, x));

const clamp01 = (x: number) => clamp(x, 0, 1);

const SAFE_EMPTY_TAB: TabState = {
  id: "tab-1",
  name: "Untitled",
  layout: "auto",
  linkAll: true,
  sizes: { sidebar: 26, leftSplit: 70 },
  panes: [],
  focusIndex: 0,
  files: { A: undefined, B: undefined, C: undefined, D: undefined },
  dataURL: { A: undefined, B: undefined, C: undefined, D: undefined },
  names: { A: undefined, B: undefined, C: undefined, D: undefined },
  view: {
    A: { scale: 1, offsetX: 0, offsetY: 0 },
    B: { scale: 1, offsetX: 0, offsetY: 0 },
    C: { scale: 1, offsetX: 0, offsetY: 0 },
    D: { scale: 1, offsetX: 0, offsetY: 0 },
  },
  paneSize: {
    A: { cw: 1, ch: 1 },
    B: { cw: 1, ch: 1 },
    C: { cw: 1, ch: 1 },
    D: { cw: 1, ch: 1 },
  }, // tránh chia 0
  grid: { on: false, size: 32, opacity: 0.35 },
  exif: { A: undefined, B: undefined, C: undefined, D: undefined },
  showDetails: { A: false, B: false, C: false, D: false },
  loupe: { on: false, size: 160, zoom: 2, shape: "circle" },
  pointerNorm: {
    A: { u: 0.5, v: 0.5 },
    B: { u: 0.5, v: 0.5 },
    C: { u: 0.5, v: 0.5 },
    D: { u: 0.5, v: 0.5 },
  },
  annotate: { mode: "none", color: "#ff3b30", size: 4, eraserSize: 18 },
  strokes: { A: [], B: [], C: [], D: [] },
};

type TabState = {
  id: string;
  name: string;
  layout: "auto";
  linkAll: boolean;
  // sizes: { sidebar: number; leftSplit: number };
  panes: PaneId[]; // các slot đang hiển thị
  focusIndex: number; // pane đang focus (0..panes.length-1)
  files: Record<PaneId, string | undefined>; // path tuyệt đối (từ Open)
  dataURL: Record<PaneId, string | undefined>; // dùng khi drop không có path
  names: Record<PaneId, string | undefined>; // label ưu tiên hiển thị
  view: Record<PaneId, View>;
  paneSize: Record<PaneId, PaneSize>; // <— NEW: kích thước khung vẽ theo pane
  grid: GridState;
  exif: Record<PaneId, Exif | undefined>;
  showDetails: Record<PaneId, boolean>;
  loupe: LoupeState;
  pointerNorm: Record<PaneId, { u: number; v: number }>; // vị trí con trỏ chuẩn hoá 0..1
  sizes?: { sidebar?: number; leftSplit?: number };
  annotate: AnnotateState;
  strokes: Record<PaneId, Stroke[]>;
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
  applyZoom: (
    pane: PaneId,
    factor: number,
    around:
      | { type: "abs"; cx: number; cy: number; cw: number; ch: number }
      | { type: "norm"; u: number; v: number }
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
  clearAllPanes: () => void;
  setFocusIndex: (i: number) => void;
  hydrated: boolean;
  markHydrated: (v: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  keymap: Keymap;
  setKeymap: (km: Keymap) => void;

  addImageFromDataURL: (dataURL: string) => void;

  sidebarCollapsed: boolean;
  sidebarPeek: boolean;
  sidebarExpandedSize: number;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarPeek: (v: boolean) => void;
  setSidebarExpandedSize: (v: number) => void;
  toggleDraw: () => void;
  toggleErase: () => void;
  setBrushColor: (hex: string) => void;
  setBrushSize: (px: number) => void;
  setEraserSize: (px: number) => void;

  startStroke: (panes: PaneId[], mode: StrokeMode, p0: StrokePt) => string;
  appendStrokePoint: (panes: PaneId[], strokeId: string, p: StrokePt) => void;
};

type SavedSession = {
  version?: number;
  tabs?: any[];
  activeTabId?: string | null;
};

function makeEmptyTab(name = "Untitled"): TabState {
  return {
    id: genId(),
    name,
    panes: [],
    files: { A: undefined, B: undefined, C: undefined, D: undefined },
    dataURL: { A: undefined, B: undefined, C: undefined, D: undefined },
    names: { A: undefined, B: undefined, C: undefined, D: undefined },
    view: {
      A: { scale: 1, offsetX: 0, offsetY: 0 },
      B: { scale: 1, offsetX: 0, offsetY: 0 },
      C: { scale: 1, offsetX: 0, offsetY: 0 },
      D: { scale: 1, offsetX: 0, offsetY: 0 },
    },
    showDetails: { A: false, B: false, C: false, D: false },
    linkAll: false,
    grid: { on: false, size: 32, opacity: 0.2 },
    loupe: { on: false, size: 220, zoom: 2, shape: "circle" },
    sizes: { sidebar: 24, leftSplit: 60 },
    focusIndex: 0,
    exif: { A: undefined, B: undefined, C: undefined, D: undefined },
    pointerNorm: {
      A: { u: 0.5, v: 0.5 },
      B: { u: 0.5, v: 0.5 },
      C: { u: 0.5, v: 0.5 },
      D: { u: 0.5, v: 0.5 },
    },
    paneSize: {
      A: { cw: 0, ch: 0 },
      B: { cw: 0, ch: 0 },
      C: { cw: 0, ch: 0 },
      D: { cw: 0, ch: 0 },
    },
    layout: "auto",
    annotate: { mode: "none", color: "#ff3b30", size: 4, eraserSize: 18 },
    strokes: { A: [], B: [], C: [], D: [] },
  };
}
function panesFromSources(
  files: Record<PaneId, string | undefined>,
  dataURL: Record<PaneId, string | undefined>
): PaneId[] {
  const used = ORDER.filter((id) => !!files[id] || !!dataURL[id]);
  console.log("[store] panesFromFiles ->", used);
  return used;
}
function usedPanes(
  files: Record<PaneId, string | undefined>,
  dataURL: Record<PaneId, string | undefined>
): PaneId[] {
  return (["A", "B", "C", "D"] as PaneId[]).filter(
    (id) => !!files[id] || !!dataURL[id]
  );
}

export const useApp = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    tabs: [],
    activeTabId: "",
    sidebarSize: 24,
    helpOn: false,
    toggleHelp: () => set((s) => ({ helpOn: !s.helpOn })),
    hydrated: false,
    markHydrated: (v) => set({ hydrated: v }),

    keymap: {},

    setKeymap: (km) => set({ keymap: km }),
    newTab: (title) =>
      set((state) => {
        const t = makeEmptyTab(title ?? `Tab ${state.tabs.length + 1}`);
        return { ...state, tabs: [...state.tabs, t], activeTabId: t.id };
      }),

    setActiveTab: (id) => set((state) => ({ ...state, activeTabId: id })),

    sidebarCollapsed: false,
    sidebarPeek: false,
    sidebarExpandedSize: 15,

    setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    setSidebarPeek: (v) => set({ sidebarPeek: v }),
    setSidebarExpandedSize: (v) =>
      set({ sidebarExpandedSize: Math.max(4, Math.min(20, v)) }),

    renameTab: (id, title) =>
      set((state) => ({
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, name: title || t.name } : t
        ),
      })),

    // renameTab: (id, title) =>
    //   set((state) => ({
    //     ...state,
    //     tabs: state.tabs.map((t) => {
    //       if (t.id !== id) return t;
    //       const nextName = (title ?? "").trim();
    //       return { ...t, name: nextName.length ? nextName : t.name };
    //     }),
    //   })),

    closeTab: (id) =>
      set((state) => {
        const idx = state.tabs.findIndex((x) => x.id === id);
        if (idx === -1) return state;
        const tabs = state.tabs.filter((x) => x.id !== id);
        let activeTabId = state.activeTabId;
        if (id === state.activeTabId) {
          activeTabId = tabs.length ? tabs[Math.max(0, idx - 1)].id : "";
        }
        return { ...state, tabs, activeTabId };
      }),

    setSidebarSize: (pct) =>
      set((state) => {
        const t = state.tabs.find((x) => x.id === state.activeTabId);
        if (!t) return { ...state, sidebarSize: pct };
        const tabs = state.tabs.map((tab) =>
          tab.id === t.id
            ? { ...tab, sizes: { ...(tab.sizes || {}), sidebar: pct } }
            : tab
        );
        return { ...state, tabs, sidebarSize: pct };
      }),

    getActive: () => {
      const s = get();
      return s.tabs.find((t) => t.id === s.activeTabId) || null;
    },

    serialize: () => {
      const s = get();

      const tabsForSave = s.tabs.map((t) => {
        // copy toàn bộ tab rồi bỏ trường exif
        const restTab = { ...t } as any;
        delete restTab.exif;

        // dataURL mới: chỉ giữ những ảnh không có path (drop image)
        const filteredDataURL: typeof t.dataURL = {} as any;
        for (const paneId of t.panes) {
          const path = t.files[paneId];
          const url = t.dataURL[paneId];
          if (!path && url) {
            filteredDataURL[paneId] = url;
          }
        }

        return {
          ...restTab,
          dataURL: filteredDataURL,
        };
      });

      return {
        version: 1,
        tabs: tabsForSave,
        activeTabId: s.activeTabId,
      };
    },

    loadFromSession: (data: SavedSession) =>
      set((state) => {
        try {
          if (!data || typeof data !== "object") {
            console.warn("[session] invalid data, ignoring:", data);
            return state;
          }

          // chỉ chấp nhận version 1; các version khác bỏ qua
          if (data.version !== 1) {
            console.warn(
              "[session] incompatible version, expected 1 got",
              data.version
            );
            return state;
          }

          if (!Array.isArray(data.tabs) || data.tabs.length === 0) {
            console.warn("[session] no tabs in session");
            return state;
          }

          const tabs: TabState[] = data.tabs.map((raw: any, idx: number) => {
            // 👉 CLONE từ SAFE_EMPTY_TAB, không gọi SAFE_EMPTY_TAB()
            const base: TabState = {
              ...SAFE_EMPTY_TAB,
              id: raw.id ?? `tab-${idx + 1}`,
              name: raw.name ?? `Tab ${idx + 1}`,
            };

            return {
              ...base,
              ...raw,
              exif: {}, // luôn reset exif, sẽ được nạp lại qua readExifFromPath
            };
          });

          const activeTabId =
            data.activeTabId && tabs.some((t) => t.id === data.activeTabId)
              ? data.activeTabId
              : tabs[0]?.id ?? null;

          return {
            ...state,
            tabs,
            activeTabId,
          };
        } catch (e) {
          console.error("[session] failed to load session, ignoring:", e);
          return state;
        }
      }),

    setLeftSplit: (v) => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, sizes: { ...t.sizes, leftSplit: v } }
            : t
        ),
      });
    },

    toggleLinkAll: () => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId ? { ...t, linkAll: !t.linkAll } : t
        ),
      });
    },

    focusNext: () => {
      const t = get().getActive()!;
      const len = t.panes.length || 1;
      const idx = (t.focusIndex + 1) % len;
      set({
        tabs: get().tabs.map((x) =>
          x.id === t.id ? { ...x, focusIndex: idx } : x
        ),
      });
    },
    focusPrev: () => {
      const t = get().getActive()!;
      const len = t.panes.length || 1;
      const idx = (t.focusIndex - 1 + len) % len;
      set({
        tabs: get().tabs.map((x) =>
          x.id === t.id ? { ...x, focusIndex: idx } : x
        ),
      });
    },

    setFileForPane: (pane, path, nameOverride) => {
      console.log("[store] setFileForPane", pane, path);
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          // cập nhật files
          const files = { ...t.files, [pane]: path };
          const dataURL = { ...t.dataURL, [pane]: undefined };
          const names = { ...t.names, [pane]: nameOverride ?? t.names[pane] };
          // suy ra panes mới
          const panes = panesFromSources(files, dataURL).slice(0, 4);
          const showDetails = { ...t.showDetails, [pane]: false };
          // clamp focus
          const view = {
            ...t.view,
            [pane]: { scale: 1, offsetX: 0, offsetY: 0 },
          };
          const exif = t.exif ? { ...t.exif, [pane]: undefined } : t.exif;
          const strokes = { ...t.strokes, [pane]: [] };
          const focusIndex = panes.length
            ? Math.min(t.focusIndex, panes.length - 1)
            : 0;
          return {
            ...t,
            files,
            dataURL,
            names,
            panes,
            view,
            focusIndex,
            showDetails,
            strokes,
            exif,
          };
        }),
      });
    },

    setPaneSize: (pane, cw, ch) => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          const prev = t.paneSize?.[pane];
          if (prev && prev.cw === cw && prev.ch === ch) return t;
          return {
            ...t,
            paneSize: { ...t.paneSize, [pane]: { cw, ch } },
          };
        }),
      });
    },

    setDataURLForPane: (pane, data, name) => {
      console.log(
        "[store] setDataURLForPane",
        pane,
        data ? data.slice(0, 22) + "..." : null
      );
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          const dataURL = { ...t.dataURL, [pane]: data };
          const files = { ...t.files, [pane]: undefined };
          const names = { ...t.names, [pane]: name ?? t.names[pane] };
          const panes = panesFromSources(files, dataURL).slice(0, 4);
          const view = {
            ...t.view,
            [pane]: { scale: 1, offsetX: 0, offsetY: 0 },
          };
          const showDetails = { ...t.showDetails, [pane]: false };
          const strokes = { ...t.strokes, [pane]: [] };
          const exif = t.exif ? { ...t.exif, [pane]: undefined } : t.exif;
          const focusIndex = panes.length
            ? Math.min(t.focusIndex, panes.length - 1)
            : 0;
          return {
            ...t,
            files,
            dataURL,
            names,
            panes,
            view,
            focusIndex,
            showDetails,
            strokes,
            exif,
          };
        }),
      });
    },

    setImageMeta: (pane, w, h) => {
      console.log("[store] setImageMeta", pane, w, h);
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                view: {
                  ...t.view,
                  [pane]: { ...t.view[pane], imgW: w, imgH: h },
                },
              }
            : t
        ),
      });
    },

    setView: (pane, patch) => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                view: { ...t.view, [pane]: { ...t.view[pane], ...patch } },
              }
            : t
        ),
      });
    },

    fitView: (pane, cw, ch) => {
      const t = get().getActive()!;
      const v = t.view[pane];
      const iw = v.imgW ?? 1,
        ih = v.imgH ?? 1;
      const fit = Math.min(cw / iw, ch / ih);
      console.log("[store] fitView", pane, { cw, ch, iw, ih, fit });
      get().setView(pane, { scale: 1, offsetX: 0, offsetY: 0 });
    },

    resetView: (pane) => {
      const t = get().getActive()!;
      const ids = t.linkAll ? t.panes : [pane];
      console.log("[store] resetView", ids);
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((tab) => {
          if (tab.id !== activeTabId) return tab;
          const view = { ...tab.view };
          ids.forEach((id) => {
            view[id] = { ...view[id], scale: 1, offsetX: 0, offsetY: 0 };
          });
          return { ...tab, view };
        }),
      });
    },

    applyPan: (pane, dx, dy) => {
      const t = get().getActive()!;
      const ids = t.linkAll ? t.panes : [pane];
      ids.forEach((id) => {
        const v = t.view[id];
        get().setView(id, { offsetX: v.offsetX + dx, offsetY: v.offsetY + dy });
      });
    },

    applyZoom: (pane, factor, around) => {
      const t = get().getActive()!;
      const ids = t.linkAll ? t.panes : [pane];

      let norm: { u: number; v: number } | null = null;
      if ("type" in around && around.type === "abs") {
        const { cx, cy, cw, ch } = around;
        norm = { u: cw ? cx / cw : 0.5, v: ch ? cy / ch : 0.5 };
      } else if ("type" in around && around.type === "norm") {
        norm = around;
      }

      ids.forEach((id) => {
        const v = t.view[id];
        const { cw, ch } = t.paneSize[id] || { cw: 1, ch: 1 };
        const iw = v.imgW ?? 1,
          ih = v.imgH ?? 1;

        const fit = Math.min(cw / iw, ch / ih);
        const w = iw * fit * v.scale;
        const h = ih * fit * v.scale;

        const newScale = Math.max(0.8, Math.min(10, v.scale * factor));
        const w2 = iw * fit * newScale;
        const h2 = ih * fit * newScale;

        const cx = norm ? norm.u * cw : cw / 2;
        const cy = norm ? norm.v * ch : ch / 2;

        const center = (CW: number, W: number) => (CW - W) / 2;
        const c1x = center(cw, w),
          c1y = center(ch, h);
        const c2x = center(cw, w2),
          c2y = center(ch, h2);

        // const newScale = Math.max(0.1, Math.min(8, v.scale * factor));
        // Giữ điểm (cx,cy) tương đối: dịch offset theo thay đổi scale
        const k = newScale / v.scale;
        const nx = k * v.offsetX + k * c1x - c2x + (1 - k) * cx;
        const ny = k * v.offsetY + k * c1y - c2y + (1 - k) * cy;

        get().setView(id, { scale: newScale, offsetX: nx, offsetY: ny });
        console.log("[store] applyZoom", id, {
          old: v.scale,
          new: newScale,
          cx,
          cy,
          cw,
          ch,
        });
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
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, grid: { ...t.grid, on: !t.grid.on } }
            : t
        ),
      });
    },

    setGridSize: (px) => {
      const { tabs, activeTabId } = get();
      console.log("[store] setGridSize", px);
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                grid: {
                  ...t.grid,
                  size: Math.max(4, Math.min(512, Math.round(px))),
                },
              }
            : t
        ),
      });
    },

    setGridOpacity: (v) => {
      const { tabs, activeTabId } = get();
      console.log("[store] setGridOpacity", v);
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                grid: { ...t.grid, opacity: Math.max(0, Math.min(1, v)) },
              }
            : t
        ),
      });
    },

    setExif: (pane, exif) => {
      console.log("[store] setExif", pane, exif);
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId ? { ...t, exif: { ...t.exif, [pane]: exif } } : t
        ),
      });
    },

    toggleDetails: (paneId: PaneId) =>
      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;

        const showDetails = { ...tab.showDetails };

        // nếu đang sync (linkAll = true) thì bật/tắt cho TẤT CẢ pane
        if (tab.linkAll) {
          const current = !!showDetails[paneId];
          const next = !current;
          for (const pid of tab.panes) {
            showDetails[pid] = next;
          }
        } else {
          // chưa sync thì chỉ toggle đúng pane được click / focus
          showDetails[paneId] = !showDetails[paneId];
        }

        const tabs = state.tabs.map((t) =>
          t.id === tab.id ? { ...t, showDetails } : t
        );

        return { ...state, tabs };
      }),

    // LOUPE && SYNC LOUPE
    toggleLoupe: () => {
      const { tabs, activeTabId, getActive } = get();
      const tab = getActive();
      const next = !tab?.loupe.on;
      console.log("[store] toggleLoupe ->", next);
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            loupe: { ...t.loupe, on: next, zoom: next ? 2 : t.loupe.zoom },
            annotate: { ...t.annotate, mode: next ? "none" : t.annotate.mode },
          };
        }),
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
        tabs: tabs.map((t) =>
          t.id === activeTabId ? { ...t, loupe: { ...t.loupe, size } } : t
        ),
      });
    },

    setPointerNorm: (pane, u, v) => {
      const { tabs, activeTabId } = get();
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const val = { u: clamp01(u), v: clamp(v) };
      set({
        tabs: tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, pointerNorm: { ...t.pointerNorm, [pane]: val } }
            : t
        ),
      });
    },

    setPointerNormAll: (u, v) => {
      const { tabs, activeTabId } = get();
      const clamp = (x: number) => Math.max(0, Math.min(1, x));
      const val = { u: clamp01(u), v: clamp(v) };
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          const pn = { ...t.pointerNorm };
          t.panes.forEach((id) => {
            pn[id] = val;
          });
          return { ...t, pointerNorm: pn };
        }),
      });
    },

    clearPane: (pane) => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          const files = { ...t.files, [pane]: undefined };
          const dataURL = { ...t.dataURL, [pane]: undefined };
          const names = { ...t.names, [pane]: undefined };
          const exif = t.exif ? { ...t.exif, [pane]: undefined } : t.exif;
          const view = {
            ...t.view,
            [pane]: { scale: 1, offsetX: 0, offsetY: 0 },
          };
          const panes = usedPanes(files, dataURL);
          const focusIndex = panes.length
            ? Math.min(t.focusIndex, panes.length - 1)
            : 0;
          const showDetails = { ...t.showDetails, [pane]: false };
          const strokes = { ...t.strokes, [pane]: [] };
          console.log("[store] clearPane", pane, "->", panes);
          return {
            ...t,
            files,
            dataURL,
            names,
            exif,
            view,
            panes,
            focusIndex,
            showDetails,
            strokes,
            annotate: t.annotate,
          };
        }),
      });
    },

    clearAllPanes: () => {
      const { tabs, activeTabId } = get();
      set({
        tabs: tabs.map((t) => {
          if (t.id !== activeTabId) return t;

          // reset toàn bộ slot A–D về rỗng
          const empty = {
            A: undefined,
            B: undefined,
            C: undefined,
            D: undefined,
          } as Record<PaneId, undefined>;
          const freshView = {
            A: { scale: 1, offsetX: 0, offsetY: 0 },
            B: { scale: 1, offsetX: 0, offsetY: 0 },
            C: { scale: 1, offsetX: 0, offsetY: 0 },
            D: { scale: 1, offsetX: 0, offsetY: 0 },
          } as Record<PaneId, View>;
          const showDetails = {
            A: false,
            B: false,
            C: false,
            D: false,
          } as Record<PaneId, boolean>;

          return {
            ...t,
            files: { ...empty },
            dataURL: { ...empty },
            names: { ...empty },
            exif: { ...empty },
            panes: [],
            focusIndex: 0,
            view: freshView,
            showDetails,
          };
        }),
      });
      try {
        (get() as any).saveLastSession?.();
      } catch (e) {
        void e;
      }
    },

    setFocusIndex: (i: number) =>
      set((state) => {
        const t = state.getActive?.() as any;
        if (!t) return state;
        const tabs = state.tabs.map((tab) =>
          tab.id === state.activeTabId ? { ...tab, focusIndex: i } : tab
        );
        return { ...state, tabs };
      }),

    getActiveSafe: () => {
      const s = get();
      return s.tabs.find((t) => t.id === s.activeTabId) ?? SAFE_EMPTY_TAB;
    },

    hasActive: () => {
      const s = get();
      return !!s.tabs.find((t) => t.id === s.activeTabId);
    },

    reorderTabs: (fromIndex: number, toIndex: number) => {
      const s = get();
      const n = s.tabs.length;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= n ||
        toIndex >= n
      )
        return;
      const tabs = s.tabs.slice();
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      set({ tabs });
    },
    addImageFromDataURL: (dataURL) =>
      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;

        const panes: PaneId[] = [...tab.panes];
        const files: Record<PaneId, string | undefined> = { ...tab.files };
        const dataURLMap: Record<PaneId, string | undefined> = {
          ...tab.dataURL,
        };

        // 1) pane đã tồn tại nhưng đang TRỐNG (không path, không dataURL)
        const emptyExisting: PaneId | undefined = panes.find(
          (pid) => !files[pid] && !dataURLMap[pid]
        );

        let targetPaneId: PaneId | undefined = emptyExisting;

        // 2) Nếu chưa có pane trống, thử tạo pane mới
        if (!targetPaneId) {
          const newId = state.nextEmptyPaneId?.() as PaneId | null;
          if (newId) {
            targetPaneId = newId;
            if (!panes.includes(newId)) {
              panes.push(newId);
            }
          } else {
            // 3) Full 4 rồi → đè pane đang focus
            const focused = (panes[tab.focusIndex] ??
              panes[0] ??
              "A") as PaneId;
            targetPaneId = focused;
          }
        }

        if (!targetPaneId) return state;

        // 4) Gán dataURL vào pane target
        //    Vì là ảnh clipboard, không có path → xoá path cũ
        delete files[targetPaneId];
        dataURLMap[targetPaneId] = dataURL;

        const newTab: TabState = {
          ...tab,
          panes,
          files,
          dataURL: dataURLMap,
          // reset EXIF chỉ cho pane được paste, các pane khác giữ nguyên
          exif: { ...tab.exif, [targetPaneId]: undefined },
        };

        const newTabs = state.tabs.map((t) => (t.id === tab.id ? newTab : t));

        return { ...state, tabs: newTabs };
      }),
    toggleDraw: () =>
      set((state) => {
        const t = state.getActiveSafe();
        const nextMode = t.annotate.mode === "draw" ? "none" : "draw";
        return {
          tabs: state.tabs.map((x) =>
            x.id !== state.activeTabId
              ? x
              : {
                  ...x,
                  loupe: { ...x.loupe, on: false },
                  annotate: { ...x.annotate, mode: nextMode },
                }
          ),
        };
      }),
    toggleErase: () =>
      set((state) => {
        const t = state.getActiveSafe();
        const nextMode = t.annotate.mode === "erase" ? "none" : "erase";
        return {
          tabs: state.tabs.map((x) =>
            x.id !== state.activeTabId
              ? x
              : {
                  ...x,
                  loupe: { ...x.loupe, on: false },
                  annotate: { ...x.annotate, mode: nextMode },
                }
          ),
        };
      }),
    setBrushColor: (hex) =>
      set((state) => ({
        tabs: state.tabs.map((x) =>
          x.id !== state.activeTabId
            ? x
            : {
                ...x,
                annotate: { ...x.annotate, color: hex },
              }
        ),
      })),
    setBrushSize: (px) =>
      set((state) => ({
        tabs: state.tabs.map((x) =>
          x.id !== state.activeTabId
            ? x
            : {
                ...x,
                annotate: { ...x.annotate, size: clamp(px, 1, 280) },
              }
        ),
      })),
    setEraserSize: (px) =>
      set((state) => ({
        tabs: state.tabs.map((x) =>
          x.id !== state.activeTabId
            ? x
            : {
                ...x,
                annotate: { ...x.annotate, eraserSize: clamp(px, 4, 640) },
              }
        ),
      })),

    startStroke: (panes, mode, p0) => {
      const id = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      set((state) => {
        const t = state.getActiveSafe();
        const size = mode === "erase" ? t.annotate.eraserSize : t.annotate.size;
        const color = t.annotate.color;

        return {
          tabs: state.tabs.map((tab) => {
            if (tab.id !== state.activeTabId) return tab;
            const nextStrokes = { ...tab.strokes };
            for (const pid of panes) {
              const arr = nextStrokes[pid] ? [...nextStrokes[pid]] : [];
              arr.push({ id, mode, color, size, pts: [p0] });
              nextStrokes[pid] = arr;
            }
            return { ...tab, strokes: nextStrokes };
          }),
        };
      });
      return id;
    },

    appendStrokePoint: (panes, strokeId, p) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;
          const nextStrokes = { ...tab.strokes };
          for (const pid of panes) {
            const arr = nextStrokes[pid];
            if (!arr || arr.length === 0) continue;
            const last = arr[arr.length - 1];
            if (last.id !== strokeId) continue;

            // clone nhẹ để tránh mutate
            const nextLast: Stroke = { ...last, pts: [...last.pts, p] };
            const nextArr = arr.slice(0, -1).concat(nextLast);
            nextStrokes[pid] = nextArr;
          }
          return { ...tab, strokes: nextStrokes };
        }),
      })),
  }))
);
