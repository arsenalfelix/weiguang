import { describe, it, expect, afterEach } from "vitest";
import {
  ApiError,
  createApiClient,
  setApiClient,
  getApiClient,
} from "../../../src/services/api";

/** 记录调用并按需返回响应的假 fetch */
function createFakeFetch(handler) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = { url, init };
    calls.push(call);
    return handler(call, calls.length - 1);
  };
  return { fetch, calls };
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function textResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  };
}

/** 204 空响应：故意不提供 text()，用于验证不解析响应体 */
function emptyResponse(status = 204) {
  return { ok: true, status };
}

const POST = {
  id: "p-1",
  author: "我",
  content: "你好",
  createdAt: 1,
  likes: 0,
  likedByMe: false,
  editedAt: null,
};

function parseBody(call) {
  return call.init.body === undefined ? undefined : JSON.parse(call.init.body);
}

afterEach(() => {
  setApiClient(createApiClient());
});

describe("ApiError", () => {
  it("是带 status / code 字段的 Error 子类", () => {
    const error = new ApiError("boom", { status: 500, code: "BOOM" });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.message).toBe("boom");
    expect(error.status).toBe(500);
    expect(error.code).toBe("BOOM");
  });

  it("缺省状态码为 0、错误码为 NETWORK_ERROR", () => {
    const error = new ApiError("boom");

    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
  });
});

describe("createApiClient 请求构造", () => {
  it("health 使用 GET /api/health 并返回响应对象", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ status: "ok" }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.health()).resolves.toEqual({ status: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/health");
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();
  });

  it("listPosts 使用 GET /api/posts 并解包 posts 数组", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ posts: [POST] }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.listPosts()).resolves.toEqual([POST]);
    expect(calls[0].url).toBe("/api/posts");
    expect(calls[0].init.method).toBe("GET");
  });

  it("listPosts 响应缺少 posts 时返回空数组", async () => {
    const { fetch } = createFakeFetch(() => jsonResponse({}));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.listPosts()).resolves.toEqual([]);
  });

  it("getPost 使用 GET /api/posts/:id 并对 id 做 encodeURIComponent", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: POST }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.getPost("a b/c")).resolves.toEqual(POST);
    expect(calls[0].url).toBe("/api/posts/a%20b%2Fc");
    expect(calls[0].init.method).toBe("GET");
  });

  it("createPost 使用 POST /api/posts 并发送 JSON body 与 headers", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: POST }, 201));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.createPost({ content: "你好", author: "我" })).resolves.toEqual(POST);

    expect(calls[0].url).toBe("/api/posts");
    expect(calls[0].init.method).toBe("POST");
    expect(parseBody(calls[0])).toEqual({ content: "你好", author: "我" });
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
    expect(calls[0].init.headers.Accept).toBe("application/json");
  });

  it("createPost 未传 author 时 body 不含 author 字段", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: POST }, 201));
    const client = createApiClient({ fetchImpl: fetch });

    await client.createPost({ content: "你好" });

    expect(parseBody(calls[0])).toEqual({ content: "你好" });
  });

  it("updatePost 使用 PATCH /api/posts/:id 并解包 { post, changed }", async () => {
    const edited = { ...POST, content: "改过" };
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: edited, changed: true }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.updatePost("p-1", "改过")).resolves.toEqual({
      post: edited,
      changed: true,
    });

    expect(calls[0].url).toBe("/api/posts/p-1");
    expect(calls[0].init.method).toBe("PATCH");
    expect(parseBody(calls[0])).toEqual({ content: "改过" });
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
  });

  it("updatePost 保留 changed=false", async () => {
    const { fetch } = createFakeFetch(() => jsonResponse({ post: POST, changed: false }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.updatePost("p-1", "你好")).resolves.toEqual({
      post: POST,
      changed: false,
    });
  });

  it("deletePost 使用 DELETE /api/posts/:id 且不解析 204 响应体", async () => {
    const { fetch, calls } = createFakeFetch(() => emptyResponse(), 0);
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.deletePost("p-1")).resolves.toBeUndefined();
    expect(calls[0].url).toBe("/api/posts/p-1");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("setLike(id, true) 使用 PUT /api/posts/:id/likes 并返回 post", async () => {
    const liked = { ...POST, likedByMe: true, likes: 1 };
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: liked }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.setLike("p-1", true)).resolves.toEqual(liked);
    expect(calls[0].url).toBe("/api/posts/p-1/likes");
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.body).toBeUndefined();
  });

  it("setLike(id, false) 使用 DELETE /api/posts/:id/likes 并返回 post", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ post: POST }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.setLike("p-1", false)).resolves.toEqual(POST);
    expect(calls[0].url).toBe("/api/posts/p-1/likes");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("getProfile 使用 GET /api/profile 并解包 author", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ author: "小明" }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.getProfile()).resolves.toBe("小明");
    expect(calls[0].url).toBe("/api/profile");
    expect(calls[0].init.method).toBe("GET");
  });

  it("getProfile 未设置昵称时返回空字符串", async () => {
    const { fetch } = createFakeFetch(() => jsonResponse({}));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.getProfile()).resolves.toBe("");
  });

  it("setProfile 使用 PUT /api/profile 并返回规范化昵称", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ author: "小明" }));
    const client = createApiClient({ fetchImpl: fetch });

    await expect(client.setProfile("  小明  ")).resolves.toBe("小明");
    expect(calls[0].url).toBe("/api/profile");
    expect(calls[0].init.method).toBe("PUT");
    expect(parseBody(calls[0])).toEqual({ author: "  小明  " });
    expect(calls[0].init.headers["Content-Type"]).toBe("application/json");
  });

  it("支持自定义 baseUrl 并去掉尾部斜杠", async () => {
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ posts: [] }));
    const client = createApiClient({ baseUrl: "http://localhost:8787/api/", fetchImpl: fetch });

    await client.listPosts();
    expect(calls[0].url).toBe("http://localhost:8787/api/posts");
  });
});

describe("createApiClient 错误映射", () => {
  it("非 2xx 抛 ApiError：status 为 HTTP 码，code/message 取自 error 字段", async () => {
    const { fetch } = createFakeFetch(() =>
      jsonResponse({ error: { code: "EMPTY_CONTENT", message: "内容不能为空" } }, 422),
    );
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.createPost({ content: "" }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(422);
    expect(error.code).toBe("EMPTY_CONTENT");
    expect(error.message).toBe("内容不能为空");
  });

  it("404 映射为 POST_NOT_FOUND", async () => {
    const { fetch } = createFakeFetch(() =>
      jsonResponse({ error: { code: "POST_NOT_FOUND", message: "动态不存在" } }, 404),
    );
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.getPost("missing").catch((e) => e);

    expect(error.status).toBe(404);
    expect(error.code).toBe("POST_NOT_FOUND");
  });

  it("缺少 error 字段时 code 缺省 HTTP_ERROR 并使用默认文案", async () => {
    const { fetch } = createFakeFetch(() => jsonResponse({}, 500));
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.listPosts().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(500);
    expect(error.code).toBe("HTTP_ERROR");
    expect(typeof error.message).toBe("string");
    expect(error.message).toContain("500");
  });

  it("非 2xx 且响应体不是 JSON 时仍保留 HTTP 状态码", async () => {
    const { fetch } = createFakeFetch(() => textResponse("<html>oops</html>", 502));
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.listPosts().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(502);
    expect(error.code).toBe("HTTP_ERROR");
  });

  it("网络异常抛 ApiError(status=0, code=NETWORK_ERROR)", async () => {
    const { fetch } = createFakeFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.health().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(typeof error.message).toBe("string");
    expect(error.message.length).toBeGreaterThan(0);
  });

  it("2xx 但响应体不是 JSON 时抛 ApiError(status=0, code=NETWORK_ERROR) 而非 SyntaxError", async () => {
    const { fetch } = createFakeFetch(() => textResponse("not json", 200));
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.listPosts().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
  });

  it("读取响应体抛错时同样映射为 NETWORK_ERROR", async () => {
    const { fetch } = createFakeFetch(() => ({
      ok: true,
      status: 200,
      text: async () => {
        throw new Error("stream broken");
      },
    }));
    const client = createApiClient({ fetchImpl: fetch });

    const error = await client.listPosts().catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.code).toBe("NETWORK_ERROR");
  });
});

describe("client 注入", () => {
  it("未注入时 getApiClient 返回默认实例（baseUrl=/api）", async () => {
    const original = globalThis.fetch;
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ status: "ok" }));
    globalThis.fetch = fetch;

    try {
      await getApiClient().health();
      expect(calls[0].url).toBe("/api/health");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("setApiClient 注入后 getApiClient 返回同一实例", () => {
    const injected = { listPosts: async () => [] };
    setApiClient(injected);

    expect(getApiClient()).toBe(injected);
  });

  it("未显式传 fetchImpl 时每次调用都读取 globalThis.fetch", async () => {
    const client = createApiClient();
    const original = globalThis.fetch;
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ posts: [POST] }));
    globalThis.fetch = fetch;

    try {
      await expect(client.listPosts()).resolves.toEqual([POST]);
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("显式传入的 fetchImpl 优先于 globalThis.fetch", async () => {
    const original = globalThis.fetch;
    const { fetch, calls } = createFakeFetch(() => jsonResponse({ posts: [] }));
    const globalCalls = [];
    globalThis.fetch = async () => {
      globalCalls.push("global");
      return jsonResponse({ posts: [POST] });
    };

    try {
      const client = createApiClient({ fetchImpl: fetch });
      await client.listPosts();

      expect(calls).toHaveLength(1);
      expect(globalCalls).toHaveLength(0);
    } finally {
      globalThis.fetch = original;
    }
  });
});
