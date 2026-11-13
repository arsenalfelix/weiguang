import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./server/app.js";

/**
 * 把 Hono 应用挂到 Vite 的 dev / preview 中间件上，
 * 让前端与 /api 共享同一端口，避免额外的跨域与并发启动脚本。
 */
function honoApiPlugin() {
  const listener = getRequestListener(createApp().fetch);

  const mount = (server) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      if (!url.startsWith("/api")) {
        next();
        return;
      }
      listener(req, res);
    });
  };

  return {
    name: "moment-hono-api",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig({
  base: "./",
  plugins: [vue(), honoApiPlugin()],
});
