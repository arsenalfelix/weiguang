import { describe, it, expect, vi } from "vitest";
import { useUiStore } from "../../../src/stores/ui";
import { findRead } from "../../../src/data/demo";

describe("ui store / toast", () => {
  it("显示提示并在 2 秒后自动隐藏", () => {
    vi.useFakeTimers();
    const store = useUiStore();

    store.showToast("已更新");
    expect(store.toast).toBe("已更新");
    expect(store.toastVisible).toBe(true);

    vi.advanceTimersByTime(1999);
    expect(store.toastVisible).toBe(true);

    vi.advanceTimersByTime(1);
    expect(store.toastVisible).toBe(false);
  });

  it("连续提示会重置计时并替换文案", () => {
    vi.useFakeTimers();
    const store = useUiStore();

    store.showToast("第一条");
    vi.advanceTimersByTime(1500);
    store.showToast("第二条");

    vi.advanceTimersByTime(1500);
    expect(store.toast).toBe("第二条");
    expect(store.toastVisible).toBe(true);

    vi.advanceTimersByTime(500);
    expect(store.toastVisible).toBe(false);
  });

  it("可手动隐藏提示", () => {
    const store = useUiStore();
    store.showToast("提示");
    store.hideToast();

    expect(store.toastVisible).toBe(false);
  });
});

describe("ui store / 阅读弹层", () => {
  it("打开时记录文章并锁定页面滚动", () => {
    const store = useUiStore();

    store.openRead("r1");

    expect(store.readId).toBe("r1");
    expect(store.readArticle).toEqual(findRead("r1"));
    expect(store.readDialogOpen).toBe(true);
  });

  it("关闭时清空当前文章并解锁滚动", () => {
    const store = useUiStore();
    store.openRead("r2");

    store.closeRead();

    expect(store.readId).toBeNull();
    expect(store.readArticle).toBeNull();
    expect(store.readDialogOpen).toBe(false);
  });

  it("未知文章 id 不会打开弹层", () => {
    const store = useUiStore();
    store.openRead("nope");

    expect(store.readId).toBeNull();
    expect(store.readDialogOpen).toBe(false);
  });
});
