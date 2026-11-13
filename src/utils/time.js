/** 时间工具：相对时间、绝对时间与时间戳归一化 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function pad(value) {
  return value < 10 ? `0${value}` : String(value);
}

/** 时间戳是否合法：正数、有限，且不超过当前时间 24 小时（容忍时钟偏差） */
export function normalizeTimestamp(value, fallback = null, now = Date.now()) {
  if (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= now + DAY
  ) {
    return value;
  }
  return fallback;
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / 昨天 / N 天前 / M 月 D 日 / YYYY-MM-DD */
export function formatRelativeTime(timestamp, now = Date.now()) {
  let diff = now - timestamp;
  if (!Number.isFinite(diff) || diff < 0) {
    diff = 0;
  }

  if (diff < MINUTE) {
    return "刚刚";
  }
  if (diff < HOUR) {
    return `${Math.floor(diff / MINUTE)} 分钟前`;
  }
  if (diff < DAY) {
    return `${Math.floor(diff / HOUR)} 小时前`;
  }

  const date = new Date(timestamp);
  const base = new Date(now);
  const startOfToday = new Date(base.getFullYear(), base.getMonth(), base.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const calendarDays = Math.round((startOfToday - startOfDate) / DAY);

  if (calendarDays <= 1) {
    return "昨天";
  }
  if (calendarDays < 7) {
    return `${calendarDays} 天前`;
  }
  if (date.getFullYear() === base.getFullYear()) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 绝对时间：YYYY-MM-DD HH:mm */
export function formatAbsoluteTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
