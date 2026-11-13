import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ToastBar from "../../../src/components/ToastBar.vue";
import { useUiStore } from "../../../src/stores/ui";

describe("ToastBar", () => {
  it("默认不可见且无文案", () => {
    const wrapper = mount(ToastBar);

    expect(wrapper.find(".toast").text()).toBe("");
    expect(wrapper.find(".toast").classes()).not.toContain("is-visible");
    expect(wrapper.find(".toast").attributes("role")).toBe("status");
    expect(wrapper.find(".toast").attributes("aria-live")).toBe("polite");
  });

  it("store 显示提示时同步文案与可见态", async () => {
    const wrapper = mount(ToastBar);
    const ui = useUiStore();

    ui.showToast("已更新");
    await nextTick();

    expect(wrapper.find(".toast").text()).toBe("已更新");
    expect(wrapper.find(".toast").classes()).toContain("is-visible");
  });

  it("隐藏后移除可见态", async () => {
    const wrapper = mount(ToastBar);
    const ui = useUiStore();
    ui.showToast("已删除");
    await nextTick();

    ui.hideToast();
    await nextTick();

    expect(wrapper.find(".toast").classes()).not.toContain("is-visible");
  });
});
