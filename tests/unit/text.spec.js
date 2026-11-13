import { describe, it, expect } from "vitest";
import { truncate, getInitial, hashString } from "../../src/utils/text";

describe("truncate", () => {
  it("文本未超长时原样返回", () => {
    expect(truncate("微光", 280)).toBe("微光");
    expect(truncate("", 12)).toBe("");
  });

  it("超长时按上限截断", () => {
    expect(truncate("a".repeat(300), 280)).toHaveLength(280);
    expect(truncate("abcdef", 3)).toBe("abc");
  });

  it("截断点落在代理对中间时回退一位，不产生半个 Emoji", () => {
    const emoji = "😀";
    const text = "a".repeat(279) + emoji;
    const result = truncate(text, 280);

    expect(result).toBe("a".repeat(279));
    expect(result.charCodeAt(result.length - 1)).toBeLessThan(0xd800);
    expect(result.length).toBeLessThanOrEqual(280);
  });

  it("非字符串输入退化为空串", () => {
    expect(truncate(null, 10)).toBe("");
    expect(truncate(undefined, 10)).toBe("");
  });
});

describe("getInitial", () => {
  it("空昵称回退为「我」", () => {
    expect(getInitial("")).toBe("我");
    expect(getInitial("   ")).toBe("我");
    expect(getInitial(null)).toBe("我");
  });

  it("取首个字符并转大写", () => {
    expect(getInitial("alice")).toBe("A");
    expect(getInitial("张三")).toBe("张");
  });

  it("按码点取首字符，避免截断 Emoji", () => {
    expect(getInitial("😀开心")).toBe("😀");
  });
});

describe("hashString", () => {
  it("相同文本得到相同哈希", () => {
    expect(hashString("微光")).toBe(hashString("微光"));
  });

  it("哈希值落在 0 ~ 99999", () => {
    const value = hashString("alice");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100000);
  });

  it("空字符串不抛错", () => {
    expect(hashString("")).toBe(0);
  });
});
