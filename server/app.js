/** Hono 应用装配：路由保持薄，校验与业务规则全部放在 repository / domain */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { createPostRepository } from "./repository.js";

const ERROR_CODES = {
  invalidJson: "INVALID_JSON",
  emptyContent: "EMPTY_CONTENT",
  postNotFound: "POST_NOT_FOUND",
  notFound: "NOT_FOUND",
  internal: "INTERNAL_ERROR",
};

const MESSAGES = {
  invalidJson: "请求体不是合法的 JSON",
  emptyContent: "内容不能为空",
  postNotFound: "动态不存在",
  notFound: "接口不存在",
  internal: "服务器内部错误",
};

function fail(c, status, code, message) {
  return c.json({ error: { code, message } }, status);
}

/**
 * 读取 JSON 请求体：语法错误一律 400；空体视为 {}。
 * @returns {Promise<{ ok: true, body: object } | { ok: false }>}
 */
async function readJsonBody(c) {
  let raw;
  try {
    raw = await c.req.text();
  } catch {
    return { ok: false };
  }

  if (!raw || !raw.trim()) {
    return { ok: true, body: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false };
  }
  return { ok: true, body: parsed };
}

function isPlainAuthor(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @param {{ repository?: ReturnType<typeof createPostRepository> }} [options]
 */
export function createApp({ repository = createPostRepository() } = {}) {
  const app = new Hono();

  app.use("*", cors());

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/posts", (c) => c.json({ posts: repository.list() }));

  app.post("/api/posts", async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return fail(c, 400, ERROR_CODES.invalidJson, MESSAGES.invalidJson);
    }

    const post = repository.create({
      content: parsed.body.content,
      author: parsed.body.author,
    });
    if (!post) {
      return fail(c, 422, ERROR_CODES.emptyContent, MESSAGES.emptyContent);
    }

    // 发布即记下昵称（等价 PUT /api/profile）
    repository.setProfile(post.author);

    return c.json({ post }, 201);
  });

  app.get("/api/posts/:id", (c) => {
    const post = repository.get(c.req.param("id"));
    if (!post) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.json({ post });
  });

  app.patch("/api/posts/:id", async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return fail(c, 400, ERROR_CODES.invalidJson, MESSAGES.invalidJson);
    }

    const result = repository.update(c.req.param("id"), parsed.body.content);
    if (result.status === "missing") {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    if (result.status === "empty") {
      return fail(c, 422, ERROR_CODES.emptyContent, MESSAGES.emptyContent);
    }

    return c.json({ post: result.post, changed: result.status === "saved" });
  });

  app.delete("/api/posts/:id", (c) => {
    if (!repository.remove(c.req.param("id"))) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.body(null, 204);
  });

  app.put("/api/posts/:id/likes", (c) => {
    const post = repository.setLike(c.req.param("id"), true);
    if (!post) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.json({ post });
  });

  app.delete("/api/posts/:id/likes", (c) => {
    const post = repository.setLike(c.req.param("id"), false);
    if (!post) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.json({ post });
  });

  app.put("/api/posts/:id/bookmarks", (c) => {
    const post = repository.setBookmark(c.req.param("id"), true);
    if (!post) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.json({ post });
  });

  app.delete("/api/posts/:id/bookmarks", (c) => {
    const post = repository.setBookmark(c.req.param("id"), false);
    if (!post) {
      return fail(c, 404, ERROR_CODES.postNotFound, MESSAGES.postNotFound);
    }
    return c.json({ post });
  });

  app.get("/api/profile", (c) => c.json({ author: repository.getProfile() }));

  app.put("/api/profile", async (c) => {
    const parsed = await readJsonBody(c);
    if (!parsed.ok) {
      return fail(c, 400, ERROR_CODES.invalidJson, MESSAGES.invalidJson);
    }
    if (!isPlainAuthor(parsed.body.author)) {
      return fail(c, 400, ERROR_CODES.invalidJson, MESSAGES.invalidJson);
    }

    return c.json({ author: repository.setProfile(parsed.body.author) });
  });

  app.notFound((c) => fail(c, 404, ERROR_CODES.notFound, MESSAGES.notFound));

  app.onError((error, c) => {
    // 不把堆栈或异常信息返回给客户端；服务端自己留一行日志
    console.error("[moment] 未捕获的服务端异常:", error?.message ?? error);
    return fail(c, 500, ERROR_CODES.internal, MESSAGES.internal);
  });

  return app;
}
