import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ReadDialog from "../../../src/components/ReadDialog.vue";
import { useUiStore } from "../../../src/stores/ui";
import { findRead } from "../../../src/data/demo";

function mountDialog() {
  return mount(ReadDialog, { attachTo: document.body });
}

describe("ReadDialog", () => {
  let wrapper;

  beforeEach(() => {
    wrapper = null;
  });

  it("未打开时不渲染文章内容", () => {
    wrapper = mountDialog();

    expect(wrapper.find(".read-dialog-title").text()).toBe("");
    expect(wrapper.find(".read-dialog-body").text()).toBe("");
  });

  it("打开后填充标题、元信息与全部段落", async () => {
    wrapper = mountDialog();
    const ui = useUiStore();
    const article = findRead("r1");

    ui.openRead("r1");
    await nextTick();

    expect(wrapper.find(".read-dialog-title").text()).toBe(article.title);
    expect(wrapper.find(".read-dialog-meta").text()).toContain("随笔");
    expect(wrapper.findAll(".read-dialog-body p")).toHaveLength(article.paragraphs.length);
    expect(wrapper.find("dialog").element.open).toBe(true);
  });

  it("点击关闭按钮收起弹层并解锁滚动", async () => {
    wrapper = mountDialog();
    const ui = useUiStore();
    ui.openRead("r2");
    await nextTick();

    await wrapper.find("#readDialogClose").trigger("click");

    expect(ui.readId).toBeNull();
    expect(document.body.classList.contains("is-modal-open")).toBe(false);
    expect(wrapper.find("dialog").element.open).toBe(false);
  });

  it("Esc 关闭弹层", async () => {
    wrapper = mountDialog();
    const ui = useUiStore();
    ui.openRead("r3");
    await nextTick();

    await wrapper.find("dialog").trigger("keydown", { key: "Escape" });

    expect(ui.readId).toBeNull();
  });

  it("点击遮罩（dialog 自身）关闭弹层", async () => {
    wrapper = mountDialog();
    const ui = useUiStore();
    ui.openRead("r4");
    await nextTick();

    await wrapper.find("dialog").trigger("click");

    expect(ui.readId).toBeNull();
  });

  it("关闭后抛出 close 事件，供外层恢复焦点", async () => {
    wrapper = mountDialog();
    const ui = useUiStore();
    ui.openRead("r1");
    await nextTick();

    await wrapper.find("#readDialogClose").trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
