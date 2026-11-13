import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PostCard from "../../../src/components/PostCard.vue";

const NOW = Date.now();

function makePost(overrides = {}) {
  return {
    id: "p1",
    author: "微光",
    content: "今天也很好",
    createdAt: NOW - 30 * 1000,
    likes: 2,
    likedByMe: false,
    bookmarks: 0,
    bookmarkedByMe: false,
    editedAt: null,
    ...overrides,
  };
}

function mountCard(post = makePost(), props = {}) {
  return mount(PostCard, { props: { post, ...props } });
}

describe("PostCard / 展示", () => {
  it("渲染作者、正文、相对时间与点赞数", () => {
    const wrapper = mountCard();

    expect(wrapper.find(".post-author").text()).toBe("微光");
    expect(wrapper.find(".post-content").text()).toBe("今天也很好");
    expect(wrapper.find(".post-time").text()).toBe("刚刚");
    expect(wrapper.find(".like-count").text()).toBe("2");
    expect(wrapper.find(".post-avatar").text()).toBe("微");
  });

  it("绝对时间写入 title 与 datetime", () => {
    const wrapper = mountCard();
    const time = wrapper.find(".post-time");

    expect(time.attributes("datetime")).toBe(new Date(NOW - 30 * 1000).toISOString());
    expect(time.attributes("title")).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("已点赞时高亮并更新无障碍属性", () => {
    const wrapper = mountCard(makePost({ likedByMe: true, likes: 3 }));
    const button = wrapper.find(".like-btn");

    expect(button.classes()).toContain("is-liked");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(button.attributes("aria-label")).toBe("取消点赞，3 个赞");
  });

  it("渲染收藏数，未收藏时不高亮", () => {
    const wrapper = mountCard(makePost({ bookmarks: 4 }));
    const button = wrapper.find(".bookmark-btn");

    expect(wrapper.find(".bookmark-count").text()).toBe("4");
    expect(button.classes()).not.toContain("is-bookmarked");
    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.attributes("aria-label")).toBe("收藏，4 个收藏");
  });

  it("已收藏时高亮并更新无障碍属性", () => {
    const wrapper = mountCard(makePost({ bookmarkedByMe: true, bookmarks: 1 }));
    const button = wrapper.find(".bookmark-btn");

    expect(button.classes()).toContain("is-bookmarked");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(button.attributes("aria-label")).toBe("取消收藏，1 个收藏");
  });

  it("旧数据缺少收藏字段时按 0 展示", () => {
    const legacy = makePost();
    delete legacy.bookmarks;
    delete legacy.bookmarkedByMe;

    expect(mountCard(legacy).find(".bookmark-count").text()).toBe("0");
  });

  it("编辑过的动态显示「已编辑」标记", () => {
    const wrapper = mountCard(makePost({ editedAt: NOW - 1000 }));

    expect(wrapper.find(".post-edited").text()).toBe("已编辑");
    expect(wrapper.find(".post-edited").attributes("title")).toContain("最后修改于");
  });

  it("未编辑时不显示「已编辑」", () => {
    expect(mountCard().find(".post-edited").exists()).toBe(false);
  });
});

describe("PostCard / 交互", () => {
  it("点击点赞抛出 like 事件", async () => {
    const wrapper = mountCard();

    await wrapper.find(".like-btn").trigger("click");

    expect(wrapper.emitted("like")?.[0]).toEqual(["p1"]);
  });

  it("点击收藏抛出 bookmark 事件", async () => {
    const wrapper = mountCard();

    await wrapper.find(".bookmark-btn").trigger("click");

    expect(wrapper.emitted("bookmark")?.[0]).toEqual(["p1"]);
    expect(wrapper.emitted("like")).toBeUndefined();
  });

  it("点击编辑抛出 edit 事件", async () => {
    const wrapper = mountCard();

    await wrapper.find(".edit-btn").trigger("click");

    expect(wrapper.emitted("edit")?.[0]).toEqual(["p1"]);
  });

  it("删除需要二次确认，确认后抛出 delete", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const wrapper = mountCard();

    await wrapper.find(".delete-btn").trigger("click");

    expect(confirm).toHaveBeenCalled();
    expect(wrapper.emitted("delete")?.[0]).toEqual(["p1"]);
  });

  it("取消确认时不删除", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const wrapper = mountCard();

    await wrapper.find(".delete-btn").trigger("click");

    expect(wrapper.emitted("delete")).toBeUndefined();
  });
});

describe("PostCard / 就地编辑", () => {
  it("进入编辑态时渲染输入框与剩余字数", () => {
    const wrapper = mountCard(makePost(), { editing: true });
    const input = wrapper.find(".post-edit-input");

    expect(wrapper.classes()).toContain("is-editing");
    expect(input.element.value).toBe("今天也很好");
    expect(wrapper.find(".post-edit-counter").text()).toBe("275");
  });

  it("Esc 取消编辑", async () => {
    const wrapper = mountCard(makePost(), { editing: true });

    await wrapper.find(".post-edit-input").trigger("keydown", { key: "Escape" });

    expect(wrapper.emitted("cancel")?.[0]).toEqual(["p1"]);
  });

  it("Ctrl + Enter 保存修改后的内容", async () => {
    const wrapper = mountCard(makePost(), { editing: true });
    const input = wrapper.find(".post-edit-input");
    await input.setValue("  改过的内容  ");

    await input.trigger("keydown", { key: "Enter", ctrlKey: true });

    expect(wrapper.emitted("save")?.[0]).toEqual([{ id: "p1", content: "改过的内容" }]);
  });

  it("内容为空时拒绝保存", async () => {
    const wrapper = mountCard(makePost(), { editing: true });
    const input = wrapper.find(".post-edit-input");
    await input.setValue("   ");

    await input.trigger("keydown", { key: "Enter", ctrlKey: true });
    await wrapper.find(".btn-save").trigger("click");

    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("取消与保存按钮分别抛出事件", async () => {
    const wrapper = mountCard(makePost(), { editing: true });

    await wrapper.find(".btn-save").trigger("click");
    await wrapper.find(".btn-cancel").trigger("click");

    expect(wrapper.emitted("save")?.[0]).toEqual([{ id: "p1", content: "今天也很好" }]);
    expect(wrapper.emitted("cancel")?.[0]).toEqual(["p1"]);
  });

  it("编辑输入时实时更新计数", async () => {
    const wrapper = mountCard(makePost(), { editing: true });
    await wrapper.find(".post-edit-input").setValue("a".repeat(270));

    expect(wrapper.find(".post-edit-counter").text()).toBe("10");
  });
});
