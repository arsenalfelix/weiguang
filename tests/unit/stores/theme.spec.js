import { describe, it, expect, vi } from "vitest";
import { useThemeStore } from "../../../src/stores/theme";
import { getStorageAdapter } from "../../../src/services/storage";

const THEME_KEY = "moment.theme.v1";

function stubMedia({ matches = false } = {}) {
  const listeners = new Set();
  const media = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((event, handler) => {
      if (event === "change") listeners.add(handler);
    }),
    removeEventListener: vi.fn((event, handler) => {
      if (event === "change") listeners.delete(handler);
    }),
    emit(nextMatches) {
      media.matches = nextMatches;
      listeners.forEach((handler) => handler({ matches: nextMatches }));
    },
  };
  window.matchMedia = vi.fn(() => media);
  return media;
}

describe("theme store / 模式切换", () => {
  it("默认跟随系统：系统为浅色时解析为 light", () => {
    stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();

    expect(store.mode).toBe("system");
    expect(store.resolved).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("system");
  });

  it("系统为深色时解析为 dark", () => {
    stubMedia({ matches: true });

    const store = useThemeStore();
    store.init();

    expect(store.resolved).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("显式切换后写入 DOM 属性与 localStorage", () => {
    stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();
    store.setMode("dark");

    expect(store.mode).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("dark");
    expect(getStorageAdapter().read(THEME_KEY)).toBe("dark");
  });

  it("按 system → light → dark → system 循环", () => {
    stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();

    expect(store.cycle()).toBe("light");
    expect(store.cycle()).toBe("dark");
    expect(store.cycle()).toBe("system");
  });

  it("非法模式回退为 system", () => {
    stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();
    store.setMode("rainbow");

    expect(store.mode).toBe("system");
  });

  it("初始化时读取已保存的主题", () => {
    stubMedia({ matches: false });
    getStorageAdapter().write(THEME_KEY, "dark");

    const store = useThemeStore();
    store.init();

    expect(store.mode).toBe("dark");
    expect(store.resolved).toBe("dark");
  });
});

describe("theme store / 系统主题联动", () => {
  it("跟随系统时响应系统配色变化", () => {
    const media = stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();
    expect(media.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));

    media.emit(true);
    expect(store.resolved).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("显式模式下忽略系统配色变化", () => {
    const media = stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();
    store.setMode("light");

    media.emit(true);
    expect(store.resolved).toBe("light");
  });

  it("销毁时移除监听", () => {
    const media = stubMedia({ matches: false });

    const store = useThemeStore();
    store.init();
    store.destroy();

    expect(media.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });
});

describe("theme store / meta 主题色", () => {
  it("同步顶栏 theme-color", () => {
    stubMedia({ matches: false });
    const meta = document.createElement("meta");
    meta.id = "themeColor";
    meta.setAttribute("content", "#f7f8fc");
    document.head.appendChild(meta);

    const store = useThemeStore();
    store.init();
    store.setMode("dark");

    expect(meta.getAttribute("content")).toBe("#0d0f14");
  });
});
