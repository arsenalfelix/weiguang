import { beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { setStorageAdapter } from "../src/services/storage";
import { createApiClient, setApiClient } from "../src/services/api";
import { createMemoryStorageAdapter } from "./helpers/memoryStorage";

function createMatchMedia(matches = false) {
  return vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  setStorageAdapter(createMemoryStorageAdapter());
  // 重置为默认 api client：未显式注入的用例不会沿用上一个用例的后端
  setApiClient(createApiClient());

  // 服务端用例跑在 node 环境：没有 DOM，跳过浏览器侧重置
  if (typeof document !== "undefined") {
    document.body.innerHTML = "";
    document.body.className = "";
    document.body.removeAttribute("style");
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("style");
  }

  if (typeof window !== "undefined") {
    window.matchMedia = createMatchMedia(false);
  }

  vi.restoreAllMocks();

  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export { createMatchMedia };
