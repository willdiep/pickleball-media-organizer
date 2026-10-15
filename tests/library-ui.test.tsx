import { mock, test } from "bun:test";
import { Window } from "happy-dom";

const dom = new Window({ url: "http://localhost:1420/" });
const browser = globalThis as typeof globalThis & {
  window: Window;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
browser.window = dom as unknown as Window & typeof globalThis.window;
browser.document = dom.document;
browser.navigator = dom.navigator as unknown as Navigator;
browser.HTMLElement = dom.HTMLElement as unknown as typeof HTMLElement;
browser.Element = dom.Element as unknown as typeof Element;
browser.Node = dom.Node as unknown as typeof Node;
browser.DocumentFragment = dom.DocumentFragment as unknown as typeof DocumentFragment;
browser.SVGElement = dom.SVGElement as unknown as typeof SVGElement;
browser.HTMLInputElement = dom.HTMLInputElement as unknown as typeof HTMLInputElement;
browser.HTMLButtonElement = dom.HTMLButtonElement as unknown as typeof HTMLButtonElement;
browser.HTMLSelectElement = dom.HTMLSelectElement as unknown as typeof HTMLSelectElement;
browser.MutationObserver = dom.MutationObserver as unknown as typeof MutationObserver;
browser.getComputedStyle = dom.getComputedStyle.bind(dom) as typeof getComputedStyle;
browser.requestAnimationFrame = ((callback: FrameRequestCallback) =>
  setTimeout(() => callback(Date.now()), 0)) as typeof requestAnimationFrame;
browser.cancelAnimationFrame = ((id: number) =>
  clearTimeout(id)) as typeof cancelAnimationFrame;
browser.Event = dom.Event as unknown as typeof Event;
browser.InputEvent = dom.InputEvent as unknown as typeof InputEvent;
browser.KeyboardEvent = dom.KeyboardEvent as unknown as typeof KeyboardEvent;
browser.MouseEvent = dom.MouseEvent as unknown as typeof MouseEvent;
browser.IS_REACT_ACT_ENVIRONMENT = true;

class FakeIntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0];
  constructor(_callback: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
browser.IntersectionObserver =
  FakeIntersectionObserver as unknown as typeof IntersectionObserver;

const library = {
  media: [
    {
      id: 1,
      uuid: "1",
      filename: "serve.png",
      filepath: "/games/morning/rally/serve.png",
      mediatype: "PHOTO",
      description: "Backhand winner",
      groupPath: "/games/morning/rally",
      category: "pickleball",
      rootId: 1,
      fileModifiedAt: "2024-01-01 00:00:00",
      fileMissing: false,
      previewPath: null,
      previewUnavailable: false,
      createdAt: "2010-01-01 00:00:00",
      updatedAt: "2010-01-01 00:00:00",
      tags: [{ id: 1, name: "drill" }],
    },
    {
      id: 2,
      uuid: "2",
      filename: "overhead.mp4",
      filepath: "/games/morning/rally/overhead.mp4",
      mediatype: "VIDEO",
      description: "Kitchen volley",
      groupPath: "/games/morning/rally",
      category: "pickleball",
      rootId: 1,
      fileModifiedAt: "2018-01-01 00:00:00",
      fileMissing: false,
      previewPath: null,
      previewUnavailable: false,
      createdAt: "2025-01-01 00:00:00",
      updatedAt: "2025-01-01 00:00:00",
      tags: [],
    },
    {
      id: 3,
      uuid: "3",
      filename: "dink.png",
      filepath: "/games/evening/rally/dink.png",
      mediatype: "PHOTO",
      description: null,
      groupPath: "/games/evening/rally",
      category: "pickleball",
      rootId: 1,
      fileModifiedAt: null,
      fileMissing: false,
      previewPath: null,
      previewUnavailable: false,
      createdAt: "2022-01-01 00:00:00",
      updatedAt: "2022-01-01 00:00:00",
      tags: [
        { id: 1, name: "drill" },
        { id: 2, name: "match" },
      ],
    },
    {
      id: 4,
      uuid: "4",
      filename: "warmup.png",
      filepath: "/library/warmup.png",
      mediatype: "PHOTO",
      description: "Warmup stretch",
      groupPath: null,
      category: "pickleball",
      rootId: 1,
      fileModifiedAt: null,
      fileMissing: false,
      previewPath: null,
      previewUnavailable: false,
      createdAt: "2021-06-01 00:00:00",
      updatedAt: "2021-06-01 00:00:00",
      tags: [{ id: 2, name: "match" }],
    },
  ],
  tags: [
    { id: 1, name: "drill" },
    { id: 2, name: "match" },
  ],
  roots: [],
};

mock.module("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => path,
  invoke: async (command: string) => {
    if (command === "list_media") return library;
    throw new Error(`unexpected command ${command}`);
  },
}));
mock.module("@tauri-apps/api/event", () => ({
  listen: async () => () => {},
}));
mock.module("@tauri-apps/plugin-dialog", () => ({
  open: async () => null,
}));
mock.module("video.js", () => ({ default: () => null }));
mock.module("video.js/dist/video-js.css", () => ({}));
mock.module("videojs-hotkeys", () => ({}));

const { createElement, act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { default: App } = await import("../src/App.tsx");

function text(selector: string): string[] {
  return [...document.querySelectorAll(selector)].map((node) =>
    (node.textContent ?? "").replace(/\s+/g, " ").trim()
  );
}

function titles(): string[] {
  return text("[data-testid='gallery-card-title']");
}

function descriptions(): string[] {
  return text("[data-testid='gallery-card-description']");
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  const tracker = (
    element as HTMLInputElement & { _valueTracker?: { setValue: (next: string) => void } }
  )._valueTracker;
  tracker?.setValue(value === "" ? "x" : "");
  element.dispatchEvent(new dom.InputEvent("input", { bubbles: true, data: value }));
  element.dispatchEvent(new dom.Event("change", { bubbles: true }));
}

test("search, type, tag, and sort narrow the rendered library", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(createElement(App));
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  if (!titles().includes("rally (morning)") || !titles().includes("rally (evening)")) {
    throw new Error(`expected distinct rally titles, got ${titles().join(" | ")}`);
  }
  if (!descriptions().includes("Kitchen volley and 1 more")) {
    throw new Error(`expected mixed group description, got ${descriptions().join(" | ")}`);
  }
  if (!descriptions().includes("Warmup stretch")) {
    throw new Error(`expected single description, got ${descriptions().join(" | ")}`);
  }
  const allMedia = [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("Pickleball")
  );
  if (!allMedia?.textContent?.includes("4")) {
    throw new Error(`sidebar count changed before filtering: ${allMedia?.textContent}`);
  }

  const search = document.getElementById("library-search") as HTMLInputElement;
  if (search.getAttribute("placeholder") !== "Search files, tags, descriptions") {
    throw new Error("search placeholder is missing");
  }
  await act(async () => {
    setValue(search, "serve");
  });
  await settle();
  if (titles().join("|") !== "rally") {
    throw new Error(`filename search should leave one rally card, got ${titles().join(" | ")}`);
  }
  if (!descriptions().includes("Backhand winner")) {
    throw new Error("the one matching clip should keep its description");
  }

  await act(async () => {
    search.focus();
    search.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
  if ((document.getElementById("library-search") as HTMLInputElement).value !== "") {
    throw new Error("Escape did not clear the search");
  }
  if (!titles().includes("rally (morning)")) {
    throw new Error("clearing search should restore both rally folders");
  }

  const photos = [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Photos"
  );
  if (!photos) throw new Error("Photos control is missing");
  await act(async () => {
    photos.click();
  });
  await settle();
  if (titles().some((title) => title === "overhead.mp4") || descriptions().includes("Kitchen volley and 1 more")) {
    throw new Error(`photos filter still shows the video, titles ${titles().join(" | ")}`);
  }
  if (!titles().includes("warmup.png") || !titles().includes("rally (evening)")) {
    throw new Error(`photos filter dropped photo cards: ${titles().join(" | ")}`);
  }

  const videos = [...document.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Videos"
  );
  if (!videos) throw new Error("Videos control is missing");
  await act(async () => {
    videos.click();
  });
  await settle();
  if (titles().join("|") !== "rally") {
    throw new Error(`videos filter should leave the morning rally, got ${titles().join(" | ")}`);
  }

  const allType = [...document.querySelectorAll("button")].find(
    (button) => button.getAttribute("aria-pressed") !== null && button.textContent?.trim() === "All"
  );
  if (!allType) throw new Error("All type control is missing");
  await act(async () => {
    allType.click();
  });
  await settle();

  const drill = [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.includes("drill")
  );
  if (!drill) throw new Error("drill tag is missing");
  await act(async () => {
    drill.click();
  });
  await settle();
  const drillTitles = titles();
  if (!drillTitles.includes("rally (morning)") || !drillTitles.includes("rally (evening)")) {
    throw new Error(`tag filter titles: ${drillTitles.join(" | ")}`);
  }
  if (drillTitles.includes("warmup.png")) {
    throw new Error("untagged-for-drill warmup stayed in the grid");
  }
  if (!allMedia.textContent?.includes("4")) {
    throw new Error("sidebar all-media count should stay the unfiltered total");
  }

  await act(async () => {
    setValue(document.getElementById("library-search") as HTMLInputElement, "backhand");
  });
  await settle();
  if (titles().join("|") !== "rally") {
    throw new Error(`tag plus description search failed: ${titles().join(" | ")}`);
  }

  await act(async () => {
    videos.click();
  });
  await settle();
  if (!document.querySelector("[data-testid='no-matches']")) {
    throw new Error("combined filters that match nothing should show No matches");
  }
  if (document.body.textContent?.includes("No highlights yet")) {
    throw new Error("a failed search should not show the empty-library card");
  }
  if (titles().length !== 0) {
    throw new Error(`no-match grid should be empty, got ${titles().join(" | ")}`);
  }

  const searchAgain = document.getElementById("library-search") as HTMLInputElement;
  await act(async () => {
    searchAgain.focus();
    searchAgain.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
  await act(async () => {
    allType.click();
    allMedia.click();
  });
  await settle();

  const sort = document.getElementById("library-sort") as HTMLSelectElement;
  await act(async () => {
    setValue(sort, "name-asc");
  });
  await settle();
  const sorted = titles();
  const ordered = [...sorted].sort((a, b) => a.localeCompare(b));
  if (sorted.join("|") !== ordered.join("|")) {
    throw new Error(`name sort is not ascending: ${sorted.join(" | ")}`);
  }

  await act(async () => {
    setValue(sort, "oldest");
  });
  await settle();
  if (titles()[0] !== "warmup.png") {
    throw new Error(`oldest should start with the 2021 import, got ${titles().join(" | ")}`);
  }

  await act(async () => {
    root.unmount();
  });
});
