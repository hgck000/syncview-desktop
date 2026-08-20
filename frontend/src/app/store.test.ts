import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  invalidateImageSource: vi.fn(),
  prewarmImageSource: vi.fn<
    (path?: string, dataURL?: string) => Promise<boolean>
  >(),
}));

vi.mock("./bridge", () => bridgeMocks);

import { useApp } from "./store";
import { MAX_VIEW_SCALE } from "./viewLimits";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

function addTab(name: string, paths: string[] = []) {
  useApp.getState().newTab(name);
  const tabId = useApp.getState().activeTabId;
  const panes = ["A", "B", "C", "D"] as const;
  paths.forEach((path, index) => {
    useApp.getState().setFileForPane(panes[index], path);
  });
  return tabId;
}

describe("tab preparation", () => {
  beforeEach(() => {
    bridgeMocks.invalidateImageSource.mockReset();
    bridgeMocks.prewarmImageSource.mockReset();
    useApp.setState({ tabs: [], activeTabId: "" });
  });

  it("creates tabs in 1x4 mode and toggles to 2x2", () => {
    addTab("Layout");

    expect(useApp.getState().getActiveSafe().layout).toBe("row1x4");
    useApp.getState().toggleLayout();
    expect(useApp.getState().getActiveSafe().layout).toBe("auto");
  });

  it("caps image zoom at 1500%", () => {
    addTab("Zoom", ["zoom-limit.jpg"]);
    useApp.getState().setPaneSize("A", 1200, 800);
    useApp.getState().setImageMeta("A", 4000, 3000);

    useApp.getState().applyZoom("A", 100, {
      type: "norm",
      u: 0.5,
      v: 0.5,
    });

    expect(useApp.getState().getActiveSafe().view.A.scale).toBe(
      MAX_VIEW_SCALE,
    );
    expect(MAX_VIEW_SCALE).toBe(15);
  });

  it("keeps shape notes synchronized and mutually exclusive with drawing", () => {
    addTab("Shapes", ["shape-a.jpg", "shape-b.jpg"]);
    useApp.getState().toggleLinkAll();
    useApp.getState().toggleShape();

    const id = useApp.getState().createShape(["A", "B"], "A", {
      kind: "rectangle",
      color: "#ff3b30",
      strokeWidthImgPx: 8,
      u: 0.1,
      v: 0.2,
      w: 0.3,
      h: 0.25,
      flipX: false,
      flipY: false,
    });

    let tab = useApp.getState().getActiveSafe();
    expect(tab.shapes.A[0]?.id).toBe(id);
    expect(tab.shapes.B[0]?.id).toBe(id);
    expect(tab.shapeUI.selected.A).toBe(id);
    expect(tab.shapeUI.selected.B).toBe(id);
    expect(useApp.getState().serialize().tabs[0].shapes.A[0].id).toBe(id);

    useApp.getState().setShapeRect(["A", "B"], id, { u: 0.4, v: 0.5 });
    useApp
      .getState()
      .setShapeStyle(["A", "B"], id, { kind: "arrow", strokeWidthImgPx: 12 });

    tab = useApp.getState().getActiveSafe();
    expect(tab.shapes.A[0]).toMatchObject({
      u: 0.4,
      v: 0.5,
      kind: "arrow",
      strokeWidthImgPx: 12,
    });
    expect(tab.shapes.B[0]).toMatchObject({
      u: 0.4,
      v: 0.5,
      kind: "arrow",
      strokeWidthImgPx: 12,
    });

    useApp.getState().toggleDraw();
    tab = useApp.getState().getActiveSafe();
    expect(tab.annotate.mode).toBe("draw");
    expect(tab.shapeTool.on).toBe(false);
    expect(tab.shapeUI.selected.A).toBeNull();

    useApp.getState().deleteShape(["A", "B"], id);
    tab = useApp.getState().getActiveSafe();
    expect(tab.shapes.A).toHaveLength(0);
    expect(tab.shapes.B).toHaveLength(0);
  });

  it("loads sessions created before shape notes existed", () => {
    addTab("Legacy", ["legacy.jpg"]);
    const saved = useApp.getState().serialize();
    for (const tab of saved.tabs) {
      delete tab.shapeTool;
      delete tab.shapes;
      delete tab.shapeUI;
    }

    useApp.setState({ tabs: [], activeTabId: "" });
    useApp.getState().loadFromSession(saved);

    const tab = useApp.getState().getActiveSafe();
    expect(tab.shapeTool).toMatchObject({
      on: false,
      kind: "rectangle",
      color: "#ffffff",
      strokeWidthImgPx: 8,
    });
    expect(tab.shapes).toEqual({ A: [], B: [], C: [], D: [] });
    expect(tab.shapeUI.selected).toEqual({
      A: null,
      B: null,
      C: null,
      D: null,
    });
  });

  it("waits for every target image before changing the active tab", async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    bridgeMocks.prewarmImageSource.mockImplementation((path) => {
      if (path === "target-a.jpg") return first.promise;
      if (path === "target-b.jpg") return second.promise;
      return Promise.resolve(true);
    });

    const targetId = addTab("Target", [
      "target-a.jpg",
      "target-b.jpg",
    ]);
    const currentId = addTab("Current");

    useApp.getState().setActiveTab(targetId);
    expect(useApp.getState().activeTabId).toBe(currentId);

    first.resolve(true);
    await flushPromises();
    expect(useApp.getState().activeTabId).toBe(currentId);

    second.resolve(true);
    await flushPromises();
    expect(useApp.getState().activeTabId).toBe(targetId);
  });

  it("lets the newest tab request win when clicks overlap", async () => {
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    bridgeMocks.prewarmImageSource.mockImplementation((path) => {
      if (path === "first.jpg") return first.promise;
      if (path === "second.jpg") return second.promise;
      return Promise.resolve(true);
    });

    const firstId = addTab("First", ["first.jpg"]);
    const secondId = addTab("Second", ["second.jpg"]);
    const currentId = addTab("Current");

    useApp.getState().setActiveTab(firstId);
    useApp.getState().setActiveTab(secondId);

    first.resolve(true);
    await flushPromises();
    expect(useApp.getState().activeTabId).toBe(currentId);

    second.resolve(true);
    await flushPromises();
    expect(useApp.getState().activeTabId).toBe(secondId);
  });

  it("does not block a tab when an image settles as failed", async () => {
    bridgeMocks.prewarmImageSource.mockResolvedValue(false);

    const targetId = addTab("Broken", ["broken.heic"]);
    addTab("Current");

    useApp.getState().setActiveTab(targetId);
    await flushPromises();

    expect(useApp.getState().activeTabId).toBe(targetId);
  });
});
