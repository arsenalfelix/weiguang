// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/services/api.js";
import { createTestApi } from "../helpers/testApi.js";

const SEEDED_POST = {
  id: "seed-1",
  author: "旧友",
  content: "种子动态",
  createdAt: 1_700_000_000_000,
  likes: 2,
  likedByMe: false,
  editedAt: null,
};

describe("createTestApi", () => {
  it("暴露 app / repository / client 三件套", () => {
    const api = createTestApi();

    expect(typeof api.app.request).toBe("function");
    expect(typeof api.repository.list).toBe("function");
    expect(typeof api.client.listPosts).toBe("function");
  });

  it("种子数据通过 client.listPosts 可读", async () => {
    const { client } = createTestApi({ posts: [SEEDED_POST], author: "旧友" });

    expect(await client.listPosts()).toEqual([SEEDED_POST]);
    expect(await client.getProfile()).toBe("旧友");
  });

  it("client 的写操作直接落到同一仓储", async () => {
    const { client, repository } = createTestApi();
    const post = await client.createPost({ content: "  新建  ", author: "小明" });

    expect(post.content).toBe("新建");
    expect(post.author).toBe("小明");
    expect(repository.list()).toHaveLength(1);
    expect(await client.getProfile()).toBe("小明");
  });

  it("点赞 / 取消点赞返回最新 post", async () => {
    const { client } = createTestApi({ posts: [SEEDED_POST] });

    const liked = await client.setLike(SEEDED_POST.id, true);
    expect(liked.likedByMe).toBe(true);
    expect(liked.likes).toBe(3);

    const unliked = await client.setLike(SEEDED_POST.id, false);
    expect(unliked.likedByMe).toBe(false);
    expect(unliked.likes).toBe(2);
  });

  it("编辑返回 { post, changed }", async () => {
    const { client } = createTestApi({ posts: [SEEDED_POST] });

    const same = await client.updatePost(SEEDED_POST.id, "种子动态");
    expect(same.changed).toBe(false);

    const changed = await client.updatePost(SEEDED_POST.id, "改好了");
    expect(changed.changed).toBe(true);
    expect(changed.post.content).toBe("改好了");
  });

  it("删除后查询抛 ApiError(POST_NOT_FOUND)", async () => {
    const { client } = createTestApi({ posts: [SEEDED_POST] });
    await client.deletePost(SEEDED_POST.id);

    const error = await client.getPost(SEEDED_POST.id).catch((reason) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.code).toBe("POST_NOT_FOUND");
  });

  it("health 可用", async () => {
    const { client } = createTestApi();
    expect(await client.health()).toEqual({ status: "ok" });
  });
});
