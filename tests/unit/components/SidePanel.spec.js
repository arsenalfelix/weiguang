import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SidePanel from "../../../src/components/SidePanel.vue";
import { HOT_TOPICS, READS } from "../../../src/data/demo";

describe("SidePanel / 热搜排行", () => {
  it("渲染全部话题，前三名带高位标记", () => {
    const wrapper = mount(SidePanel);
    const items = wrapper.findAll(".hot-item");

    expect(items).toHaveLength(HOT_TOPICS.length);
    expect(wrapper.findAll(".hot-rank.is-top")).toHaveLength(3);
    expect(items[0].find(".hot-title").text()).toBe("#城市夜跑#");
  });

  it("点击话题抛出 pick-topic", async () => {
    const wrapper = mount(SidePanel);

    await wrapper.findAll(".hot-link")[0].trigger("click");

    expect(wrapper.emitted("pick-topic")?.[0]).toEqual(["城市夜跑"]);
  });
});

describe("SidePanel / 推荐阅读", () => {
  it("渲染全部文章摘要", () => {
    const wrapper = mount(SidePanel);
    const cards = wrapper.findAll(".read-card");

    expect(cards).toHaveLength(READS.length);
    expect(cards[0].find(".read-tag").text()).toBe("随笔");
    expect(cards[0].find(".read-meta").text()).toBe("3 分钟阅读");
  });

  it("点击卡片抛出 open-read", async () => {
    const wrapper = mount(SidePanel);

    await wrapper.findAll(".read-card")[1].trigger("click");

    expect(wrapper.emitted("open-read")?.[0]).toEqual(["r2"]);
  });
});

describe("SidePanel / 广告位", () => {
  it("展示广告角标并可点击", async () => {
    const wrapper = mount(SidePanel);

    expect(wrapper.find(".ad-badge").text()).toBe("广告");

    await wrapper.find(".ad-cta").trigger("click");
    expect(wrapper.emitted("ad-click")).toHaveLength(1);
  });
});
