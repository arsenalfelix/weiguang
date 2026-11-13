/**
 * 动态 store：时间线数据来自本机 Hono REST 服务，任何请求失败都降级为 offline，
 * 不把异常抛给组件。返回值字符串是 UI 依赖的契约，禁止改动。
 */

import { defineStore } from "pinia";
import { getApiClient } from "../services/api";
import { normalizeAuthor } from "../utils/text";

const STATUS = {
  idle: "idle",
  loading: "loading",
  ready: "ready",
  offline: "offline",
};

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

/** 404 说明服务在线但数据已不存在：按 missing 处理，不标记离线 */
function isMissingError(error) {
  return Boolean(error) && error.status === 404;
}

function byCreatedAtDesc(a, b) {
  return b.createdAt - a.createdAt;
}

export const usePostsStore = defineStore("posts", {
  state: () => ({
    posts: [],
    author: "",
    serviceAvailable: true,
    status: STATUS.idle,
    editingId: null,
    highlightId: null,
    introPlayed: false,
    initialized: false,
  }),

  getters: {
    total: (state) => state.posts.length,
    hasPosts: (state) => state.posts.length > 0,
    /** 发布框应展示的昵称：空值回退「我」 */
    currentAuthor: (state) => normalizeAuthor(state.author),
    editingPost: (state) => state.posts.find((post) => post.id === state.editingId) || null,
  },

  actions: {
    /** 标记服务不可用：任何请求层失败都走这里 */
    markOffline() {
      this.serviceAvailable = false;
      this.status = STATUS.offline;
    },
    markReady() {
      this.serviceAvailable = true;
      this.status = STATUS.ready;
    },

    /** 用服务端返回的最新数据替换列表项 */
    replacePost(post) {
      if (!post || typeof post.id !== "string") {
        return null;
      }
      this.posts = this.posts.map((item) => (item.id === post.id ? post : item));
      return post;
    },

    /** 从列表中移除已不存在于服务端的动态 */
    dropPost(id) {
      this.posts = this.posts.filter((post) => post.id !== id);
      if (this.editingId === id) {
        this.editingId = null;
      }
    },

    /** 从服务端加载动态与昵称；成功 true，失败 false */
    async init() {
      this.status = STATUS.loading;

      try {
        const client = getApiClient();
        const [list, author] = await Promise.all([client.listPosts(), client.getProfile()]);

        this.posts = (Array.isArray(list) ? list : []).slice().sort(byCreatedAtDesc);
        this.author = typeof author === "string" ? author : "";
        this.markReady();
        return true;
      } catch (error) {
        this.posts = [];
        this.markOffline();
        return false;
      } finally {
        this.initialized = true;
      }
    },

    /** 发布：created / invalid / offline */
    async addPost({ content, author } = {}) {
      const text = trimmed(content);
      if (!text) {
        return { status: "invalid" };
      }

      try {
        const post = await getApiClient().createPost({ content: text, author: trimmed(author) });

        this.posts.unshift(post);
        this.author = post.author;
        this.editingId = null;
        this.highlightId = post.id;
        this.markReady();

        return { status: "created", post };
      } catch (error) {
        this.markOffline();
        return { status: "offline" };
      }
    },

    /** 点赞/取消：ok / missing / offline */
    async toggleLike(id) {
      const target = this.posts.find((post) => post.id === id);
      if (!target) {
        return { status: "missing" };
      }

      try {
        const post = await getApiClient().setLike(id, !target.likedByMe);

        this.replacePost(post);
        this.markReady();

        return { status: "ok", post };
      } catch (error) {
        if (isMissingError(error)) {
          this.dropPost(id);
          return { status: "missing" };
        }
        this.markOffline();
        return { status: "offline" };
      }
    },

    /** 保存编辑：saved / unchanged / empty / missing / offline */
    async saveEdit(id, content) {
      const target = this.posts.find((post) => post.id === id);
      if (!target) {
        return { status: "missing" };
      }

      const text = trimmed(content);
      if (!text) {
        return { status: "empty" };
      }

      try {
        const { post, changed } = await getApiClient().updatePost(id, text);
        this.markReady();

        if (!changed) {
          this.editingId = null;
          return { status: "unchanged", post: post || target };
        }

        this.replacePost(post);
        this.editingId = null;
        this.highlightId = id;

        return { status: "saved", post };
      } catch (error) {
        if (isMissingError(error)) {
          this.dropPost(id);
          return { status: "missing" };
        }
        this.markOffline();
        return { status: "offline" };
      }
    },

    /** 删除：deleted / missing / offline */
    async removePost(id) {
      const exists = this.posts.some((post) => post.id === id);
      if (!exists) {
        return { status: "missing" };
      }

      try {
        await getApiClient().deletePost(id);

        this.dropPost(id);
        this.markReady();

        return { status: "deleted" };
      } catch (error) {
        if (isMissingError(error)) {
          this.dropPost(id);
          return { status: "missing" };
        }
        this.markOffline();
        return { status: "offline" };
      }
    },

    /** 更新昵称：本地立即生效，服务端失败可忽略 → string */
    async setAuthor(name) {
      this.author = normalizeAuthor(name);

      try {
        const saved = await getApiClient().setProfile(this.author);
        if (typeof saved === "string" && saved) {
          this.author = saved;
        }
        this.serviceAvailable = true;
        if (this.status === STATUS.offline) {
          this.status = STATUS.ready;
        }
      } catch (error) {
        /* 忽略：昵称至少已在本地生效，不打断发布流程 */
      }

      return this.author;
    },

    /** 发布框里实时编辑昵称：允许暂时为空，仅本地草稿 */
    updateAuthorDraft(name) {
      this.author = typeof name === "string" ? name : "";
      return this.author;
    },

    /** 进入编辑态 */
    startEdit(id) {
      if (!this.posts.some((post) => post.id === id)) {
        return false;
      }
      this.editingId = id;
      return true;
    },

    cancelEdit() {
      this.editingId = null;
    },

    isEditing(id) {
      return this.editingId === id;
    },

    /** 清空高亮标记（动画结束后调用） */
    clearHighlight(id) {
      if (!id || this.highlightId === id) {
        this.highlightId = null;
      }
    },
  },
});
