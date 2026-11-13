/** 动态领域模型：字段规范化、创建、点赞与编辑 */

// 带扩展名：该模块同时被 Node 侧的 Hono 服务导入，原生 ESM 不做扩展名推断
import { DEFAULT_AUTHOR, MAX_AUTHOR_LENGTH, MAX_LENGTH } from "../constants.js";
import { normalizeAuthor, truncate } from "../utils/text.js";
import { normalizeTimestamp } from "../utils/time.js";

/** 生成唯一 id：优先使用 Web Crypto，降级为时间戳 + 随机串 */
export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 把任意来源的数据规范成合法动态；非法或空内容返回 null。
 * 通过注入 now / generateId 保证可测试性。
 */
export function normalizePost(raw, { now = Date.now(), generateId = createId } = {}) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const content = typeof raw.content === "string" ? truncate(raw.content.trim(), MAX_LENGTH) : "";
  if (!content) {
    return null;
  }

  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : generateId(),
    author:
      typeof raw.author === "string" && raw.author.trim()
        ? normalizeAuthor(raw.author, MAX_AUTHOR_LENGTH)
        : DEFAULT_AUTHOR,
    content,
    createdAt: normalizeTimestamp(raw.createdAt, now, now),
    likes:
      typeof raw.likes === "number" && Number.isFinite(raw.likes) && raw.likes >= 0
        ? Math.floor(raw.likes)
        : 0,
    likedByMe: raw.likedByMe === true,
    bookmarks:
      typeof raw.bookmarks === "number" && Number.isFinite(raw.bookmarks) && raw.bookmarks >= 0
        ? Math.floor(raw.bookmarks)
        : 0,
    bookmarkedByMe: raw.bookmarkedByMe === true,
    editedAt: normalizeTimestamp(raw.editedAt, null, now),
  };
}

/** 创建一条新动态；内容为空时返回 null */
export function createPost({ content, author } = {}, { now = Date.now(), generateId = createId } = {}) {
  const text = typeof content === "string" ? truncate(content.trim(), MAX_LENGTH) : "";
  if (!text) {
    return null;
  }

  return normalizePost(
    {
      id: generateId(),
      author,
      content: text,
      createdAt: now,
      likes: 0,
      likedByMe: false,
      bookmarks: 0,
      bookmarkedByMe: false,
      editedAt: null,
    },
    { now, generateId }
  );
}

/** 切换点赞状态，返回新对象（不修改入参） */
export function togglePostLike(post) {
  const likedByMe = !post.likedByMe;
  return {
    ...post,
    likedByMe,
    likes: Math.max(0, post.likes + (likedByMe ? 1 : -1)),
  };
}

/** 切换收藏状态，返回新对象（不修改入参） */
export function togglePostBookmark(post) {
  const bookmarkedByMe = !post.bookmarkedByMe;
  return {
    ...post,
    bookmarkedByMe,
    bookmarks: Math.max(0, (post.bookmarks || 0) + (bookmarkedByMe ? 1 : -1)),
  };
}

/**
 * 应用编辑：内容规范化后与原内容相同则视为未改动。
 * 返回 { post, changed }；内容为空时返回 { post: null, changed: false }。
 */
export function applyPostEdit(post, content, now = Date.now()) {
  const value = typeof content === "string" ? truncate(content.trim(), MAX_LENGTH) : "";
  if (!value) {
    return { post: null, changed: false };
  }
  if (value === post.content) {
    return { post: { ...post }, changed: false };
  }
  return { post: { ...post, content: value, editedAt: now }, changed: true };
}
