import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PostComposer from "../../../src/components/PostComposer.vue";

function mountComposer(props = {}) {
  return mount(PostComposer, { props });
}

describe("PostComposer / 字数与发布按钮", () => {
  it("初始剩余 280 字，按钮禁用", () => {
    const wrapper = mountComposer();

    expect(wrapper.find(".char-counter").text()).toBe("280");
    expect(wrapper.find(".btn-publish").attributes("disabled")).toBeDefined();
  });

  it("输入后实时更新剩余字数并启用按钮", async () => {
    const wrapper = mountComposer();

    await wrapper.find(".composer-input").setValue("你好");

    expect(wrapper.find(".char-counter").text()).toBe("278");
    expect(wrapper.find(".btn-publish").attributes("disabled")).toBeUndefined();
  });

  it("剩余 40 字内进入警示态，10 字内进入危险态", async () => {
    const wrapper = mountComposer();

    await wrapper.find(".composer-input").setValue("a".repeat(240));
    expect(wrapper.find(".char-counter").classes()).toContain("is-warning");

    await wrapper.find(".composer-input").setValue("a".repeat(275));
    expect(wrapper.find(".char-counter").classes()).toContain("is-danger");
  });

  it("纯空白内容仍禁用发布", async () => {
    const wrapper = mountComposer();
    await wrapper.find(".composer-input").setValue("   ");

    expect(wrapper.find(".btn-publish").attributes("disabled")).toBeDefined();
  });
});

describe("PostComposer / 发布", () => {
  it("点击发布抛出内容与昵称", async () => {
    const wrapper = mountComposer({ author: "小光" });
    await wrapper.find(".composer-input").setValue("  第一条  ");

    await wrapper.find(".btn-publish").trigger("click");

    expect(wrapper.emitted("publish")?.[0]).toEqual([{ content: "第一条", author: "小光" }]);
  });

  it("Ctrl / Cmd + Enter 快捷发布，普通回车不发布", async () => {
    const wrapper = mountComposer({ author: "小光" });
    const input = wrapper.find(".composer-input");
    await input.setValue("内容");

    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("publish")).toBeUndefined();

    await input.trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(wrapper.emitted("publish")?.[0]).toEqual([{ content: "内容", author: "小光" }]);
  });

  it("发布时保留草稿，由父级确认成功后再清空", async () => {
    const wrapper = mountComposer();
    const input = wrapper.find(".composer-input");
    await input.setValue("内容");

    await wrapper.find(".btn-publish").trigger("click");

    // 发布是异步的：失败（如服务离线）时不能让用户丢掉已写好的内容
    expect(input.element.value).toBe("内容");
    expect(wrapper.emitted("publish")).toHaveLength(1);

    wrapper.vm.clear();
    await wrapper.vm.$nextTick();

    expect(input.element.value).toBe("");
    expect(wrapper.find(".char-counter").text()).toBe("280");
  });

  it("昵称输入通过 update:author 同步并限制在 12 字内", async () => {
    const wrapper = mountComposer();
    const nickname = wrapper.find(".nickname-input");

    await nickname.setValue("一二三四五六七八九十十一十二十三");

    expect(wrapper.emitted("update:author")?.at(-1)?.[0]).toBe("一二三四五六七八九十十一");
    expect(nickname.attributes("maxlength")).toBe("12");
  });
});

describe("PostComposer / 话题填充", () => {
  it("fillTopic 追加话题并保留已有草稿", async () => {
    const wrapper = mountComposer();
    const input = wrapper.find(".composer-input");

    await input.setValue("今天想聊聊");
    wrapper.vm.fillTopic("城市夜跑");
    await wrapper.vm.$nextTick();

    expect(input.element.value).toBe("今天想聊聊 #城市夜跑# ");
  });

  it("草稿为空时直接填入话题", async () => {
    const wrapper = mountComposer();

    wrapper.vm.fillTopic("秋日书单");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".composer-input").element.value).toBe("#秋日书单# ");
  });
});
