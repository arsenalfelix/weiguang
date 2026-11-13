/** 动态 store：时间线数据、作者昵称、编辑态与本地持久化 */

import { defineStore } from "pinia";
import { STORAGE_KEYS } from "../constants";
import { applyPostEdit, createPost, normalizePost, togglePostLike } from "../domain/post";
import { readJSON, write, writeJSON, read, probe } from "../services/storage";
import { normalizeAuthor } from "../utils/text";

export const usePostsStore = defineStore("posts", {
  state: () => ({
    posts: [],
    author: "",
    storageAvailable: true,
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
    /** 从 localStorage 载入：过滤脏数据、按时间倒序、探测存储可用性 */
    init() {
      if (this.initialized) {
        return;
      }

      this.storageAvailable = probe();

      const stored = readJSON(STORAGE_KEYS.posts, []);
      const list = Array.isArray(stored) ? stored : [];
      this.posts = list
        .map((item) => normalizePost(item))
        .filter(Boolean)
        .sort((a, b) => b.createdAt - a.createdAt);

      const savedAuthor = read(STORAGE_KEYS.author);
      this.author = savedAuthor && savedAuthor.trim() ? normalizeAuthor(savedAuthor) : "";
      this.initialized = true;
    },

    /** 持久化动态列表；失败时标记降级 */
    persist() {
      const ok = writeJSON(STORAGE_KEYS.posts, this.posts);
      if (!ok) {
        this.storageAvailable = false;
      }
      return ok;
    },

    setAuthor(name) {
      this.author = normalizeAuthor(name);
      write(STORAGE_KEYS.author, this.author);
      return this.author;
    },

    /** 发布框里实时编辑昵称：允许暂时为空，发布时才落盘 */
    updateAuthorDraft(name) {
      this.author = typeof name === "string" ? name : "";
      return this.author;
    },

    /** 发布动态；内容为空返回 null */
    addPost(input, { now = Date.now(), generateId } = {}) {
      const post = createPost(input, { now, generateId });
      if (!post) {
        return null;
      }

      this.posts.unshift(post);
      this.author = post.author;
      this.editingId = null;
      this.highlightId = post.id;

      write(STORAGE_KEYS.author, post.author);
      this.persist();
      return post;
    },

    toggleLike(id) {
      const target = this.posts.find((post) => post.id === id);
      if (!target) {
        return null;
      }

      const next = togglePostLike(target);
      this.posts = this.posts.map((post) => (post.id === id ? next : post));
      this.persist();
      return next;
    },

    isEditing(id) {
      return this.editingId === id;
    },

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

    /** 保存编辑：saved / unchanged / empty / missing */
    saveEdit(id, content, { now = Date.now() } = {}) {
      const target = this.posts.find((post) => post.id === id);
      if (!target) {
        return "missing";
      }

      const { post: next, changed } = applyPostEdit(target, content, now);
      if (!next) {
        return "empty";
      }
      if (!changed) {
        this.editingId = null;
        return "unchanged";
      }

      this.posts = this.posts.map((post) => (post.id === id ? next : post));
      this.editingId = null;
      this.highlightId = id;
      this.persist();
      return "saved";
    },

    removePost(id) {
      const exists = this.posts.some((post) => post.id === id);
      if (!exists) {
        return false;
      }

      this.posts = this.posts.filter((post) => post.id !== id);
      if (this.editingId === id) {
        this.editingId = null;
      }
      this.persist();
      return true;
    },

    /** 清空高亮标记（动画结束后调用） */
    clearHighlight(id) {
      if (!id || this.highlightId === id) {
        this.highlightId = null;
      }
    },
  },
});
