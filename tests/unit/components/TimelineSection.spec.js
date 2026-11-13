import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TimelineSection from "../../../src/components/TimelineSection.vue";

const NOW = Date.now();

function makePost(id, content, overrides = {}) {
  return {
    id,
    author: "微光",
    content,
    createdAt: NOW - 60_000,
    likes: 0,
    likedByMe: false,
    editedAt: null,
    ...overrides,
  };
}

describe("TimelineSection", () => {
  it("空列表时展示空状态与 0 条", () => {
    const wrapper = mount(TimelineSection, { props: { posts: [] } });

    expect(wrapper.find(".post-total").text()).toBe("0 条");
    expect(wrapper.find(".empty-state").exists()).toBe(true);
    expect(wrapper.find(".empty-title").text()).toBe("还没有任何动态");
    expect(wrapper.find(".empty-desc").text()).toContain("Hono 服务");
    expect(wrapper.find(".timeline").attributes("hidden")).toBeDefined();
  });

  it("有内容时渲染卡片并隐藏空状态", () => {
    const wrapper = mount(TimelineSection, {
      props: { posts: [makePost("p1", "第一条"), makePost("p2", "第二条")] },
    });

    expect(wrapper.findAll(".post")).toHaveLength(2);
    expect(wrapper.find(".post-total").text()).toBe("2 条");
    expect(wrapper.find(".empty-state").exists()).toBe(false);
    expect(wrapper.find(".timeline").attributes("hidden")).toBeUndefined();
  });

  it("把卡片事件向上转发", async () => {
    const wrapper = mount(TimelineSection, {
      props: { posts: [makePost("p1", "第一条")] },
    });

    await wrapper.find(".like-btn").trigger("click");
    await wrapper.find(".edit-btn").trigger("click");

    expect(wrapper.emitted("like")?.[0]).toEqual(["p1"]);
    expect(wrapper.emitted("edit")?.[0]).toEqual(["p1"]);
  });

  it("把编辑态与高亮态传给对应卡片", () => {
    const wrapper = mount(TimelineSection, {
      props: { posts: [makePost("p1", "第一条"), makePost("p2", "第二条")], editingId: "p2", highlightId: "p1" },
    });

    const cards = wrapper.findAll(".post");
    expect(cards[0].classes()).toContain("is-new");
    expect(cards[1].classes()).toContain("is-editing");
  });
});
