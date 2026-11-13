import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// 纯静态 SPA：产物使用相对路径，便于任意静态服务器或本地文件方式托管
export default defineConfig({
  base: "./",
  plugins: [vue()],
});
