import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TopBar from "../../../src/components/TopBar.vue";
import { usePostsStore } from "../../../src/stores/posts";
import { useThemeStore } from "../../../src/stores/theme";
import { useUiStore } from "../../../src/stores/ui";

describe("TopBar", () => {
  it("挂载后应用主题并展示品牌信息", () => {
    const wrapper = mount(TopBar);

    expect(wrapper.find(".brand-name").text()).toBe("微光");
    expect(wrapper.find(".brand-slogan").text()).toBe("记录此刻，安静发光");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("system");
  });

  it("点击主题按钮循环切换并提示当前模式", async () => {
    const wrapper = mount(TopBar);
    const theme = useThemeStore();
    const ui = useUiStore();

    await wrapper.find(".theme-toggle").trigger("click");

    expect(theme.mode).toBe("light");
    expect(ui.toast).toBe("主题：浅色");
    expect(wrapper.find(".theme-toggle").attributes("data-mode")).toBe("light");
    expect(wrapper.find(".theme-toggle").attributes("aria-label")).toContain("浅色");
  });

  it("存储可用时展示「本地存储」", () => {
    const wrapper = mount(TopBar);
    const posts = usePostsStore();
    posts.storageAvailable = true;

    expect(wrapper.find(".storage-state").text()).toContain("本地存储");
    expect(wrapper.find(".storage-state").classes()).not.toContain("is-offline");
  });

  it("存储不可用时展示「仅本次会话」并标记离线", async () => {
    const wrapper = mount(TopBar);
    const posts = usePostsStore();
    posts.storageAvailable = false;
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".storage-state").text()).toContain("仅本次会话");
    expect(wrapper.find(".storage-state").classes()).toContain("is-offline");
    expect(wrapper.find(".storage-state").attributes("title")).toContain("刷新后内容会丢失");
  });
});
