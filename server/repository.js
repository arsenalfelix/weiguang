/**
 * 动态仓储：进程内内存存储。
 * 只持有内存 Map，不触碰 localStorage / 文件 / 数据库；
 * 所有业务规则复用 src/domain/post.js 与 src/utils/text.js 的纯函数。
 */

import { MAX_AUTHOR_LENGTH } from "../src/constants.js";
import {
  applyPostEdit,
  createPost,
  normalizePost,
  togglePostBookmark,
  togglePostLike,
} from "../src/domain/post.js";
import { normalizeAuthor } from "../src/utils/text.js";

/** 返回结构化克隆安全的普通对象副本，避免外部改动内部状态 */
function toPlainPost(post) {
  return {
    id: post.id,
    author: post.author,
    content: post.content,
    createdAt: post.createdAt,
    likes: post.likes,
    likedByMe: post.likedByMe,
    bookmarks: post.bookmarks,
    bookmarkedByMe: post.bookmarkedByMe,
    editedAt: post.editedAt,
  };
}

/**
 * @param {{ now?: () => number, generateId?: () => string }} [deps]
 */
export function createPostRepository({ now = Date.now, generateId } = {}) {
  /** @type {Map<string, object>} id → 内部 Post（永不外泄引用） */
  const posts = new Map();
  /** @type {string[]} 插入顺序，用于稳定排序 */
  const order = [];
  let profile = "";

  const stamp = () => now();

  function insert(post) {
    posts.set(post.id, post);
    order.push(post.id);
  }

  function list() {
    const items = [...order]
      .reverse()
      .map((id) => posts.get(id))
      .filter(Boolean)
      .map(toPlainPost);

    // createdAt 倒序；时间戳相同时保持「后创建者在前」（reverse + 稳定排序）
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  function get(id) {
    const post = posts.get(id);
    return post ? toPlainPost(post) : null;
  }

  function create(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const post = createPost(
      { content: input.content, author: input.author },
      { now: stamp(), generateId }
    );
    if (!post) {
      return null;
    }
    insert(post);
    return toPlainPost(post);
  }

  function update(id, content) {
    const current = posts.get(id);
    if (!current) {
      return { status: "missing", post: null };
    }

    const { post, changed } = applyPostEdit(current, content, stamp());
    if (!post) {
      return { status: "empty", post: toPlainPost(current) };
    }
    if (!changed) {
      return { status: "unchanged", post: toPlainPost(current) };
    }

    posts.set(id, post);
    return { status: "saved", post: toPlainPost(post) };
  }

  function remove(id) {
    if (!posts.has(id)) {
      return false;
    }
    posts.delete(id);
    const index = order.indexOf(id);
    if (index !== -1) {
      order.splice(index, 1);
    }
    return true;
  }

  function setLike(id, liked) {
    const current = posts.get(id);
    if (!current) {
      return null;
    }

    const target = liked === true;
    if (current.likedByMe === target) {
      return toPlainPost(current);
    }

    const next = togglePostLike(current);
    posts.set(id, next);
    return toPlainPost(next);
  }

  function setBookmark(id, bookmarked) {
    const current = posts.get(id);
    if (!current) {
      return null;
    }

    const target = bookmarked === true;
    if (current.bookmarkedByMe === target) {
      return toPlainPost(current);
    }

    const next = togglePostBookmark(current);
    posts.set(id, next);
    return toPlainPost(next);
  }

  function getProfile() {
    return profile;
  }

  function setProfile(author) {
    profile = normalizeAuthor(author, MAX_AUTHOR_LENGTH);
    return profile;
  }

  function seed(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const items = Array.isArray(input.posts) ? input.posts : [];

    posts.clear();
    order.length = 0;

    items.forEach((item) => {
      const post = normalizePost(item, { now: stamp(), generateId });
      if (!post || posts.has(post.id)) {
        return;
      }
      insert(post);
    });

    if (input.author !== undefined) {
      profile =
        typeof input.author === "string" && input.author.trim()
          ? normalizeAuthor(input.author, MAX_AUTHOR_LENGTH)
          : "";
    }
  }

  return {
    list,
    get,
    create,
    update,
    remove,
    setLike,
    setBookmark,
    getProfile,
    setProfile,
    seed,
  };
}
