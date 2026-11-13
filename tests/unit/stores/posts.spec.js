import { describe, it, expect } from "vitest";
import { usePostsStore } from "../../../src/stores/posts";
import { ApiError, createApiClient, setApiClient } from "../../../src/services/api";
import { createTestApi } from "../../helpers/testApi";

const NOW = new Date(2026, 10, 13, 12, 0).getTime();

function makeRaw(overrides = {}) {
  return {
    id: "p1",
    author: "微光",
    content: "今天也很好",
    createdAt: NOW - 60_000,
    likes: 2,
    likedByMe: false,
    bookmarks: 0,
    bookmarkedByMe: false,
    editedAt: null,
    ...overrides,
  };
}

/** 注入真实内存后端（Hono app.request 桥接，无真实网络） */
function setupStore(options) {
  const api = createTestApi(options);
  setApiClient(api.client);
  const store = usePostsStore();
  return { api, store };
}

/** 每次都抛网络异常的后端不可用客户端 */
function createOfflineClient() {
  return createApiClient({
    fetchImpl: () => {
      throw new TypeError("Failed to fetch");
    },
  });
}

describe("posts store / init", () => {
  it("成功加载动态并按 createdAt 倒序，返回 true", async () => {
    const { api, store } = setupStore({
      posts: [
        makeRaw({ id: "old", createdAt: NOW - 3 * 24 * 60 * 60 * 1000 }),
        makeRaw({ id: "new", createdAt: NOW - 1000 }),
      ],
    });

    await expect(store.init()).resolves.toBe(true);

    expect(store.posts.map((post) => post.id)).toEqual(["new", "old"]);
    expect(store.status).toBe("ready");
    expect(store.serviceAvailable).toBe(true);
    expect(store.initialized).toBe(true);
    expect(store.total).toBe(2);
    expect(api.repository.list()).toHaveLength(2);
  });

  it("恢复后端保存的昵称", async () => {
    const { store } = setupStore({ posts: [], author: "  小光  " });

    await store.init();

    expect(store.author).toBe("小光");
  });

  it("空后端得到空时间线与空昵称", async () => {
    const { store } = setupStore();

    expect(store.status).toBe("idle");
    await store.init();

    expect(store.posts).toEqual([]);
    expect(store.author).toBe("");
    expect(store.hasPosts).toBe(false);
    expect(store.status).toBe("ready");
  });

  it("后端不可用时降级为 offline 且不抛异常", async () => {
    setApiClient(createOfflineClient());
    const store = usePostsStore();

    await expect(store.init()).resolves.toBe(false);

    expect(store.status).toBe("offline");
    expect(store.serviceAvailable).toBe(false);
    expect(store.posts).toEqual([]);
    expect(store.initialized).toBe(true);
  });
});

describe("posts store / addPost", () => {
  it("created：置顶、高亮、同步昵称，且后端可见", async () => {
    const { api, store } = setupStore({ posts: [makeRaw({ id: "old" })], author: "小光" });
    await store.init();

    const result = await store.addPost({ content: "  新动态  ", author: " 小光 " });

    expect(result.status).toBe("created");
    expect(result.post).toMatchObject({ content: "新动态", author: "小光" });
    expect(store.posts[0].id).toBe(result.post.id);
    expect(store.posts).toHaveLength(2);
    expect(store.highlightId).toBe(result.post.id);
    expect(store.editingId).toBeNull();
    expect(store.author).toBe("小光");
    expect(api.repository.list()[0]).toMatchObject({ content: "新动态", author: "小光" });
  });

  it("created：空昵称由后端回退为「我」并同步到本地", async () => {
    const { api, store } = setupStore();
    await store.init();

    const result = await store.addPost({ content: "内容", author: "   " });

    expect(result.status).toBe("created");
    expect(store.posts[0].author).toBe("我");
    expect(store.author).toBe("我");
    expect(api.repository.getProfile()).toBe("我");
  });

  it("invalid：空内容不请求后端", async () => {
    const { api, store } = setupStore();
    await store.init();

    const result = await store.addPost({ content: "   ", author: "小光" });

    expect(result).toEqual({ status: "invalid" });
    expect(store.posts).toEqual([]);
    expect(api.repository.list()).toEqual([]);
  });

  it("offline：后端不可用时返回 offline 且不改列表", async () => {
    setApiClient(createOfflineClient());
    const store = usePostsStore();
    await store.init();

    const result = await store.addPost({ content: "写不进去", author: "小光" });

    expect(result).toEqual({ status: "offline" });
    expect(store.posts).toEqual([]);
    expect(store.status).toBe("offline");
    expect(store.serviceAvailable).toBe(false);
  });
});

describe("posts store / toggleLike", () => {
  async function setupLiked() {
    const { api, store } = setupStore({ posts: [makeRaw({ id: "p1", likes: 0, likedByMe: false })] });
    await store.init();
    return { api, store };
  }

  it("ok：点赞后计数与后端一致", async () => {
    const { api, store } = await setupLiked();

    const result = await store.toggleLike("p1");

    expect(result.status).toBe("ok");
    expect(result.post).toMatchObject({ likes: 1, likedByMe: true });
    expect(store.posts[0]).toMatchObject({ likes: 1, likedByMe: true });
    expect(api.repository.get("p1")).toMatchObject({ likes: 1, likedByMe: true });
  });

  it("ok：再次点击取消点赞并同步后端", async () => {
    const { api, store } = await setupLiked();
    await store.toggleLike("p1");

    const result = await store.toggleLike("p1");

    expect(result.post).toMatchObject({ likes: 0, likedByMe: false });
    expect(store.posts[0]).toMatchObject({ likes: 0, likedByMe: false });
    expect(api.repository.get("p1")).toMatchObject({ likes: 0, likedByMe: false });
  });

  it("missing：本地不存在的 id 返回 missing", async () => {
    const { store } = await setupLiked();

    expect(await store.toggleLike("missing")).toEqual({ status: "missing" });
    expect(store.posts).toHaveLength(1);
  });

  it("offline：后端不可用时返回 offline", async () => {
    const { store } = await setupLiked();
    const likedBefore = { ...store.posts[0] };
    setApiClient(createOfflineClient());

    const result = await store.toggleLike("p1");

    expect(result).toEqual({ status: "offline" });
    expect(store.posts[0]).toMatchObject(likedBefore);
    expect(store.serviceAvailable).toBe(false);
    expect(store.status).toBe("offline");
  });
});

describe("posts store / toggleBookmark", () => {
  /** 在前端用例里模拟收藏接口，互不依赖后端分支的实现细节 */
  function createBookmarkClient(api) {
    const state = new Map(
      api.repository.list().map((post) => [
        post.id,
        { bookmarks: post.bookmarks ?? 0, bookmarkedByMe: post.bookmarkedByMe === true },
      ])
    );

    return {
      ...api.client,
      async setBookmark(id, bookmarked) {
        const post = api.repository.get(id);
        if (!post) {
          throw new ApiError("动态不存在", { status: 404, code: "POST_NOT_FOUND" });
        }
        const current = state.get(id) || { bookmarks: 0, bookmarkedByMe: false };
        const next = {
          ...post,
          bookmarkedByMe: bookmarked,
          bookmarks: Math.max(0, current.bookmarks + (bookmarked ? 1 : -1)),
        };
        state.set(id, { bookmarks: next.bookmarks, bookmarkedByMe: next.bookmarkedByMe });
        return next;
      },
    };
  }

  async function setupBookmarkable(overrides = {}) {
    const api = createTestApi({ posts: [makeRaw({ id: "p1", bookmarks: 0, ...overrides })] });
    setApiClient(createBookmarkClient(api));
    const store = usePostsStore();
    await store.init();
    return { api, store };
  }

  it("ok：收藏后计数与按钮态同步", async () => {
    const { store } = await setupBookmarkable();

    const result = await store.toggleBookmark("p1");

    expect(result.status).toBe("ok");
    expect(result.post).toMatchObject({ bookmarks: 1, bookmarkedByMe: true });
    expect(store.posts[0]).toMatchObject({ bookmarks: 1, bookmarkedByMe: true });
  });

  it("ok：再次点击取消收藏，且不影响点赞", async () => {
    const { store } = await setupBookmarkable({ likes: 2, likedByMe: true });
    await store.toggleBookmark("p1");

    const result = await store.toggleBookmark("p1");

    expect(result.post).toMatchObject({ bookmarks: 0, bookmarkedByMe: false });
    expect(result.post).toMatchObject({ likes: 2, likedByMe: true });
    expect(store.posts[0]).toMatchObject({ bookmarks: 0, bookmarkedByMe: false });
  });

  it("missing：本地不存在的 id", async () => {
    const { store } = await setupBookmarkable();

    expect(await store.toggleBookmark("missing")).toEqual({ status: "missing" });
  });

  it("offline：后端不可用时返回 offline 并保留原状态", async () => {
    const { store } = await setupBookmarkable();
    const before = { ...store.posts[0] };
    setApiClient(createOfflineClient());

    const result = await store.toggleBookmark("p1");

    expect(result).toEqual({ status: "offline" });
    expect(store.posts[0]).toMatchObject(before);
    expect(store.serviceAvailable).toBe(false);
  });
});

describe("posts store / 筛选视图", () => {
  async function setupFiltered() {
    const api = createTestApi();
    setApiClient(api.client);
    const store = usePostsStore();
    await store.init();

    // 筛选视图只依赖 store 内的 Post 字段，直接注入可避免依赖后端播种细节
    store.posts = [
      makeRaw({ id: "saved", createdAt: NOW - 1000, bookmarks: 1, bookmarkedByMe: true }),
      makeRaw({ id: "liked", createdAt: NOW - 2000, likes: 1, likedByMe: true }),
      makeRaw({ id: "plain", createdAt: NOW - 3000 }),
    ];
    return { api, store };
  }

  it("默认展示全部，计数正确", async () => {
    const { store } = await setupFiltered();

    expect(store.filter).toBe("all");
    expect(store.visiblePosts.map((post) => post.id)).toEqual(["saved", "liked", "plain"]);
    expect(store.filterCounts).toEqual({ all: 3, liked: 1, bookmarked: 1 });
    expect(store.likedPosts.map((post) => post.id)).toEqual(["liked"]);
    expect(store.bookmarkedPosts.map((post) => post.id)).toEqual(["saved"]);
  });

  it("切换到点赞 / 收藏视图只保留对应动态", async () => {
    const { store } = await setupFiltered();

    store.setFilter("liked");
    expect(store.visiblePosts.map((post) => post.id)).toEqual(["liked"]);

    store.setFilter("bookmarked");
    expect(store.visiblePosts.map((post) => post.id)).toEqual(["saved"]);

    store.setFilter("all");
    expect(store.visiblePosts).toHaveLength(3);
  });

  it("非法筛选值回退全部", async () => {
    const { store } = await setupFiltered();

    expect(store.setFilter("nope")).toBe("all");
    expect(store.filter).toBe("all");
  });

  it("在收藏视图取消收藏后该动态立即消失", async () => {
    const { api, store } = await setupFiltered();
    store.setFilter("bookmarked");
    const target = store.posts.find((post) => post.id === "saved");
    setApiClient({
      ...api.client,
      async setBookmark() {
        return { ...target, bookmarks: 0, bookmarkedByMe: false };
      },
    });

    await store.toggleBookmark("saved");

    expect(store.visiblePosts).toEqual([]);
    expect(store.filterCounts.bookmarked).toBe(0);
    expect(store.filter).toBe("bookmarked");
  });
});

describe("posts store / saveEdit", () => {
  async function setupEditing(content = "原始内容") {
    const { api, store } = setupStore({
      posts: [makeRaw({ id: "p1", content, editedAt: null })],
    });
    await store.init();
    await store.startEdit("p1");
    return { api, store };
  }

  it("saved：写入新内容与编辑时间，后端同步", async () => {
    const { api, store } = await setupEditing();

    const result = await store.saveEdit("p1", "  新内容  ");

    expect(result.status).toBe("saved");
    expect(result.post).toMatchObject({ content: "新内容" });
    expect(store.posts[0].content).toBe("新内容");
    expect(store.posts[0].editedAt).toEqual(expect.any(Number));
    expect(store.editingId).toBeNull();
    expect(store.highlightId).toBe("p1");

    const stored = api.repository.get("p1");
    expect(stored.content).toBe("新内容");
    expect(stored.editedAt).toEqual(expect.any(Number));
  });

  it("unchanged：退出编辑态且不写编辑时间", async () => {
    const { api, store } = await setupEditing();

    const result = await store.saveEdit("p1", "原始内容");

    expect(result.status).toBe("unchanged");
    expect(store.editingId).toBeNull();
    expect(store.posts[0].editedAt).toBeNull();
    expect(api.repository.get("p1").editedAt).toBeNull();
  });

  it("empty：保持编辑态且不改内容", async () => {
    const { api, store } = await setupEditing();

    const result = await store.saveEdit("p1", "   ");

    expect(result.status).toBe("empty");
    expect(store.editingId).toBe("p1");
    expect(store.posts[0].content).toBe("原始内容");
    expect(api.repository.get("p1").content).toBe("原始内容");
  });

  it("missing：本地不存在的 id", async () => {
    const { store } = await setupEditing();

    expect(await store.saveEdit("missing", "内容")).toEqual({ status: "missing" });
  });

  it("offline：后端不可用时返回 offline", async () => {
    const { store } = await setupEditing();
    setApiClient(createOfflineClient());

    const result = await store.saveEdit("p1", "新内容");

    expect(result).toEqual({ status: "offline" });
    expect(store.status).toBe("offline");
    expect(store.serviceAvailable).toBe(false);
  });
});

describe("posts store / removePost", () => {
  it("deleted：后端不再存在并清除编辑态", async () => {
    const { api, store } = setupStore({ posts: [makeRaw({ id: "p1" })] });
    await store.init();
    await store.startEdit("p1");

    const result = await store.removePost("p1");

    expect(result).toEqual({ status: "deleted" });
    expect(store.posts).toEqual([]);
    expect(store.editingId).toBeNull();
    expect(api.repository.get("p1")).toBeNull();
    expect(api.repository.list()).toEqual([]);
  });

  it("missing：本地不存在的 id", async () => {
    const { store } = setupStore();
    await store.init();

    expect(await store.removePost("missing")).toEqual({ status: "missing" });
  });

  it("offline：后端不可用时返回 offline 且保留列表", async () => {
    const { store } = setupStore({ posts: [makeRaw({ id: "p1" })] });
    await store.init();
    setApiClient(createOfflineClient());

    const result = await store.removePost("p1");

    expect(result).toEqual({ status: "offline" });
    expect(store.posts).toHaveLength(1);
    expect(store.serviceAvailable).toBe(false);
  });
});

describe("posts store / 同步交互", () => {
  it("startEdit / isEditing / cancelEdit", async () => {
    const { store } = setupStore({ posts: [makeRaw({ id: "p1" })] });
    await store.init();

    expect(store.isEditing("p1")).toBe(false);
    await store.startEdit("p1");
    expect(store.editingId).toBe("p1");
    expect(store.isEditing("p1")).toBe(true);

    store.cancelEdit();
    expect(store.editingId).toBeNull();
  });

  it("startEdit 对不存在的 id 返回 false", async () => {
    const { store } = setupStore();
    await store.init();

    expect(store.startEdit("missing")).toBe(false);
    expect(store.editingId).toBeNull();
  });

  it("clearHighlight 只清除匹配的高亮", async () => {
    const { store } = setupStore({ posts: [makeRaw({ id: "p1" })] });
    await store.init();
    await store.addPost({ content: "新动态", author: "小光" });
    const highlighted = store.highlightId;

    store.clearHighlight("other");
    expect(store.highlightId).toBe(highlighted);

    store.clearHighlight(highlighted);
    expect(store.highlightId).toBeNull();
  });

  it("updateAuthorDraft 仅改本地昵称", async () => {
    const { api, store } = setupStore({ author: "小光" });
    await store.init();

    expect(store.updateAuthorDraft("  小美  ")).toBe("  小美  ");
    expect(store.author).toBe("  小美  ");
    expect(api.repository.getProfile()).toBe("小光");
    expect(store.currentAuthor).toBe("小美");
  });
});

describe("posts store / setAuthor", () => {
  it("更新本地并调用 PUT /profile", async () => {
    const api = createTestApi();
    const calls = [];
    const spyClient = {
      ...api.client,
      async setProfile(author) {
        calls.push(author);
        return api.client.setProfile(author);
      },
    };
    setApiClient(spyClient);

    const store = usePostsStore();
    await store.init();

    await expect(store.setAuthor("  小美  ")).resolves.toBe("小美");

    expect(calls).toEqual(["小美"]);
    expect(store.author).toBe("小美");
    expect(api.repository.getProfile()).toBe("小美");
  });

  it("后端失败时仍更新本地且不抛异常", async () => {
    const api = createTestApi();
    setApiClient({
      ...api.client,
      async setProfile() {
        throw new ApiError("服务异常", { status: 500, code: "HTTP_ERROR" });
      },
    });

    const store = usePostsStore();
    await store.init();

    await expect(store.setAuthor("小美")).resolves.toBe("小美");
    expect(store.author).toBe("小美");
  });
});
