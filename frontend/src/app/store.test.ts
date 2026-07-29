import { beforeEach, describe, expect, it, vi } from "vitest";

const bridgeMocks = vi.hoisted(() => ({
  invalidateImageSource: vi.fn(),
  prewarmImageSource: vi.fn<
    (path?: string, dataURL?: string) => Promise<boolean>
  >(),
}));

vi.mock("./bridge", () => bridgeMocks);

import { useApp } from "./store";

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
