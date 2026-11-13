/** 文本工具：安全截断、首字提取与稳定哈希 */

/**
 * 按字符长度截断文本。
 * 若截断点正好落在代理对（Emoji）中间，则回退一位，避免产生半个字符。
 */
export function truncate(text, max) {
  if (typeof text !== "string" || !Number.isFinite(max) || max <= 0) {
    return "";
  }

  const limit = Math.floor(max);
  if (text.length <= limit) {
    return text;
  }

  let cut = text.slice(0, limit);
  const lastCode = cut.charCodeAt(cut.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    cut = cut.slice(0, -1);
  }
  return cut;
}

/** 取昵称首字作为头像文案，空值回退「我」，按码点避免切断 Emoji */
export function getInitial(name) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) {
    return "我";
  }
  return Array.from(trimmed)[0].toUpperCase();
}

/** 稳定哈希：同一文本始终得到 0 ~ 99999 之间的整数 */
export function hashString(text) {
  const value = typeof text === "string" ? text : "";
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100000;
  }
  return hash;
}

/** 头像渐变调色板，按昵称哈希取色，保证同一昵称配色稳定 */
export const AVATAR_PALETTES = [
  ["#6366f1", "#a78bfa"],
  ["#0ea5e9", "#38bdf8"],
  ["#f59e0b", "#fbbf24"],
  ["#10b981", "#34d399"],
  ["#ec4899", "#f472b6"],
  ["#8b5cf6", "#c4b5fd"],
  ["#ef4444", "#fb923c"],
  ["#14b8a6", "#5eead4"],
];

/** 生成头像的背景渐变样式字符串 */
export function getAvatarGradient(name) {
  const palette = AVATAR_PALETTES[hashString(name || "") % AVATAR_PALETTES.length];
  return `linear-gradient(140deg, ${palette[0]}, ${palette[1]})`;
}

/** 归一化昵称：去空白、截断到 12 字、空值回退「我」 */
export function normalizeAuthor(name, maxLength = 12) {
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed ? truncate(trimmed, maxLength) : "我";
}

/** 在文末追加「#话题# 」，保留已有草稿 */
export function appendTopic(draft, topic) {
  const current = typeof draft === "string" ? draft.replace(/\s+$/, "") : "";
  const tag = `#${topic}#`;
  return current ? `${current} ${tag} ` : `${tag} `;
}
