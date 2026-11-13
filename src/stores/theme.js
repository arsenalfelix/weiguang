/** 主题 store：跟随系统 / 浅色 / 深色三档，持久化并同步 DOM */

import { defineStore } from "pinia";
import { STORAGE_KEYS, THEME_LABELS, THEME_MODES } from "../constants";
import { read, write } from "../services/storage";

const LIGHT_THEME_COLOR = "#f7f8fc";
const DARK_THEME_COLOR = "#0d0f14";

function normalizeMode(value) {
  return THEME_MODES.includes(value) ? value : "system";
}

function getSystemMedia() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia("(prefers-color-scheme: dark)");
}

// 媒体查询与监听器保存在模块作用域，保证 destroy 时能移除同一个引用
let mediaQuery = null;
let mediaHandler = null;

export const useThemeStore = defineStore("theme", {
  state: () => ({
    mode: "system",
    systemPrefersDark: false,
    initialized: false,
  }),

  getters: {
    resolved: (state) =>
      state.mode === "system" ? (state.systemPrefersDark ? "dark" : "light") : state.mode,
    label: (state) => THEME_LABELS[state.mode],
  },

  actions: {
    init() {
      if (this.initialized) {
        return this.mode;
      }

      const media = getSystemMedia();
      this.systemPrefersDark = Boolean(media && media.matches);
      this.mode = normalizeMode(read(STORAGE_KEYS.theme));

      this.apply({ persist: false });
      this.bindSystem(media);
      this.initialized = true;
      return this.mode;
    },

    bindSystem(media) {
      this.unbindSystem();
      if (!media) {
        return;
      }

      mediaQuery = media;
      mediaHandler = (event) => this.handleSystemChange(event ? event.matches : undefined);

      if (typeof media.addEventListener === "function") {
        media.addEventListener("change", mediaHandler);
      } else if (typeof media.addListener === "function") {
        media.addListener(mediaHandler);
      }
    },

    unbindSystem() {
      if (!mediaQuery) {
        return;
      }

      if (mediaHandler) {
        if (typeof mediaQuery.removeEventListener === "function") {
          mediaQuery.removeEventListener("change", mediaHandler);
        } else if (typeof mediaQuery.removeListener === "function") {
          mediaQuery.removeListener(mediaHandler);
        }
      }

      mediaQuery = null;
      mediaHandler = null;
    },

    handleSystemChange(matches) {
      this.systemPrefersDark =
        typeof matches === "boolean" ? matches : Boolean(mediaQuery && mediaQuery.matches);

      if (this.mode === "system") {
        this.apply({ persist: false });
      }
    },

    /** 切换模式并持久化，返回新的模式 */
    setMode(value) {
      this.mode = normalizeMode(value);
      this.apply({ persist: true });
      return this.mode;
    },

    /** 按 system → light → dark → system 循环 */
    cycle() {
      const index = THEME_MODES.indexOf(this.mode);
      return this.setMode(THEME_MODES[(index + 1) % THEME_MODES.length]);
    },

    /** 把解析后的主题同步到 DOM 与 meta 主题色 */
    apply({ persist = false } = {}) {
      const resolved = this.resolved;

      if (typeof document !== "undefined") {
        const root = document.documentElement;
        root.setAttribute("data-theme", resolved);
        root.setAttribute("data-theme-mode", this.mode);
        if (root.style) {
          root.style.colorScheme = resolved;
        }

        const meta = document.getElementById("themeColor");
        if (meta) {
          meta.setAttribute(
            "content",
            resolved === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR
          );
        }
      }

      if (persist) {
        write(STORAGE_KEYS.theme, this.mode);
      }

      return resolved;
    },

    destroy() {
      this.unbindSystem();
      this.initialized = false;
    },
  },
});
