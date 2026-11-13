/**
 * HTTP API 客户端：把后端 REST 接口包装成可注入、可测试的服务对象。
 * 任何失败都以 ApiError 抛出，调用方（store）负责降级，不接触原始异常。
 */

const DEFAULT_BASE_URL = "/api";
const DEFAULT_ERROR_CODE = "HTTP_ERROR";
const NETWORK_ERROR_CODE = "NETWORK_ERROR";
const NETWORK_ERROR_MESSAGE = "网络异常，请检查服务是否已启动";

/** 统一的客户端错误：status 为 HTTP 状态码，网络层失败为 0 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = NETWORK_ERROR_CODE } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function networkError(message = NETWORK_ERROR_MESSAGE) {
  return new ApiError(message, { status: 0, code: NETWORK_ERROR_CODE });
}

function joinUrl(baseUrl, path) {
  const base = typeof baseUrl === "string" ? baseUrl.replace(/\/+$/, "") : "";
  return `${base}${path}`;
}

/** fetchImpl 为显式传入时优先，否则每次调用都读取 globalThis.fetch（便于测试替换） */
function resolveFetch(fetchImpl) {
  if (typeof fetchImpl === "function") {
    return fetchImpl;
  }
  const globalFetch = globalThis.fetch;
  if (typeof globalFetch === "function") {
    return (...args) => globalFetch.apply(globalThis, args);
  }
  throw networkError("当前环境不支持 fetch");
}

function isOk(response) {
  if (!response || typeof response !== "object") {
    return false;
  }
  if (typeof response.ok === "boolean") {
    return response.ok;
  }
  return typeof response.status === "number" && response.status >= 200 && response.status < 300;
}

/** 读取响应文本，读取失败视为网络异常 */
async function readText(response) {
  if (!response || typeof response.text !== "function") {
    return "";
  }
  try {
    return await response.text();
  } catch (error) {
    throw networkError();
  }
}

/** 解析 JSON；失败返回 undefined，由调用方决定语义 */
function parseJson(text) {
  if (typeof text !== "string" || text.trim() === "") {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return undefined;
  }
}

function toApiError(data, status) {
  const info = data && typeof data === "object" && data.error && typeof data.error === "object"
    ? data.error
    : {};
  const code = typeof info.code === "string" && info.code ? info.code : DEFAULT_ERROR_CODE;
  const message =
    typeof info.message === "string" && info.message
      ? info.message
      : `请求失败（HTTP ${status}）`;

  return new ApiError(message, { status, code });
}

export function createApiClient({ baseUrl = DEFAULT_BASE_URL, fetchImpl } = {}) {
  async function request(path, { method = "GET", body } = {}) {
    const fetch = resolveFetch(fetchImpl);
    const headers = { Accept: "application/json" };
    const init = { method, headers };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(joinUrl(baseUrl, path), init);
    } catch (error) {
      throw networkError();
    }

    const status = typeof response?.status === "number" ? response.status : 0;

    if (!isOk(response)) {
      throw toApiError(parseJson(await readText(response)), status || 0);
    }

    // 204/205 无响应体，直接返回，不做解析
    if (status === 204 || status === 205) {
      return undefined;
    }

    const text = await readText(response);
    const data = parseJson(text);
    if (data === undefined) {
      throw networkError("服务返回了无法解析的响应");
    }
    return data;
  }

  return {
    async health() {
      const data = await request("/health");
      return data && typeof data === "object" ? data : {};
    },
    async listPosts() {
      const data = await request("/posts");
      return data && Array.isArray(data.posts) ? data.posts : [];
    },
    async getPost(id) {
      const data = await request(`/posts/${encodeURIComponent(id)}`);
      return data && data.post ? data.post : null;
    },
    async createPost({ content, author } = {}) {
      const body = author === undefined ? { content } : { content, author };
      const data = await request("/posts", { method: "POST", body });
      return data && data.post ? data.post : null;
    },
    async updatePost(id, content) {
      const data = await request(`/posts/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: { content },
      });
      return {
        post: data && data.post ? data.post : null,
        changed: Boolean(data && data.changed === true),
      };
    },
    async deletePost(id) {
      await request(`/posts/${encodeURIComponent(id)}`, { method: "DELETE" });
      return undefined;
    },
    async setLike(id, liked) {
      const data = await request(`/posts/${encodeURIComponent(id)}/likes`, {
        method: liked ? "PUT" : "DELETE",
      });
      return data && data.post ? data.post : null;
    },
    async setBookmark(id, bookmarked) {
      const data = await request(`/posts/${encodeURIComponent(id)}/bookmarks`, {
        method: bookmarked ? "PUT" : "DELETE",
      });
      return data && data.post ? data.post : null;
    },
    async getProfile() {
      const data = await request("/profile");
      return data && typeof data.author === "string" ? data.author : "";
    },
    async setProfile(author) {
      const data = await request("/profile", { method: "PUT", body: { author } });
      return data && typeof data.author === "string" ? data.author : "";
    },
  };
}

let client = createApiClient();

/** 注入客户端；传空值则恢复默认实例（测试间重置用） */
export function setApiClient(next) {
  client = next || createApiClient();
  return client;
}

/** 读取当前客户端 */
export function getApiClient() {
  return client;
}
