import { describe, it, expect } from "vitest";
import {
  normalizePost,
  createPost,
  togglePostBookmark,
  togglePostLike,
} from "../../src/domain/post";

const NOW = new Date(2026, 10, 13, 12, 0).getTime();

function raw(overrides = {}) {
  return {
    id: "p1",
    author: "微光",
    content: "今天也很好",
    createdAt: NOW - 1000,
    likes: 2,
    likedByMe: true,
    bookmarks: 1,
    bookmarkedByMe: true,
    editedAt: null,
    ...overrides,
  };
}

describe("normalizePost", () => {
  it("过滤非对象与空内容", () => {
    expect(normalizePost(null)).toBeNull();
    expect(normalizePost(undefined)).toBeNull();
    expect(normalizePost("文本")).toBeNull();
    expect(normalizePost({ content: "   " })).toBeNull();
    expect(normalizePost({})).toBeNull();
  });

  it("保留合法字段并去除正文首尾空白", () => {
    const post = normalizePost(raw({ content: "  你好  " }), { now: NOW });
    expect(post).toMatchObject({
      id: "p1",
      author: "微光",
      content: "你好",
      createdAt: NOW - 1000,
      likes: 2,
      likedByMe: true,
      bookmarks: 1,
      bookmarkedByMe: true,
      editedAt: null,
    });
  });

  it("缺省昵称回退为「我」，超长昵称截断到 12 字", () => {
    expect(normalizePost(raw({ author: "  " }), { now: NOW }).author).toBe("我");
    expect(normalizePost(raw({ author: "一二三四五六七八九十十一十二十三" }), { now: NOW }).author).toHaveLength(12);
  });

  it("正文超过 280 字时截断", () => {
    const post = normalizePost(raw({ content: "字".repeat(400) }), { now: NOW });
    expect(post.content).toHaveLength(280);
  });

  it("点赞数取整且不为负，非法值归零", () => {
    expect(normalizePost(raw({ likes: 3.8 }), { now: NOW }).likes).toBe(3);
    expect(normalizePost(raw({ likes: -2 }), { now: NOW }).likes).toBe(0);
    expect(normalizePost(raw({ likes: "9" }), { now: NOW }).likes).toBe(0);
    expect(normalizePost(raw({ likes: Number.NaN }), { now: NOW }).likes).toBe(0);
  });

  it("likedByMe 仅接受严格的 true", () => {
    expect(normalizePost(raw({ likedByMe: "true" }), { now: NOW }).likedByMe).toBe(false);
    expect(normalizePost(raw({ likedByMe: 1 }), { now: NOW }).likedByMe).toBe(false);
  });

  it("收藏数取整且不为负，非法值归零", () => {
    expect(normalizePost(raw({ bookmarks: 4.9 }), { now: NOW }).bookmarks).toBe(4);
    expect(normalizePost(raw({ bookmarks: -1 }), { now: NOW }).bookmarks).toBe(0);
    expect(normalizePost(raw({ bookmarks: "3" }), { now: NOW }).bookmarks).toBe(0);
    expect(normalizePost(raw({ bookmarks: Number.NaN }), { now: NOW }).bookmarks).toBe(0);
    expect(normalizePost(raw({ bookmarks: undefined }), { now: NOW }).bookmarks).toBe(0);
  });

  it("bookmarkedByMe 仅接受严格的 true", () => {
    expect(normalizePost(raw({ bookmarkedByMe: "true" }), { now: NOW }).bookmarkedByMe).toBe(false);
    expect(normalizePost(raw({ bookmarkedByMe: 1 }), { now: NOW }).bookmarkedByMe).toBe(false);
    expect(normalizePost(raw({ bookmarkedByMe: false }), { now: NOW }).bookmarkedByMe).toBe(false);
  });

  it("非法时间戳回退到当前时间，编辑时间回退为 null", () => {
    const post = normalizePost(raw({ createdAt: "昨天", editedAt: "刚才" }), { now: NOW });
    expect(post.createdAt).toBe(NOW);
    expect(post.editedAt).toBeNull();
  });

  it("缺少 id 时使用注入的 id 生成器", () => {
    const post = normalizePost(raw({ id: "" }), { now: NOW, generateId: () => "generated" });
    expect(post.id).toBe("generated");
  });
});

describe("createPost", () => {
  it("创建一条新动态并规范化字段", () => {
    const post = createPost(
      { content: "  第一条动态  ", author: "小光" },
      { now: NOW, generateId: () => "new-id" }
    );

    expect(post).toEqual({
      id: "new-id",
      author: "小光",
      content: "第一条动态",
      createdAt: NOW,
      likes: 0,
      likedByMe: false,
      bookmarks: 0,
      bookmarkedByMe: false,
      editedAt: null,
    });
  });

  it("空内容返回 null，昵称为空时用默认值", () => {
    expect(
      createPost({ content: "   ", author: "小光" }, { now: NOW, generateId: () => "id" })
    ).toBeNull();

    const post = createPost({ content: "内容", author: "" }, { now: NOW, generateId: () => "id" });
    expect(post.author).toBe("我");
  });
});

describe("togglePostLike / togglePostBookmark", () => {
  it("点赞切换计数且不修改入参", () => {
    const post = raw({ likes: 2, likedByMe: false });
    const next = togglePostLike(post);

    expect(next).toMatchObject({ likes: 3, likedByMe: true });
    expect(post).toMatchObject({ likes: 2, likedByMe: false });
    expect(next).not.toBe(post);
  });

  it("收藏切换计数且不修改入参", () => {
    const post = raw({ bookmarks: 2, bookmarkedByMe: false });
    const next = togglePostBookmark(post);

    expect(next).toMatchObject({ bookmarks: 3, bookmarkedByMe: true });
    expect(post).toMatchObject({ bookmarks: 2, bookmarkedByMe: false });
    expect(next).not.toBe(post);
  });

  it("取消收藏后计数不会变成负数", () => {
    const post = raw({ bookmarks: 0, bookmarkedByMe: true });
    expect(togglePostBookmark(post)).toMatchObject({ bookmarks: 0, bookmarkedByMe: false });
  });

  it("缺少收藏字段的旧数据也能安全切换", () => {
    const legacy = { id: "old", content: "旧数据", likes: 0, likedByMe: false };
    expect(togglePostBookmark(legacy)).toMatchObject({ bookmarks: 1, bookmarkedByMe: true });
  });
});
