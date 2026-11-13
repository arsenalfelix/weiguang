// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createPostRepository } from "../../server/repository.js";

const BASE_TIME = 1_700_000_000_000;

function createClock(start = BASE_TIME) {
  let current = start;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
      return current;
    },
  };
}

function createIdGenerator(prefix = "post") {
  let index = 0;
  return () => `${prefix}-${++index}`;
}

function setup() {
  const clock = createClock();
  const generateId = createIdGenerator();
  const repository = createPostRepository({ now: clock.now, generateId });
  return { repository, clock, generateId };
}

describe("createPostRepository / list", () => {
  it("初始为空数组", () => {
    const { repository } = setup();
    expect(repository.list()).toEqual([]);
  });

  it("按 createdAt 倒序返回", () => {
    const { repository, clock } = setup();
    const first = repository.create({ content: "第一条" });
    clock.advance(1000);
    const second = repository.create({ content: "第二条" });
    clock.advance(1000);
    const third = repository.create({ content: "第三条" });

    expect(repository.list().map((post) => post.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);
  });

  it("createdAt 相同时后创建的排在前面", () => {
    const { repository } = setup();
    const first = repository.create({ content: "旧" });
    const second = repository.create({ content: "新" });

    expect(repository.list().map((post) => post.id)).toEqual([second.id, first.id]);
  });

  it("返回数组是副本，外部 push 不会污染仓储", () => {
    const { repository } = setup();
    repository.create({ content: "唯一一条" });

    const snapshot = repository.list();
    snapshot.push({ id: "ghost" });

    expect(repository.list()).toHaveLength(1);
  });
});

describe("createPostRepository / create", () => {
  it("返回字段完整的普通对象", () => {
    const { repository, clock } = setup();
    const post = repository.create({ content: "你好，微光", author: "小明" });

    expect(post).toEqual({
      id: "post-1",
      author: "小明",
      content: "你好，微光",
      createdAt: clock.now(),
      likes: 0,
      likedByMe: false,
      bookmarks: 0,
      bookmarkedByMe: false,
      editedAt: null,
    });
  });

  it("内容去除首尾空白", () => {
    const { repository } = setup();
    expect(repository.create({ content: "   有空格   " }).content).toBe("有空格");
  });

  it("内容截断到 280 字", () => {
    const { repository } = setup();
    const post = repository.create({ content: "字".repeat(300) });
    expect(post.content).toHaveLength(280);
  });

  it("空内容返回 null 且不写入", () => {
    const { repository } = setup();
    expect(repository.create({ content: "   " })).toBeNull();
    expect(repository.create({ content: "" })).toBeNull();
    expect(repository.create({})).toBeNull();
    expect(repository.create()).toBeNull();
    expect(repository.list()).toEqual([]);
  });

  it("内容不是字符串时返回 null", () => {
    const { repository } = setup();
    expect(repository.create({ content: 42 })).toBeNull();
    expect(repository.create({ content: null })).toBeNull();
    expect(repository.list()).toEqual([]);
  });

  it("缺省昵称回退「我」", () => {
    const { repository } = setup();
    expect(repository.create({ content: "匿名" }).author).toBe("我");
  });

  it("昵称去空白并截断到 12 字", () => {
    const { repository } = setup();
    expect(repository.create({ content: "a", author: "  阿宝  " }).author).toBe("阿宝");
    expect(repository.create({ content: "b", author: "超长昵称超长昵称超长昵称" }).author).toHaveLength(12);
  });
});

describe("createPostRepository / get", () => {
  it("返回对应动态", () => {
    const { repository } = setup();
    const created = repository.create({ content: "查询我" });
    expect(repository.get(created.id)).toEqual(created);
  });

  it("不存在时返回 null", () => {
    const { repository } = setup();
    expect(repository.get("missing")).toBeNull();
  });
});

describe("createPostRepository / update", () => {
  it("id 不存在时返回 missing", () => {
    const { repository } = setup();
    expect(repository.update("missing", "内容")).toEqual({ status: "missing", post: null });
  });

  it("空内容返回 empty 且不落库", () => {
    const { repository } = setup();
    const created = repository.create({ content: "原文" });
    const result = repository.update(created.id, "   ");

    expect(result.status).toBe("empty");
    expect(result.post.id).toBe(created.id);
    expect(repository.get(created.id).content).toBe("原文");
  });

  it("内容未变化返回 unchanged 且不改 editedAt", () => {
    const { repository, clock } = setup();
    const created = repository.create({ content: "原文" });
    clock.advance(5000);
    const result = repository.update(created.id, "  原文  ");

    expect(result.status).toBe("unchanged");
    expect(result.post.editedAt).toBeNull();
    expect(result.post.content).toBe("原文");
  });

  it("内容变化返回 saved 并记录 editedAt", () => {
    const { repository, clock } = setup();
    const created = repository.create({ content: "原文" });
    clock.advance(5000);
    const result = repository.update(created.id, " 新内容 ");

    expect(result.status).toBe("saved");
    expect(result.post.content).toBe("新内容");
    expect(result.post.editedAt).toBe(clock.now());
    expect(repository.get(created.id).content).toBe("新内容");
    expect(repository.list()[0].content).toBe("新内容");
  });

  it("超长内容截断到 280 字", () => {
    const { repository } = setup();
    const created = repository.create({ content: "原文" });
    const result = repository.update(created.id, "改".repeat(400));

    expect(result.status).toBe("saved");
    expect(result.post.content).toHaveLength(280);
  });
});

describe("createPostRepository / remove", () => {
  it("删除已存在的动态返回 true", () => {
    const { repository } = setup();
    const created = repository.create({ content: "待删除" });

    expect(repository.remove(created.id)).toBe(true);
    expect(repository.get(created.id)).toBeNull();
    expect(repository.list()).toEqual([]);
  });

  it("删除不存在的动态返回 false", () => {
    const { repository } = setup();
    expect(repository.remove("missing")).toBe(false);
  });
});

describe("createPostRepository / setLike", () => {
  it("liked=true 返回点赞态", () => {
    const { repository } = setup();
    const created = repository.create({ content: "点赞" });
    const liked = repository.setLike(created.id, true);

    expect(liked.likedByMe).toBe(true);
    expect(liked.likes).toBe(1);
    expect(repository.get(created.id).likes).toBe(1);
  });

  it("重复 liked=true 幂等", () => {
    const { repository } = setup();
    const created = repository.create({ content: "点赞" });
    repository.setLike(created.id, true);
    const again = repository.setLike(created.id, true);

    expect(again.likes).toBe(1);
    expect(again.likedByMe).toBe(true);
  });

  it("liked=false 撤销点赞并幂等", () => {
    const { repository } = setup();
    const created = repository.create({ content: "点赞" });
    repository.setLike(created.id, true);

    expect(repository.setLike(created.id, false).likes).toBe(0);
    const again = repository.setLike(created.id, false);
    expect(again.likes).toBe(0);
    expect(again.likedByMe).toBe(false);
  });

  it("id 不存在时返回 null", () => {
    const { repository } = setup();
    expect(repository.setLike("missing", true)).toBeNull();
  });
});

describe("createPostRepository / setBookmark", () => {
  it("bookmarked=true 返回收藏态", () => {
    const { repository } = setup();
    const created = repository.create({ content: "收藏我" });
    const bookmarked = repository.setBookmark(created.id, true);

    expect(bookmarked.bookmarkedByMe).toBe(true);
    expect(bookmarked.bookmarks).toBe(1);
    expect(repository.get(created.id).bookmarks).toBe(1);
  });

  it("重复收藏幂等", () => {
    const { repository } = setup();
    const created = repository.create({ content: "收藏我" });
    repository.setBookmark(created.id, true);
    const again = repository.setBookmark(created.id, true);

    expect(again.bookmarks).toBe(1);
    expect(again.bookmarkedByMe).toBe(true);
  });

  it("取消收藏并幂等", () => {
    const { repository } = setup();
    const created = repository.create({ content: "收藏我" });
    repository.setBookmark(created.id, true);

    expect(repository.setBookmark(created.id, false).bookmarks).toBe(0);
    const again = repository.setBookmark(created.id, false);
    expect(again.bookmarks).toBe(0);
    expect(again.bookmarkedByMe).toBe(false);
  });

  it("收藏与点赞互不影响", () => {
    const { repository } = setup();
    const created = repository.create({ content: "两种互动" });

    repository.setLike(created.id, true);
    repository.setBookmark(created.id, true);
    const post = repository.setLike(created.id, false);

    expect(post).toMatchObject({
      likes: 0,
      likedByMe: false,
      bookmarks: 1,
      bookmarkedByMe: true,
    });
  });

  it("id 不存在时返回 null", () => {
    const { repository } = setup();
    expect(repository.setBookmark("missing", true)).toBeNull();
  });

  it("返回值是副本，外部修改不影响仓储", () => {
    const { repository } = setup();
    const created = repository.create({ content: "收藏我" });
    const bookmarked = repository.setBookmark(created.id, true);
    bookmarked.bookmarks = 99;

    expect(repository.get(created.id).bookmarks).toBe(1);
  });
});

describe("createPostRepository / profile", () => {
  it("未设置时为空字符串", () => {
    const { repository } = setup();
    expect(repository.getProfile()).toBe("");
  });

  it("setProfile 返回规范化后的昵称", () => {
    const { repository } = setup();
    expect(repository.setProfile("  阿宝  ")).toBe("阿宝");
    expect(repository.getProfile()).toBe("阿宝");
    expect(repository.setProfile("超长昵称超长昵称超长昵称")).toHaveLength(12);
  });

  it("空昵称回退「我」", () => {
    const { repository } = setup();
    expect(repository.setProfile("   ")).toBe("我");
  });
});

describe("createPostRepository / seed", () => {
  it("播种动态与昵称", () => {
    const { repository } = setup();
    repository.seed({
      posts: [
        { id: "a", content: "旧", createdAt: BASE_TIME - 60_000 },
        { id: "b", content: "新", createdAt: BASE_TIME - 1_000, likes: 3, likedByMe: true },
      ],
      author: " 小明 ",
    });

    expect(repository.list().map((post) => post.id)).toEqual(["b", "a"]);
    expect(repository.list()[0]).toEqual({
      id: "b",
      author: "我",
      content: "新",
      createdAt: BASE_TIME - 1_000,
      likes: 3,
      likedByMe: true,
      bookmarks: 0,
      bookmarkedByMe: false,
      editedAt: null,
    });
    expect(repository.getProfile()).toBe("小明");
  });

  it("播种收藏字段并保留", () => {
    const { repository } = setup();
    repository.seed({
      posts: [
        {
          id: "c",
          content: "已收藏",
          createdAt: BASE_TIME,
          bookmarks: 2,
          bookmarkedByMe: true,
        },
      ],
    });

    expect(repository.get("c")).toMatchObject({ bookmarks: 2, bookmarkedByMe: true });
  });

  it("跳过空内容条目", () => {
    const { repository } = setup();
    repository.seed({ posts: [{ id: "a", content: "   " }, { id: "b", content: "保留" }] });

    expect(repository.list().map((post) => post.id)).toEqual(["b"]);
  });

  it("重复播种会覆盖既有数据", () => {
    const { repository } = setup();
    repository.create({ content: "会被清掉" });
    repository.seed({ posts: [{ id: "keep", content: "只剩我" }], author: "" });

    expect(repository.list().map((post) => post.id)).toEqual(["keep"]);
    expect(repository.getProfile()).toBe("");
  });

  it("seed 无参数时清空仓储", () => {
    const { repository } = setup();
    repository.create({ content: "旧数据" });
    repository.seed();

    expect(repository.list()).toEqual([]);
  });
});

describe("createPostRepository / 隔离性", () => {
  it("修改返回的 Post 不影响内部状态", () => {
    const { repository } = setup();
    const created = repository.create({ content: "原始" });

    created.content = "被篡改";
    created.likes = 99;

    expect(repository.get(created.id).content).toBe("原始");
    expect(repository.get(created.id).likes).toBe(0);
    expect(repository.list()[0].content).toBe("原始");
  });

  it("修改 list 中的元素不影响内部状态", () => {
    const { repository } = setup();
    repository.create({ content: "原始" });

    repository.list()[0].content = "被篡改";

    expect(repository.list()[0].content).toBe("原始");
  });

  it("修改 setLike / update 的返回值不影响内部状态", () => {
    const { repository } = setup();
    const created = repository.create({ content: "原始" });

    const liked = repository.setLike(created.id, true);
    liked.likes = 42;
    const updated = repository.update(created.id, "新文");
    updated.post.content = "被篡改";

    expect(repository.get(created.id).likes).toBe(1);
    expect(repository.get(created.id).content).toBe("新文");
  });

  it("返回对象可被 structuredClone 且不含内部引用", () => {
    const { repository } = setup();
    repository.create({ content: "可克隆" });

    const cloned = structuredClone(repository.list());

    expect(cloned).toEqual(repository.list());
    expect(cloned[0]).not.toBe(repository.list()[0]);
  });
});
