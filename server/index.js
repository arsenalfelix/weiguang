/** 独立运行入口：API 优先，生产模式下再托管 ./dist 静态产物 */

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.js";

const app = createApp();

if (process.env.NODE_ENV === "production") {
  app.use("*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

const port = Number.parseInt(process.env.PORT ?? "", 10) || 8787;

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[moment] API 服务已启动：http://localhost:${info.port}`);
});
