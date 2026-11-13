import { beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { setStorageAdapter } from "../src/services/storage";
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

  document.body.innerHTML = "";
  document.body.className = "";
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.removeAttribute("style");

  window.matchMedia = createMatchMedia(false);
  vi.restoreAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

export { createMatchMedia };
