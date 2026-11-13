import { describe, it, expect } from "vitest";
import { usePostsStore } from "../../../src/stores/posts";
import { getStorageAdapter, setStorageAdapter } from "../../../src/services/storage";
import { createFailingWriteAdapter } from "../../helpers/memoryStorage";

const NOW = new Date(2026, 10, 13, 12, 0).getTime();
const POSTS_KEY = "moment.posts.v1";
const AUTHOR_KEY = "moment.author.v1";

function seedPosts(value) {
  getStorageAdapter().write(POSTS_KEY, typeof value === "string" ? value : JSON.stringify(value));
}

function readStoredPosts() {
  const raw = getStorageAdapter().read(POSTS_KEY);
  return raw ? JSON.parse(raw) : null;
}

function makeRaw(overrides = {}) {
  return {
    id: "p1",
    author: "微光",
    content: "今天也很好",
    createdAt: NOW - 60_000,
    likes: 2,
    likedByMe: false,
    editedAt: null,
    ...overrides,
  };
}

describe("posts store / 初始化", () => {
  it("空存储时得到空时间线与可用的存储状态", () => {
    const store = usePostsStore();
    store.init();

    expect(store.posts).toEqual([]);
    expect(store.author).toBe("");
    expect(store.storageAvailable).toBe(true);
    expect(store.total).toBe(0);
    expect(store.hasPosts).toBe(false);
  });

  it("加载时过滤脏数据并按发布时间倒序", () => {
    seedPosts([
      makeRaw({ id: "old", createdAt: NOW - 3 * 24 * 60 * 60 * 1000 }),
      makeRaw({ id: "broken", content: "   " }),
      makeRaw({ id: "new", createdAt: NOW - 1000 }),
      "这不是对象",
    ]);

    const store = usePostsStore();
    store.init();

    expect(store.posts.map((post) => post.id)).toEqual(["new", "old"]);
  });

  it("存储内容不是合法 JSON 时清空并回退为空列表", () => {
    seedPosts("{ 坏掉的数据");

    const store = usePostsStore();
    store.init();

    expect(store.posts).toEqual([]);
    expect(getStorageAdapter().read(POSTS_KEY)).toBeNull();
  });

  it("读取已保存的昵称", () => {
    getStorageAdapter().write(AUTHOR_KEY, "  小光  ");

    const store = usePostsStore();
    store.init();

    expect(store.author).toBe("小光");
  });
});

describe("posts store / 发布", () => {
  it("发布后置顶、标记高亮并写入 localStorage", () => {
    const store = usePostsStore();
    store.init();

    const post = store.addPost(
      { content: "  第一条  ", author: "小光" },
      { now: NOW, generateId: () => "new-id" }
    );

    expect(post).toMatchObject({ id: "new-id", content: "第一条", author: "小光" });
    expect(store.posts).toHaveLength(1);
    expect(store.highlightId).toBe("new-id");
    expect(store.total).toBe(1);
    expect(readStoredPosts()).toEqual([post]);
  });

  it("同时把昵称落盘，空昵称回退为「我」", () => {
    const store = usePostsStore();
    store.init();

    store.addPost({ content: "内容", author: "   " }, { now: NOW, generateId: () => "id" });

    expect(store.posts[0].author).toBe("我");
    expect(getStorageAdapter().read(AUTHOR_KEY)).toBe("我");
  });

  it("空内容不创建动态，也不写入存储", () => {
    const store = usePostsStore();
    store.init();

    expect(store.addPost({ content: "   ", author: "小光" }, { now: NOW })).toBeNull();
    expect(store.posts).toEqual([]);
    expect(getStorageAdapter().read(POSTS_KEY)).toBeNull();
  });
});

describe("posts store / 点赞", () => {
  it("切换点赞时计数加减一并持久化", () => {
    const store = usePostsStore();
    store.init();
    store.addPost({ content: "内容", author: "小光" }, { now: NOW, generateId: () => "p1" });

    store.toggleLike("p1");
    expect(store.posts[0]).toMatchObject({ likes: 1, likedByMe: true });
    expect(readStoredPosts()[0]).toMatchObject({ likes: 1, likedByMe: true });

    store.toggleLike("p1");
    expect(store.posts[0]).toMatchObject({ likes: 0, likedByMe: false });
    expect(readStoredPosts()[0]).toMatchObject({ likes: 0, likedByMe: false });
  });

  it("对不存在的 id 无副作用", () => {
    const store = usePostsStore();
    store.init();

    expect(() => store.toggleLike("missing")).not.toThrow();
    expect(store.posts).toEqual([]);
  });
});

describe("posts store / 编辑", () => {
  function setup() {
    const store = usePostsStore();
    store.init();
    store.addPost({ content: "原始内容", author: "小光" }, { now: NOW - 1000, generateId: () => "p1" });
    return store;
  }

  it("进入与取消编辑只改变编辑态", () => {
    const store = setup();

    store.startEdit("p1");
    expect(store.editingId).toBe("p1");
    expect(store.isEditing("p1")).toBe(true);

    store.cancelEdit();
    expect(store.editingId).toBeNull();
  });

  it("内容变化时写入新内容与编辑时间", () => {
    const store = setup();
    store.startEdit("p1");

    const result = store.saveEdit("p1", "  新内容  ", { now: NOW });

    expect(result).toBe("saved");
    expect(store.posts[0]).toMatchObject({ content: "新内容", editedAt: NOW });
    expect(store.editingId).toBeNull();
    expect(store.highlightId).toBe("p1");
    expect(readStoredPosts()[0].content).toBe("新内容");
  });

  it("内容未变时退出编辑态且不写编辑时间", () => {
    const store = setup();
    store.startEdit("p1");

    const result = store.saveEdit("p1", "原始内容", { now: NOW });

    expect(result).toBe("unchanged");
    expect(store.posts[0].editedAt).toBeNull();
    expect(store.editingId).toBeNull();
  });

  it("空内容拒绝保存并保持编辑态", () => {
    const store = setup();
    store.startEdit("p1");

    const result = store.saveEdit("p1", "   ", { now: NOW });

    expect(result).toBe("empty");
    expect(store.posts[0].content).toBe("原始内容");
    expect(store.editingId).toBe("p1");
  });

  it("保存不存在的动态返回 missing", () => {
    const store = setup();
    expect(store.saveEdit("missing", "内容", { now: NOW })).toBe("missing");
  });
});

describe("posts store / 删除", () => {
  it("删除后同步存储并清除编辑态", () => {
    const store = usePostsStore();
    store.init();
    store.addPost({ content: "要删除", author: "小光" }, { now: NOW, generateId: () => "p1" });
    store.startEdit("p1");

    store.removePost("p1");

    expect(store.posts).toEqual([]);
    expect(store.editingId).toBeNull();
    expect(readStoredPosts()).toEqual([]);
  });
});

describe("posts store / 降级", () => {
  it("写入失败时标记存储不可用，但会话内仍可读写", () => {
    setStorageAdapter(createFailingWriteAdapter());

    const store = usePostsStore();
    store.init();
    const post = store.addPost({ content: "仅本次会话", author: "小光" }, { now: NOW, generateId: () => "p1" });

    expect(post).not.toBeNull();
    expect(store.posts).toHaveLength(1);
    expect(store.storageAvailable).toBe(false);
  });
});
