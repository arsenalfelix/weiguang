import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatAbsoluteTime,
  normalizeTimestamp,
} from "../../src/utils/time";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** 以本地时间构造时间戳，避免测试受时区影响 */
function local(y, m, d, h = 0, min = 0) {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

describe("formatRelativeTime", () => {
  const now = local(2026, 11, 13, 12, 0);

  it("一分钟内显示「刚刚」", () => {
    expect(formatRelativeTime(now - 30 * 1000, now)).toBe("刚刚");
  });

  it("未来时间也按「刚刚」处理", () => {
    expect(formatRelativeTime(now + 5000, now)).toBe("刚刚");
  });

  it("一小时内显示分钟", () => {
    expect(formatRelativeTime(now - 5 * MINUTE, now)).toBe("5 分钟前");
    expect(formatRelativeTime(now - 59 * MINUTE, now)).toBe("59 分钟前");
  });

  it("一天内显示小时", () => {
    expect(formatRelativeTime(now - 3 * HOUR, now)).toBe("3 小时前");
    expect(formatRelativeTime(now - 23 * HOUR, now)).toBe("23 小时前");
  });

  it("跨过自然日且不足两天显示「昨天」", () => {
    const morning = local(2026, 11, 13, 9, 30);
    expect(formatRelativeTime(local(2026, 11, 12, 8, 0), morning)).toBe("昨天");
  });

  it("一周内显示 N 天前", () => {
    expect(formatRelativeTime(local(2026, 11, 10, 8, 0), now)).toBe("3 天前");
    expect(formatRelativeTime(now - 6 * DAY, now)).toBe("6 天前");
  });

  it("更早且同年显示月日", () => {
    expect(formatRelativeTime(local(2026, 11, 3, 10, 0), now)).toBe("11 月 3 日");
  });

  it("跨年显示完整日期", () => {
    expect(formatRelativeTime(local(2025, 12, 20, 10, 0), now)).toBe("2025-12-20");
  });

  it("非法时间戳不抛错", () => {
    expect(formatRelativeTime(Number.NaN, now)).toBe("刚刚");
  });
});

describe("formatAbsoluteTime", () => {
  it("补零到 YYYY-MM-DD HH:mm", () => {
    expect(formatAbsoluteTime(local(2026, 1, 5, 9, 7))).toBe("2026-01-05 09:07");
  });
});

describe("normalizeTimestamp", () => {
  const now = local(2026, 11, 13, 12, 0);

  it("保留合法时间戳", () => {
    expect(normalizeTimestamp(now - 1000, null, now)).toBe(now - 1000);
  });

  it("超出未来 24 小时视为非法", () => {
    expect(normalizeTimestamp(now + 25 * HOUR, "fallback", now)).toBe("fallback");
  });

  it("允许 24 小时内的时钟偏差", () => {
    expect(normalizeTimestamp(now + 12 * HOUR, null, now)).toBe(now + 12 * HOUR);
  });

  it("字符串、0、负数、NaN 均回退", () => {
    expect(normalizeTimestamp("123", null, now)).toBe(null);
    expect(normalizeTimestamp(0, null, now)).toBe(null);
    expect(normalizeTimestamp(-1, null, now)).toBe(null);
    expect(normalizeTimestamp(Number.NaN, null, now)).toBe(null);
  });
});
