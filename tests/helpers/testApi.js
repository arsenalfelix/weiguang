/**
 * 测试用后端装配：在内存仓储之上启动 Hono 应用，
 * 并把 createApiClient 的 fetch 桥接到 app.request，全程不经过真实网络。
 */

import { createApp } from "../../server/app.js";
import { createPostRepository } from "../../server/repository.js";
import { createApiClient } from "../../src/services/api.js";

function bridgeFetch(app) {
  return (input, init) => {
    if (typeof input === "string") {
      return app.request(input, init);
    }
    if (input instanceof URL) {
      return app.request(input.toString(), init);
    }
    // Request 实例：app.request 自行读取
    return app.request(input);
  };
}

/**
 * @param {{ posts?: object[], author?: string }} [seed]
 * @returns {{ app: object, repository: object, client: object }}
 */
export function createTestApi({ posts = [], author = "" } = {}) {
  const repository = createPostRepository();
  repository.seed({ posts, author });

  const app = createApp({ repository });
  const client = createApiClient({ fetchImpl: bridgeFetch(app) });

  return { app, repository, client };
}
