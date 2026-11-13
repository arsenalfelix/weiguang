// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createPostRepository } from "../../server/repository.js";

const BASE_TIME = 1_700_000_000_000;

function createClock(start = BASE_TIME) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    },
  };
}

function createIdGenerator(prefix = "post") {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

function setup() {
  const clock = createClock();
  const repository = createPostRepository({
    now: clock.now,
    generateId: createIdGenerator(),
  });
  const app = createApp({ repository });
  return { app, repository, clock };
}

async function call(app, path, { method = "GET", body, headers = {} } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!init.headers["content-type"]) {
      init.headers["content-type"] = "application/json";
    }
  }

  const response = await app.request(path, init);
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, headers: response.headers, text, json };
}

describe("GET /api/health", () => {
  it("返回 200 与 { status: ok }", async () => {
    const { app } = setup();
    const res = await call(app, "/api/health");

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ status: "ok" });
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

describe("GET /api/posts", () => {
  it("空仓储返回空数组", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts");

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ posts: [] });
  });

  it("返回 createdAt 倒序列表", async () => {
    const { app, clock } = setup();
    await call(app, "/api/posts", { method: "POST", body: { content: "第一条" } });
    clock.advance(1000);
    await call(app, "/api/posts", { method: "POST", body: { content: "第二条" } });
    clock.advance(1000);
    await call(app, "/api/posts", { method: "POST", body: { content: "第三条" } });

    const res = await call(app, "/api/posts");

    expect(res.json.posts.map((post) => post.content)).toEqual(["第三条", "第二条", "第一条"]);
  });
});

describe("POST /api/posts", () => {
  it("创建成功返回 201 与完整 Post", async () => {
    const { app, clock } = setup();
    const res = await call(app, "/api/posts", {
      method: "POST",
      body: { content: "  第一条动态  ", author: "  小明 " },
    });

    expect(res.status).toBe(201);
    expect(res.json.post).toEqual({
      id: "post-1",
      author: "小明",
      content: "第一条动态",
      createdAt: clock.now(),
      likes: 0,
      likedByMe: false,
      bookmarks: 0,
      bookmarkedByMe: false,
      editedAt: null,
    });
  });

  it("缺省昵称回退「我」", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", { method: "POST", body: { content: "匿名" } });

    expect(res.status).toBe(201);
    expect(res.json.post.author).toBe("我");
  });

  it("成功后把昵称写入 profile", async () => {
    const { app } = setup();
    await call(app, "/api/posts", { method: "POST", body: { content: "a", author: "小红" } });

    const profile = await call(app, "/api/profile");

    expect(profile.status).toBe(200);
    expect(profile.json).toEqual({ author: "小红" });
  });

  it("内容截断到 280 字", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", {
      method: "POST",
      body: { content: "字".repeat(300) },
    });

    expect(res.status).toBe(201);
    expect(res.json.post.content).toHaveLength(280);
  });

  it("空内容返回 422 EMPTY_CONTENT", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", { method: "POST", body: { content: "   " } });

    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("EMPTY_CONTENT");
    expect(typeof res.json.error.message).toBe("string");
    expect(res.json.error.message.length).toBeGreaterThan(0);
  });

  it("缺少 content 返回 422", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", { method: "POST", body: {} });

    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("EMPTY_CONTENT");
  });

  it("非法 JSON 返回 400 INVALID_JSON", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", { method: "POST", body: "{ 坏掉的 json" });

    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_JSON");
  });

  it("响应体只有 error.code / error.message", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts", { method: "POST", body: { content: "" } });

    expect(Object.keys(res.json)).toEqual(["error"]);
    expect(Object.keys(res.json.error).sort()).toEqual(["code", "message"]);
  });
});

describe("GET /api/posts/:id", () => {
  it("命中返回 200 与 post", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "查我" } });
    const res = await call(app, `/api/posts/${created.json.post.id}`);

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ post: created.json.post });
  });

  it("未命中返回 404 POST_NOT_FOUND", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts/nope");

    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("POST_NOT_FOUND");
  });
});

describe("PATCH /api/posts/:id", () => {
  it("内容变化返回 200 { post, changed: true }", async () => {
    const { app, clock } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "原文" } });
    clock.advance(2000);

    const res = await call(app, `/api/posts/${created.json.post.id}`, {
      method: "PATCH",
      body: { content: "  新内容  " },
    });

    expect(res.status).toBe(200);
    expect(res.json.changed).toBe(true);
    expect(res.json.post.content).toBe("新内容");
    expect(res.json.post.editedAt).toBe(clock.now());
  });

  it("内容未变化返回 changed: false 且 editedAt 保持 null", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "原文" } });

    const res = await call(app, `/api/posts/${created.json.post.id}`, {
      method: "PATCH",
      body: { content: " 原文 " },
    });

    expect(res.status).toBe(200);
    expect(res.json.changed).toBe(false);
    expect(res.json.post.editedAt).toBeNull();
    expect(res.json.post.content).toBe("原文");
  });

  it("空内容返回 422 EMPTY_CONTENT 且原内容不变", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "原文" } });

    const res = await call(app, `/api/posts/${created.json.post.id}`, {
      method: "PATCH",
      body: { content: "  " },
    });

    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe("EMPTY_CONTENT");

    const detail = await call(app, `/api/posts/${created.json.post.id}`);
    expect(detail.json.post.content).toBe("原文");
  });

  it("id 不存在返回 404 POST_NOT_FOUND", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts/nope", {
      method: "PATCH",
      body: { content: "内容" },
    });

    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("POST_NOT_FOUND");
  });

  it("非法 JSON 返回 400 INVALID_JSON", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "原文" } });

    const res = await call(app, `/api/posts/${created.json.post.id}`, {
      method: "PATCH",
      body: "not-json",
    });

    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_JSON");
  });
});

describe("DELETE /api/posts/:id", () => {
  it("删除成功返回 204 空体", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "待删除" } });

    const res = await call(app, `/api/posts/${created.json.post.id}`, { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(res.text).toBe("");

    const detail = await call(app, `/api/posts/${created.json.post.id}`);
    expect(detail.status).toBe(404);
  });

  it("id 不存在返回 404 POST_NOT_FOUND", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts/nope", { method: "DELETE" });

    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("POST_NOT_FOUND");
  });
});

describe("PUT / DELETE /api/posts/:id/likes", () => {
  it("PUT 点赞返回 likedByMe=true 且 likes=1", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "赞" } });

    const res = await call(app, `/api/posts/${created.json.post.id}/likes`, { method: "PUT" });

    expect(res.status).toBe(200);
    expect(res.json.post.likedByMe).toBe(true);
    expect(res.json.post.likes).toBe(1);
  });

  it("PUT 幂等：重复点赞仍为 1", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "赞" } });
    const path = `/api/posts/${created.json.post.id}/likes`;

    await call(app, path, { method: "PUT" });
    const res = await call(app, path, { method: "PUT" });

    expect(res.status).toBe(200);
    expect(res.json.post.likes).toBe(1);
    expect(res.json.post.likedByMe).toBe(true);
  });

  it("DELETE 取消点赞返回 likedByMe=false 且幂等", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "赞" } });
    const path = `/api/posts/${created.json.post.id}/likes`;
    await call(app, path, { method: "PUT" });

    const once = await call(app, path, { method: "DELETE" });
    const twice = await call(app, path, { method: "DELETE" });

    expect(once.status).toBe(200);
    expect(once.json.post.likedByMe).toBe(false);
    expect(once.json.post.likes).toBe(0);
    expect(twice.status).toBe(200);
    expect(twice.json.post.likes).toBe(0);
  });

  it("id 不存在返回 404 POST_NOT_FOUND", async () => {
    const { app } = setup();
    const put = await call(app, "/api/posts/nope/likes", { method: "PUT" });
    const del = await call(app, "/api/posts/nope/likes", { method: "DELETE" });

    expect(put.status).toBe(404);
    expect(put.json.error.code).toBe("POST_NOT_FOUND");
    expect(del.status).toBe(404);
    expect(del.json.error.code).toBe("POST_NOT_FOUND");
  });
});

describe("PUT / DELETE /api/posts/:id/bookmarks", () => {
  it("PUT 收藏返回 bookmarkedByMe=true 且 bookmarks=1", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "收藏" } });

    const res = await call(app, `/api/posts/${created.json.post.id}/bookmarks`, { method: "PUT" });

    expect(res.status).toBe(200);
    expect(res.json.post.bookmarkedByMe).toBe(true);
    expect(res.json.post.bookmarks).toBe(1);
    // 收藏不影响点赞
    expect(res.json.post).toMatchObject({ likes: 0, likedByMe: false });
  });

  it("PUT 幂等：重复收藏仍为 1", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "收藏" } });
    const path = `/api/posts/${created.json.post.id}/bookmarks`;

    await call(app, path, { method: "PUT" });
    const res = await call(app, path, { method: "PUT" });

    expect(res.status).toBe(200);
    expect(res.json.post.bookmarks).toBe(1);
    expect(res.json.post.bookmarkedByMe).toBe(true);
  });

  it("DELETE 取消收藏返回 bookmarkedByMe=false 且幂等", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "收藏" } });
    const path = `/api/posts/${created.json.post.id}/bookmarks`;
    await call(app, path, { method: "PUT" });

    const once = await call(app, path, { method: "DELETE" });
    const twice = await call(app, path, { method: "DELETE" });

    expect(once.status).toBe(200);
    expect(once.json.post.bookmarkedByMe).toBe(false);
    expect(once.json.post.bookmarks).toBe(0);
    expect(twice.status).toBe(200);
    expect(twice.json.post.bookmarks).toBe(0);
  });

  it("收藏状态会出现在列表与详情中", async () => {
    const { app } = setup();
    const created = await call(app, "/api/posts", { method: "POST", body: { content: "收藏" } });
    await call(app, `/api/posts/${created.json.post.id}/bookmarks`, { method: "PUT" });

    const list = await call(app, "/api/posts");
    expect(list.json.posts[0]).toMatchObject({ bookmarks: 1, bookmarkedByMe: true });

    const detail = await call(app, `/api/posts/${created.json.post.id}`);
    expect(detail.json.post).toMatchObject({ bookmarks: 1, bookmarkedByMe: true });
  });

  it("id 不存在返回 404 POST_NOT_FOUND", async () => {
    const { app } = setup();
    const put = await call(app, "/api/posts/nope/bookmarks", { method: "PUT" });
    const del = await call(app, "/api/posts/nope/bookmarks", { method: "DELETE" });

    expect(put.status).toBe(404);
    expect(put.json.error.code).toBe("POST_NOT_FOUND");
    expect(del.status).toBe(404);
    expect(del.json.error.code).toBe("POST_NOT_FOUND");
  });
});

describe("/api/profile", () => {
  it("未设置时返回空字符串", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile");

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ author: "" });
  });

  it("PUT 返回规范化后的昵称", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile", { method: "PUT", body: { author: "  阿宝  " } });

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ author: "阿宝" });

    const detail = await call(app, "/api/profile");
    expect(detail.json).toEqual({ author: "阿宝" });
  });

  it("昵称截断到 12 字", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile", {
      method: "PUT",
      body: { author: "超长昵称超长昵称超长昵称" },
    });

    expect(res.status).toBe(200);
    expect(res.json.author).toHaveLength(12);
  });

  it("缺失 author 返回 400", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile", { method: "PUT", body: {} });

    expect(res.status).toBe(400);
    expect(typeof res.json.error.code).toBe("string");
    expect(typeof res.json.error.message).toBe("string");
  });

  it("author 不是字符串返回 400", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile", { method: "PUT", body: { author: 42 } });

    expect(res.status).toBe(400);
  });

  it("非法 JSON 返回 400 INVALID_JSON", async () => {
    const { app } = setup();
    const res = await call(app, "/api/profile", { method: "PUT", body: "{" });

    expect(res.status).toBe(400);
    expect(res.json.error.code).toBe("INVALID_JSON");
  });
});

describe("路由与错误兜底", () => {
  it("未知 /api 路由返回 404 NOT_FOUND", async () => {
    const { app } = setup();
    const res = await call(app, "/api/unknown");

    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("NOT_FOUND");
  });

  it("未知子路径返回 404 NOT_FOUND", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts/1/comments");

    expect(res.status).toBe(404);
    expect(res.json.error.code).toBe("NOT_FOUND");
  });

  it("仓储异常返回 500 且不泄漏堆栈", async () => {
    const repository = createPostRepository();
    const app = createApp({
      repository: {
        ...repository,
        list() {
          throw new Error("boom: secret stack");
        },
      },
    });

    const res = await call(app, "/api/posts");

    expect(res.status).toBe(500);
    expect(res.json.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.json)).not.toContain("boom");
    expect(JSON.stringify(res.json)).not.toContain("at ");
  });

  it("响应带 CORS 头", async () => {
    const { app } = setup();
    const res = await call(app, "/api/posts");

    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("OPTIONS 预检请求成功", async () => {
    const { app } = setup();
    const response = await app.request("/api/posts", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
      },
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});
