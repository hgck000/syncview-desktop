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
export type StrokePt = { u: number; v: number };
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

export type TextStyle = {
  fontFamily:
    | "Arial"
    | "Times New Roman"
    | "Courier New"
    | "Verdana"
    | "Tahoma"
    | "Georgia";
  fontSizeImgPx: number; // cỡ chữ theo px “trên ảnh” (sẽ nhân total khi render)
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
};

export type QueueItem =
  | {
      kind: "file";
      path: string;
      name: string;
      // thứ tự trong folder gốc để export favourite theo đúng order
      originIndex: number;
      folder?: string;
    }
  | {
      kind: "dataURL";
      dataURL: string;
      name: string;
      originIndex?: number;
      folder?: string;
    };

export type TextBox = {
  id: number;
  u: number; // 0..1 theo ảnh
  v: number; // 0..1 theo ảnh
  w: number; // 0..1 theo ảnh
  h: number; // 0..1 theo ảnh
  text: string;
  committed: boolean; // commit xong thì không hiện viền
  style: TextStyle;
};

export type TextToolState = {
  on: boolean;
  style: TextStyle;
};

export type TextUIState = {
  selected: Record<PaneId, number | null>;
  editing: { pane: PaneId; id: number } | null;
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Arial",
  fontSizeImgPx: 28,
  color: "#ffffff",
  bold: false,
  italic: false,
  underline: false,
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
  textTool: { on: false, style: DEFAULT_TEXT_STYLE },
  textBoxes: { A: [], B: [], C: [], D: [] },
  textUI: {
    selected: { A: null, B: null, C: null, D: null },
    editing: null,
  },
  queue: [],
  favorites: [],
  rejected: [],
  sourceFolder: undefined,
};

type TabState = {
  id: string;
  name: string;
  layout: "auto" | "row1x4";
  linkAll: boolean;
  panes: PaneId[];
  focusIndex: number;
  files: Record<PaneId, string | undefined>;
  dataURL: Record<PaneId, string | undefined>;
  names: Record<PaneId, string | undefined>;
  view: Record<PaneId, View>;
  paneSize: Record<PaneId, PaneSize>;
  grid: GridState;
  exif: Record<PaneId, Exif | undefined>;
  showDetails: Record<PaneId, boolean>;
  loupe: LoupeState;
  pointerNorm: Record<PaneId, { u: number; v: number }>;
  sizes?: { sidebar?: number; leftSplit?: number };
  annotate: AnnotateState;
  strokes: Record<PaneId, Stroke[]>;
  textTool: TextToolState;
  textBoxes: Record<PaneId, TextBox[]>;
  textUI: TextUIState;
  queue: QueueItem[];
  favorites: QueueItem[];
  rejected: QueueItem[];
  sourceFolder?: string;
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
  toggleLayout: () => void;

  focusNext: () => void;
  focusPrev: () => void;

  nextEmptyPaneId: () => PaneId | null;

  setFileForPane: (pane: PaneId, path?: string, nameOverride?: string) => void;
  setDataURLForPane: (pane: PaneId, dataURL?: string, name?: string) => void;

  setImageMeta: (pane: PaneId, w: number, h: number) => void;
  setView: (pane: PaneId, patch: Partial<View>) => void;
  fitView: (pane: PaneId, cw: number, ch: number) => void;
  applyPan: (pane: PaneId, dx: number, dy: number) => void;

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
  setStrokeLineEnd: (panes: PaneId[], strokeId: string, p1: StrokePt) => void;
  hoveredPane: PaneId | null;
  setHoveredPane: (pane: PaneId | null) => void;

  exporting: boolean;
  setExporting: (v: boolean) => void;

  spaceDown: boolean;
  setSpaceDown: (v: boolean) => void;

  toggleText: () => void;
  setTextToolStyle: (patch: Partial<TextStyle>) => void;

  createTextBox: (
    panes: PaneId[],
    uiPane: PaneId,
    box: Omit<TextBox, "id">
  ) => number;
  setTextBoxText: (panes: PaneId[], id: number, text: string) => void;
  setTextBoxRect: (
    panes: PaneId[],
    id: number,
    patch: Partial<Pick<TextBox, "u" | "v" | "w" | "h">>
  ) => void;
  commitTextBox: (panes: PaneId[], id: number) => void;
  deleteTextBox: (panes: PaneId[], id: number) => void;

  selectTextBox: (pane: PaneId, id: number | null) => void;
  setEditingTextBox: (pane: PaneId | null, id: number | null) => void;
  setTextBoxStyle: (
    panes: PaneId[],
    id: number,
    patch: Partial<TextStyle>
  ) => void;
  clearTextUI: (pane?: PaneId) => void;
  patchTextBoxStyle: (
    panes: PaneId[],
    id: number,
    patch: Partial<TextStyle>
  ) => void;
  reorderPanes: (fromIndex: number, toIndex: number) => void;

  importFolder: (folder: string, paths: string[]) => void;
  rejectPane: (pane: PaneId) => void; // X
  favoritePane: (pane: PaneId) => void; // ★
  undoStack: any[];
  redoStack: any[];
  undo: () => void;
  redo: () => void;
  pushUndoPoint: (label?: string) => void;

  hydratePaneDataURL: (pane: PaneId) => Promise<void>;
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
    textTool: { on: false, style: DEFAULT_TEXT_STYLE },
    textBoxes: { A: [], B: [], C: [], D: [] },
    textUI: {
      selected: { A: null, B: null, C: null, D: null },
      editing: null,
    },
    queue: [],
    favorites: [],
    rejected: [],
    sourceFolder: undefined,
  };
}

function panesPreserveOrder(
  prevPanes: PaneId[],
  files: Record<PaneId, string | undefined>,
  dataURL: Record<PaneId, string | undefined>
): PaneId[] {
  const isUsed = (id: PaneId) => !!files[id] || !!dataURL[id];

  // 1) giữ lại thứ tự cũ, nhưng chỉ các pane còn ảnh
  const out: PaneId[] = [];
  for (const id of prevPanes) {
    if (isUsed(id) && !out.includes(id)) out.push(id);
  }

  // 2) append những pane “mới có ảnh” nhưng chưa nằm trong prev (trường hợp add ảnh mới)
  for (const id of ORDER) {
    if (isUsed(id) && !out.includes(id)) out.push(id);
  }

  return out.slice(0, 4);
}

function basename(p: string) {
  const s = p ?? "";
  return s.split(/[/\\]/).pop() || s;
}

function paneHasImage(t: TabState, pid: PaneId) {
  return !!t.files?.[pid] || !!t.dataURL?.[pid];
}

function getPaneItem(t: TabState, pid: PaneId): QueueItem | null {
  const fp = t.files?.[pid];
  const du = t.dataURL?.[pid];
  const nm = t.names?.[pid];

  if (fp) {
    return {
      kind: "file",
      path: fp,
      name: nm || basename(fp),
      originIndex: -1,
    };
  }
  if (du) {
    return {
      kind: "dataURL",
      dataURL: du,
      name: nm || "(pasted image)",
      originIndex: -1,
    };
  }
  return null;
}

function clearPaneData(t: TabState, pid: PaneId): TabState {
  // IMPORTANT: nếu bạn đã có logic clear strokes/textBoxes/exif/... ở clearPane cũ
  // thì bạn copy đúng các field đó vào đây để đảm bảo “xóa ảnh thì xóa luôn text/strokes”.
  const files = { ...t.files, [pid]: undefined };
  const dataURL = { ...t.dataURL, [pid]: undefined };
  const names = { ...t.names, [pid]: undefined };

  const exif = t.exif ? { ...t.exif, [pid]: undefined } : t.exif;
  const view = { ...t.view, [pid]: { scale: 1, offsetX: 0, offsetY: 0 } };
  const showDetails = { ...t.showDetails, [pid]: false };

  // nếu bạn đã có clear strokes/textBoxes thì giữ y như bản bạn đang dùng:
  const strokes = t.strokes ? { ...t.strokes, [pid]: [] } : t.strokes;
  const textBoxes = (t as any).textBoxes
    ? { ...(t as any).textBoxes, [pid]: [] }
    : (t as any).textBoxes;

  return {
    ...t,
    files,
    dataURL,
    names,
    exif,
    view,
    showDetails,
    strokes,
    ...(textBoxes ? { textBoxes } : {}),
  };
}

function assignItemToPane(t: TabState, pid: PaneId, it: QueueItem): TabState {
  if (it.kind === "file") {
    const files = { ...t.files, [pid]: it.path };
    const dataURL = { ...t.dataURL, [pid]: undefined };
    const names = { ...t.names, [pid]: it.name || basename(it.path) };
    return { ...t, files, dataURL, names };
  } else {
    const files = { ...t.files, [pid]: undefined };
    const dataURL = { ...t.dataURL, [pid]: it.dataURL };
    const names = { ...t.names, [pid]: it.name };
    return { ...t, files, dataURL, names };
  }
}

function fullPaneOrder(panes: PaneId[]): PaneId[] {
  const out = [...panes];
  for (const p of ORDER) if (!out.includes(p)) out.push(p);
  return out.slice(0, 4);
}

function compactAndFill(t0: TabState): TabState {
  let t = t0;
  const order = fullPaneOrder(t.panes);

  // nhớ ảnh đang focus (để cố giữ focus theo ảnh nếu còn)
  const focusPid = t.panes[t.focusIndex] ?? null;
  const focusKey =
    focusPid && t.files[focusPid]
      ? `file:${t.files[focusPid]}`
      : focusPid && t.dataURL[focusPid]
      ? `data:${t.dataURL[focusPid]}`
      : null;

  // gom các item đang có theo thứ tự panes hiện tại
  const currentItems: QueueItem[] = [];
  for (const pid of order) {
    const it = getPaneItem(t, pid);
    if (it) currentItems.push(it);
  }

  // clear hết 4 panes trước, rồi assign lại compact
  for (const pid of ORDER) t = clearPaneData(t, pid);

  // assign compact items
  let usedCount = 0;
  for (const it of currentItems) {
    const pid = order[usedCount];
    t = assignItemToPane(t, pid, it);
    usedCount++;
  }

  // fill từ queue
  const queue = [...t.queue];
  while (usedCount < 4 && queue.length > 0) {
    const next = queue.shift()!;
    const pid = order[usedCount];
    t = assignItemToPane(t, pid, next);
    usedCount++;
  }

  // panes list = những pane có ảnh (đúng thứ tự order)
  const panes: PaneId[] = [];
  for (let i = 0; i < usedCount; i++) panes.push(order[i]);

  // giữ focus theo “ảnh” nếu còn
  let focusIndex = 0;
  if (focusKey) {
    for (let i = 0; i < panes.length; i++) {
      const pid = panes[i];
      const k = t.files[pid]
        ? `file:${t.files[pid]}`
        : t.dataURL[pid]
        ? `data:${t.dataURL[pid]}`
        : null;
      if (k === focusKey) {
        focusIndex = i;
        break;
      }
    }
  }

  return { ...t, panes, focusIndex, queue };
}

function deepClone<T>(x: T): T {
  if (x === null || typeof x !== "object") return x;
  if (Array.isArray(x)) return x.map(deepClone) as any;
  const out: any = {};
  for (const k of Object.keys(x as any)) out[k] = deepClone((x as any)[k]);
  return out;
}

export const useApp = create<AppState>()(
  subscribeWithSelector((set, get) => ({
    tabs: [],
    activeTabId: "",
    sidebarSize: 24,
    helpOn: false,

    undoStack: [],
    redoStack: [],

    spaceDown: false,
    setSpaceDown: (v) => set({ spaceDown: v }),

    hoveredPane: null,
    setHoveredPane: (pane) => set({ hoveredPane: pane }),

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

    setActiveTab: (id) =>
      set((state) => ({ ...state, activeTabId: id, hoveredPane: null })),

    sidebarCollapsed: false,
    sidebarPeek: false,
    sidebarExpandedSize: 15,

    setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    setSidebarPeek: (v) => set({ sidebarPeek: v }),
    setSidebarExpandedSize: (v) =>
      set({ sidebarExpandedSize: Math.max(4, Math.min(20, v)) }),

    exporting: false,
    setExporting: (v) => set(() => ({ exporting: v })),

    hydratePaneDataURL: async (pane) => {
      const tab = get().getActiveSafe();
      if (!tab) return;

      const path = tab.files?.[pane];
      if (!path) return;

      // re-check latest (tránh stale)
      const latest = get().getActiveSafe();
      if (!latest || latest.dataURL?.[pane]) return;

      const api = (window as any).pywebview?.api;
      if (!api?.read_image_dataurl) return;

      try {
        const dataURL = await api.read_image_dataurl(path);
        if (!dataURL) return;

        // set vào đúng pane, nhưng tránh ghi đè nếu pane đã đổi ảnh
        set((state) => {
          const t = state.getActiveSafe();
          if (!t) return state;
          if (t.files?.[pane] !== path) return state;

          const dataURLMap = { ...t.dataURL, [pane]: dataURL };
          const nextTab = { ...t, dataURL: dataURLMap };
          return {
            ...state,
            tabs: state.tabs.map((x) => (x.id === t.id ? nextTab : x)),
          };
        });
      } catch (e) {
        console.warn("[hydratePaneDataURL] failed", e);
      }
    },

    renameTab: (id, title) =>
      set((state) => ({
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === id ? { ...t, name: title || t.name } : t
        ),
      })),

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
        const restTab = { ...t } as any;
        delete restTab.exif;

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
            const base: TabState = {
              ...SAFE_EMPTY_TAB,
              id: raw.id ?? `tab-${idx + 1}`,
              name: raw.name ?? `Tab ${idx + 1}`,
            };

            const layoutRaw = raw.layout;
            const layout =
              layoutRaw === "row1x4" || layoutRaw === "auto"
                ? layoutRaw
                : "auto";

            return {
              ...base,
              ...raw,
              layout,
              exif: {},
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

    toggleLayout: () => {
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        const nextLayout = tab.layout === "row1x4" ? "auto" : "row1x4";
        if (tab.layout === nextLayout) return state;

        const nextTabs = state.tabs.slice();
        nextTabs[idx] = { ...tab, layout: nextLayout };
        return { tabs: nextTabs };
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
          const panes = panesPreserveOrder(t.panes, files, dataURL);
          const showDetails = { ...t.showDetails, [pane]: false };
          // clamp focus
          const view = {
            ...t.view,
            [pane]: { scale: 1, offsetX: 0, offsetY: 0 },
          };
          const exif = t.exif ? { ...t.exif, [pane]: undefined } : t.exif;
          const strokes = { ...t.strokes, [pane]: [] };
          const prevFocused = t.panes[t.focusIndex] ?? null;
          let focusIndex = 0;
          if (panes.length) {
            const idx = prevFocused ? panes.indexOf(prevFocused) : -1;
            focusIndex =
              idx >= 0 ? idx : Math.min(t.focusIndex, panes.length - 1);
          }
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
          const panes = panesPreserveOrder(t.panes, files, dataURL);
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
            textTool: { ...t.textTool, on: false },
            textUI: {
              ...t.textUI,
              editing: null,
              selected: { A: null, B: null, C: null, D: null },
            },
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
          const panes = panesPreserveOrder(t.panes, files, dataURL);
          const prevFocused = t.panes[t.focusIndex] ?? null;
          let focusIndex = 0;
          if (panes.length) {
            const idx = prevFocused ? panes.indexOf(prevFocused) : -1;
            focusIndex =
              idx >= 0 ? idx : Math.min(t.focusIndex, panes.length - 1);
          }

          // const prevFocusedPane = t.panes[t.focusIndex] ?? null;

          const showDetails = { ...t.showDetails, [pane]: false };
          const strokes = { ...t.strokes, [pane]: [] };
          const textBoxes = { ...t.textBoxes, [pane]: [] };
          const clearedSelected = {
            A: null,
            B: null,
            C: null,
            D: null,
          } as Record<PaneId, null>;
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
            textBoxes,
            textUI: {
              ...t.textUI,
              selected: clearedSelected as any,
              editing: null,
            },
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
          const clearedSelected = {
            A: null,
            B: null,
            C: null,
            D: null,
          } as Record<PaneId, null>;

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
            strokes: { A: [], B: [], C: [], D: [] },
            textBoxes: { A: [], B: [], C: [], D: [] },
            textUI: {
              ...t.textUI,
              selected: clearedSelected as any,
              editing: null,
            },
            loupe: { ...t.loupe, on: false },
            annotate: { ...t.annotate, mode: "none" },
            textTool: { ...t.textTool, on: false },
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
                  textTool: { ...t.textTool, on: false },
                  textUI: {
                    ...t.textUI,
                    editing: null,
                    selected: { A: null, B: null, C: null, D: null },
                  },
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
                  textTool: { ...t.textTool, on: false },
                  textUI: {
                    ...t.textUI,
                    editing: null,
                    selected: { A: null, B: null, C: null, D: null },
                  },
                }
          ),
        };
      }),

    toggleText: () =>
      set((state) => {
        const t = state.getActiveSafe();
        const next = !t.textTool.on;

        const clearedSelected = {
          A: null,
          B: null,
          C: null,
          D: null,
        } as Record<PaneId, null>;

        return {
          tabs: state.tabs.map((x) =>
            x.id !== state.activeTabId
              ? x
              : {
                  ...x,
                  loupe: { ...x.loupe, on: false },
                  annotate: { ...x.annotate, mode: "none" },
                  textTool: { ...x.textTool, on: next },
                  textUI: next
                    ? x.textUI
                    : { ...x.textUI, editing: null, selected: clearedSelected },
                }
          ),
        };
      }),

    setTextToolStyle: (patch) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== s.activeTabId) return t;

          const next = { ...t.textTool.style, ...patch };

          const n = Number(next.fontSizeImgPx);
          next.fontSizeImgPx = Math.max(
            1,
            Math.min(300, Number.isFinite(n) ? n : 1)
          );

          return {
            ...t,
            textTool: { ...t.textTool, style: next },
          };
        }),
      }));
    },

    selectTextBox: (pane, id) =>
      set((state) => {
        const t = state.getActiveSafe();
        const cleared = { A: null, B: null, C: null, D: null } as Record<
          PaneId,
          null
        >;

        const nextSelected = t.linkAll
          ? ({ A: id, B: id, C: id, D: id } as Record<PaneId, number | null>)
          : ({ ...cleared, [pane]: id } as Record<PaneId, number | null>);

        return {
          tabs: state.tabs.map((x) =>
            x.id !== state.activeTabId
              ? x
              : { ...x, textUI: { ...x.textUI, selected: nextSelected } }
          ),
        };
      }),

    setEditingTextBox: (pane, id) =>
      set((state) => {
        const t = state.getActiveSafe();
        const nextEditing = pane && id != null ? { pane, id } : null;

        // khi edit thì auto select id đó (theo linkAll rules)
        const cleared = { A: null, B: null, C: null, D: null } as Record<
          PaneId,
          null
        >;
        const nextSelected =
          pane && id != null
            ? t.linkAll
              ? ({ A: id, B: id, C: id, D: id } as Record<
                  PaneId,
                  number | null
                >)
              : ({ ...cleared, [pane]: id } as Record<PaneId, number | null>)
            : (cleared as Record<PaneId, number | null>);

        return {
          tabs: state.tabs.map((x) =>
            x.id !== state.activeTabId
              ? x
              : {
                  ...x,
                  textUI: {
                    ...x.textUI,
                    editing: nextEditing,
                    selected: nextSelected,
                  },
                }
          ),
        };
      }),

    createTextBox: (panes, uiPane, box) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);

      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;

          const nextTextBoxes = { ...tab.textBoxes };
          for (const pid of panes) {
            const arr = nextTextBoxes[pid] ? [...nextTextBoxes[pid]] : [];
            arr.push({ ...box, id, style: { ...box.style } });
            nextTextBoxes[pid] = arr;
          }

          // auto editing on UI pane
          const cleared = { A: null, B: null, C: null, D: null } as Record<
            PaneId,
            null
          >;
          const selected = tab.linkAll
            ? ({ A: id, B: id, C: id, D: id } as Record<PaneId, number | null>)
            : ({ ...cleared, [uiPane]: id } as Record<PaneId, number | null>);

          return {
            ...tab,
            textBoxes: nextTextBoxes,
            textUI: { selected, editing: { pane: uiPane, id } },
          };
        }),
      }));

      return id;
    },

    setTextBoxText: (panes, id, text) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;
          const nextTextBoxes = { ...tab.textBoxes };

          for (const pid of panes) {
            const arr = nextTextBoxes[pid];
            if (!arr) continue;
            nextTextBoxes[pid] = arr.map((b) =>
              b.id === id ? { ...b, text } : b
            );
          }

          return { ...tab, textBoxes: nextTextBoxes };
        }),
      })),

    setTextBoxRect: (panes, id, patch) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;
          const nextTextBoxes = { ...tab.textBoxes };

          for (const pid of panes) {
            const arr = nextTextBoxes[pid];
            if (!arr) continue;
            nextTextBoxes[pid] = arr.map((b) =>
              b.id === id ? { ...b, ...patch } : b
            );
          }

          return { ...tab, textBoxes: nextTextBoxes };
        }),
      })),

    setTextBoxStyle: (panes, id, patch) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;

          const nextTextBoxes = { ...tab.textBoxes };

          for (const pid of panes) {
            const arr = nextTextBoxes[pid];
            if (!arr) continue;

            nextTextBoxes[pid] = arr.map((b) => {
              if (b.id !== id) return b;

              // --- auto-scale height when font size changes ---
              const prev = b.style?.fontSizeImgPx ?? 28;
              const next = patch.fontSizeImgPx ?? prev;

              const ratio = prev > 0 ? next / prev : 1;

              let nextH = b.h;
              if (patch.fontSizeImgPx != null) {
                // nở theo tỉ lệ font
                nextH = b.h * ratio;

                // clamp tối thiểu/tối đa
                nextH = Math.max(0.03, Math.min(1, nextH));

                // không vượt đáy ảnh
                nextH = Math.min(nextH, 1 - b.v);
              }

              return {
                ...b,
                h: nextH,
                style: { ...b.style, ...patch },
              };
            });
          }

          return { ...tab, textBoxes: nextTextBoxes };
        }),
      })),

    commitTextBox: (panes, id) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;

          const nextTextBoxes = { ...tab.textBoxes };
          let textValue = "";

          // lấy text ở uiPane nào đó (pane đầu tiên tìm thấy)
          for (const pid of panes) {
            const found = nextTextBoxes[pid]?.find((b) => b.id === id);
            if (found) {
              textValue = found.text ?? "";
              break;
            }
          }

          const trimmed = textValue.trim();
          for (const pid of panes) {
            const arr = nextTextBoxes[pid];
            if (!arr) continue;

            if (!trimmed) {
              nextTextBoxes[pid] = arr.filter((b) => b.id !== id);
            } else {
              nextTextBoxes[pid] = arr.map((b) =>
                b.id === id ? { ...b, committed: true } : b
              );
            }
          }

          const cleared = { A: null, B: null, C: null, D: null } as Record<
            PaneId,
            null
          >;
          return {
            ...tab,
            textBoxes: nextTextBoxes,
            textUI: { selected: cleared as any, editing: null },
          };
        }),
      })),

    deleteTextBox: (panes, id) =>
      set((state) => ({
        tabs: state.tabs.map((tab) => {
          if (tab.id !== state.activeTabId) return tab;
          const nextTextBoxes = { ...tab.textBoxes };
          for (const pid of panes) {
            const arr = nextTextBoxes[pid];
            if (!arr) continue;
            nextTextBoxes[pid] = arr.filter((b) => b.id !== id);
          }

          const cleared = { A: null, B: null, C: null, D: null } as Record<
            PaneId,
            null
          >;
          return {
            ...tab,
            textBoxes: nextTextBoxes,
            textUI: { ...tab.textUI, selected: cleared as any, editing: null },
          };
        }),
      })),

    setBrushColor: (hex) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        if (tab.annotate.color === hex) return state;

        const nextTabs = state.tabs.slice();
        nextTabs[idx] = { ...tab, annotate: { ...tab.annotate, color: hex } };
        return { tabs: nextTabs };
      }),

    setBrushSize: (px) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        const nextSize = clamp(px, 1, 280);
        if (tab.annotate.size === nextSize) return state;

        const nextTabs = state.tabs.slice();
        nextTabs[idx] = {
          ...tab,
          annotate: { ...tab.annotate, size: nextSize },
        };
        return { tabs: nextTabs };
      }),

    setEraserSize: (px) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        const nextSize = clamp(px, 4, 640);
        if (tab.annotate.eraserSize === nextSize) return state;

        const nextTabs = state.tabs.slice();
        nextTabs[idx] = {
          ...tab,
          annotate: { ...tab.annotate, eraserSize: nextSize },
        };
        return { tabs: nextTabs };
      }),

    startStroke: (panes, mode, p0) => {
      const id = `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        const size =
          mode === "erase" ? tab.annotate.eraserSize : tab.annotate.size;
        const color = tab.annotate.color;

        const nextStrokes = { ...tab.strokes };
        for (const pid of panes) {
          const arr = nextStrokes[pid] ? [...nextStrokes[pid]] : [];
          arr.push({ id, mode, color, size, pts: [p0] });
          nextStrokes[pid] = arr;
        }

        const nextTabs = state.tabs.slice();
        nextTabs[idx] = { ...tab, strokes: nextStrokes };
        return { tabs: nextTabs };
      });

      return id;
    },

    appendStrokePoint: (panes, strokeId, p) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        let changed = false;
        const nextStrokes = { ...tab.strokes };

        for (const pid of panes) {
          const arr = nextStrokes[pid];
          if (!arr || arr.length === 0) continue;
          const last = arr[arr.length - 1];
          if (last.id !== strokeId) continue;

          const nextLast: Stroke = { ...last, pts: [...last.pts, p] };
          nextStrokes[pid] = arr.slice(0, -1).concat(nextLast);
          changed = true;
        }

        if (!changed) return state;
        const nextTabs = state.tabs.slice();
        nextTabs[idx] = { ...tab, strokes: nextStrokes };
        return { tabs: nextTabs };
      }),

    clearTextUI: (pane?: PaneId) => {
      set((s) => {
        const t = s.getActiveSafe();
        const selected = { ...t.textUI.selected } as any;

        if (pane) selected[pane] = null;
        else {
          selected.A = null;
          selected.B = null;
          selected.C = null;
          selected.D = null;
        }

        return {
          tabs: s.tabs.map((x) =>
            x.id !== s.activeTabId
              ? x
              : { ...x, textUI: { ...x.textUI, selected, editing: null } }
          ),
        };
      });
    },

    patchTextBoxStyle: (panes, id, patch) => {
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== s.activeTabId) return t;

          const textBoxes = { ...t.textBoxes };

          for (const p of panes) {
            textBoxes[p] = (textBoxes[p] ?? []).map((b) => {
              if (b.id !== id) return b;

              const nextStyle = { ...b.style, ...patch };

              const n = Number(nextStyle.fontSizeImgPx);
              nextStyle.fontSizeImgPx = Math.max(
                1,
                Math.min(300, Number.isFinite(n) ? n : 1)
              );

              return { ...b, style: nextStyle };
            });
          }

          return { ...t, textBoxes };
        }),
      }));
    },

    setStrokeLineEnd: (panes, strokeId, p1) =>
      set((state) => {
        const idx = state.tabs.findIndex((t) => t.id === state.activeTabId);
        if (idx === -1) return state;

        const tab = state.tabs[idx];
        let changed = false;
        const nextStrokes = { ...tab.strokes };

        for (const pid of panes) {
          const arr = nextStrokes[pid];
          if (!arr || arr.length === 0) continue;
          const last = arr[arr.length - 1];
          if (last.id !== strokeId) continue;

          const p0 = last.pts[0];
          if (!p0) continue;

          const nextLast: Stroke = { ...last, pts: [p0, p1] };
          nextStrokes[pid] = arr.slice(0, -1).concat(nextLast);
          changed = true;
        }

        if (!changed) return state;
        const nextTabs = state.tabs.slice();
        nextTabs[idx] = { ...tab, strokes: nextStrokes };
        return { tabs: nextTabs };
      }),

    reorderPanes: (fromIndex, toIndex) =>
      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;

        const panes = [...tab.panes];
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= panes.length ||
          toIndex >= panes.length ||
          fromIndex === toIndex
        ) {
          return state;
        }

        const moved = panes.splice(fromIndex, 1)[0];
        panes.splice(toIndex, 0, moved);

        const prevFocusedPane = tab.panes[tab.focusIndex] ?? null;
        const focusIndex = panes.length
          ? Math.max(0, prevFocusedPane ? panes.indexOf(prevFocusedPane) : 0)
          : 0;

        const newTab: TabState = { ...tab, panes, focusIndex };
        const tabs = state.tabs.map((t) => (t.id === tab.id ? newTab : t));
        return { ...state, tabs };
      }),

    importFolder: (folder, paths) => {
      get().pushUndoPoint?.("importFolder");

      if (!folder || !paths || paths.length === 0) {
        alert("This folder has no supported images.");
        return;
      }

      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;

        // reset culling session
        let t: TabState = {
          ...tab,
          sourceFolder: folder,
          queue: [],
          favorites: [],
          rejected: [],
        };

        // clear panes
        for (const pid of ORDER) t = clearPaneData(t, pid);

        const items: QueueItem[] = paths.map((p, i) => ({
          kind: "file",
          path: p,
          name: basename(p),
          originIndex: i,
          folder,
        }));

        const order = fullPaneOrder(t.panes.length ? t.panes : ORDER);

        let used = 0;
        for (; used < 4 && used < items.length; used++) {
          t = assignItemToPane(t, order[used], items[used]);
        }

        t = {
          ...t,
          panes: order.slice(0, used),
          focusIndex: 0,
          queue: items.slice(used),
        };

        return {
          ...state,
          tabs: state.tabs.map((x) => (x.id === tab.id ? t : x)),
        };
      });
      queueMicrotask(() => {
        const st = get();
        for (const pid of ["A", "B", "C", "D"] as PaneId[]) {
          void st.hydratePaneDataURL(pid);
        }
      });
    },

    rejectPane: (pane) => {
      get().pushUndoPoint?.("rejectPane");
      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;
        if (!paneHasImage(tab, pane)) return state;

        const it = getPaneItem(tab, pane);
        if (!it) return state;

        let t: TabState = tab;
        // push vào rejected (stack)
        t = { ...t, rejected: [...t.rejected, it] };

        // clear pane rồi compact+fill
        t = clearPaneData(t, pane);
        t = compactAndFill(t);

        const tabs = state.tabs.map((x) => (x.id === tab.id ? t : x));
        return { ...state, tabs };
      });
    },

    favoritePane: (pane) => {
      get().pushUndoPoint?.("favoritePane");
      set((state) => {
        const tab = state.getActiveSafe();
        if (!tab) return state;
        if (!paneHasImage(tab, pane)) return state;

        const it = getPaneItem(tab, pane);
        if (!it) return state;

        let t: TabState = tab;
        t = { ...t, favorites: [...t.favorites, it] };

        t = clearPaneData(t, pane);
        t = compactAndFill(t);

        const tabs = state.tabs.map((x) => (x.id === tab.id ? t : x));
        return { ...state, tabs };
      });
    },

    pushUndoPoint: (_label) =>
      set((s) => {
        const snap = deepClone({
          tabs: s.tabs,
          activeTabId: s.activeTabId,
          sidebarSize: s.sidebarSize,
          sidebarCollapsed: s.sidebarCollapsed,
          sidebarPeek: s.sidebarPeek,
          sidebarExpandedSize: s.sidebarExpandedSize,
          helpOn: s.helpOn,
          keymap: s.keymap,
        });

        const undoStack = [...s.undoStack, snap].slice(-50);
        return { ...s, undoStack, redoStack: [] };
      }),

    undo: () =>
      set((s) => {
        if (!s.undoStack.length) return s;
        const prev = s.undoStack[s.undoStack.length - 1];
        const cur = deepClone({
          tabs: s.tabs,
          activeTabId: s.activeTabId,
          sidebarSize: s.sidebarSize,
          sidebarCollapsed: s.sidebarCollapsed,
          sidebarPeek: s.sidebarPeek,
          sidebarExpandedSize: s.sidebarExpandedSize,
          helpOn: s.helpOn,
          keymap: s.keymap,
        });
        const undoStack = s.undoStack.slice(0, -1);
        const redoStack = [...s.redoStack, cur].slice(-50);
        return { ...s, ...prev, undoStack, redoStack };
      }),

    redo: () =>
      set((s) => {
        if (!s.redoStack.length) return s;
        const next = s.redoStack[s.redoStack.length - 1];
        const cur = deepClone({
          tabs: s.tabs,
          activeTabId: s.activeTabId,
          sidebarSize: s.sidebarSize,
          sidebarCollapsed: s.sidebarCollapsed,
          sidebarPeek: s.sidebarPeek,
          sidebarExpandedSize: s.sidebarExpandedSize,
          helpOn: s.helpOn,
          keymap: s.keymap,
        });
        const redoStack = s.redoStack.slice(0, -1);
        const undoStack = [...s.undoStack, cur].slice(-50);
        return { ...s, ...next, undoStack, redoStack };
      }),
  }))
);
