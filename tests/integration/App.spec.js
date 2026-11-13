import { describe, it, expect, afterEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import App from "../../src/App.vue";
import { getStorageAdapter, setStorageAdapter } from "../../src/services/storage";
import { createFailingWriteAdapter } from "../helpers/memoryStorage";

const POSTS_KEY = "moment.posts.v1";
const THEME_KEY = "moment.theme.v1";

let wrapper = null;

function mountApp() {
  wrapper = mount(App, { attachTo: document.body });
  return wrapper;
}

function readStoredPosts() {
  const raw = getStorageAdapter().read(POSTS_KEY);
  return raw ? JSON.parse(raw) : null;
}

afterEach(() => {
  if (wrapper) {
    wrapper.unmount();
    wrapper = null;
  }
});

describe("App / 发布到时间线", () => {
  it("发布后出现在时间线顶部并写入 localStorage", async () => {
    const app = mountApp();

    await app.find(".composer-input").setValue("第一条动态");
    await app.find(".btn-publish").trigger("click");
    await nextTick();

    expect(app.findAll(".post")).toHaveLength(1);
    expect(app.find(".post-content").text()).toBe("第一条动态");
    expect(app.find(".post-total").text()).toBe("1 条");
    expect(app.find(".empty-state").exists()).toBe(false);
    expect(app.find(".composer-input").element.value).toBe("");
    expect(readStoredPosts()).toHaveLength(1);
    expect(readStoredPosts()[0].content).toBe("第一条动态");
  });

  it("点击热搜话题会把话题填入发布框并提示", async () => {
    const app = mountApp();

    await app.findAll(".hot-link")[0].trigger("click");
    await nextTick();

    expect(app.find(".composer-input").element.value).toBe("#城市夜跑# ");
    expect(app.find(".toast").text()).toBe("已填入话题，补上你的想法吧");
  });
});

describe("App / 互动流程", () => {
  it("点赞、编辑、删除形成完整闭环", async () => {
    const app = mountApp();
    await app.find(".composer-input").setValue("原始内容");
    await app.find(".btn-publish").trigger("click");
    await nextTick();

    await app.find(".like-btn").trigger("click");
    await nextTick();
    expect(app.find(".like-count").text()).toBe("1");
    expect(app.find(".like-btn").attributes("aria-pressed")).toBe("true");
    expect(readStoredPosts()[0]).toMatchObject({ likes: 1, likedByMe: true });

    await app.find(".edit-btn").trigger("click");
    await nextTick();
    const editInput = app.find(".post-edit-input");
    expect(editInput.exists()).toBe(true);

    await editInput.setValue("改过的内容");
    await editInput.trigger("keydown", { key: "Enter", ctrlKey: true });
    await nextTick();

    expect(app.find(".post-content").text()).toBe("改过的内容");
    expect(app.find(".post-edited").exists()).toBe(true);
    expect(app.find(".toast").text()).toBe("已更新");
    expect(readStoredPosts()[0].content).toBe("改过的内容");

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await app.find(".delete-btn").trigger("click");
    await nextTick();

    expect(confirm).toHaveBeenCalled();
    expect(app.findAll(".post")).toHaveLength(0);
    expect(app.find(".empty-state").exists()).toBe(true);
    expect(app.find(".toast").text()).toBe("已删除");
    expect(readStoredPosts()).toEqual([]);
  });

  it("Esc 取消编辑不会改动内容", async () => {
    const app = mountApp();
    await app.find(".composer-input").setValue("保持原样");
    await app.find(".btn-publish").trigger("click");
    await nextTick();

    await app.find(".edit-btn").trigger("click");
    await nextTick();
    await app.find(".post-edit-input").setValue("不该保存的修改");
    await app.find(".post-edit-input").trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(app.find(".post-content").text()).toBe("保持原样");
    expect(app.find(".post-edited").exists()).toBe(false);
  });
});

describe("App / 本地持久化", () => {
  it("重新挂载后从 localStorage 恢复动态与昵称", async () => {
    const app = mountApp();
    await app.find(".nickname-input").setValue("小光");
    await app.find(".composer-input").setValue("会恢复的动态");
    await app.find(".btn-publish").trigger("click");
    await nextTick();

    app.unmount();
    wrapper = null;

    setActivePinia(createPinia());
    const remounted = mountApp();
    await nextTick();

    expect(remounted.find(".post-content").text()).toBe("会恢复的动态");
    expect(remounted.find(".post-author").text()).toBe("小光");
    expect(remounted.find(".nickname-input").element.value).toBe("小光");
  });

  it("存储不可用时展示降级提示，但会话内仍可发布", async () => {
    setStorageAdapter(createFailingWriteAdapter());

    const app = mountApp();
    await nextTick();

    expect(app.find(".storage-state").text()).toContain("仅本次会话");
    expect(app.find(".storage-state").classes()).toContain("is-offline");
    expect(app.find(".toast").text()).toBe("浏览器存储不可用，内容仅保留在本次会话");

    await app.find(".composer-input").setValue("仅本次会话");
    await app.find(".btn-publish").trigger("click");
    await nextTick();

    expect(app.findAll(".post")).toHaveLength(1);
  });
});

describe("App / 主题与阅读弹层", () => {
  it("切换主题后写入存储，重新挂载仍然生效", async () => {
    const app = mountApp();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    await app.find(".theme-toggle").trigger("click");
    await nextTick();

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
    expect(getStorageAdapter().read(THEME_KEY)).toBe("light");

    app.unmount();
    wrapper = null;

    setActivePinia(createPinia());
    mountApp();
    await nextTick();

    expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light");
  });

  it("打开推荐阅读后展示全文，关闭后焦点回到卡片", async () => {
    const app = mountApp();
    const card = app.findAll(".read-card")[0];
    card.element.focus();

    await card.trigger("click");
    await nextTick();

    expect(app.find(".read-dialog-title").text()).toBe("把一天折好，放进抽屉里");
    expect(app.findAll(".read-dialog-body p")).toHaveLength(3);
    expect(document.body.classList.contains("is-modal-open")).toBe(true);

    await app.find("#readDialogClose").trigger("click");
    await nextTick();

    expect(document.body.classList.contains("is-modal-open")).toBe(false);
    expect(document.activeElement).toBe(card.element);
  });

  it("点击广告位只给出提示，不跳转", async () => {
    const app = mountApp();

    await app.find(".ad-cta").trigger("click");
    await nextTick();

    expect(app.find(".toast").text()).toBe("这是示例广告位，暂不跳转");
  });
});
