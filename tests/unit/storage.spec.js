import { describe, it, expect } from "vitest";
import {
  createLocalStorageAdapter,
  setStorageAdapter,
  getStorageAdapter,
  read,
  write,
  remove,
  probe,
} from "../../src/services/storage";
import {
  createMemoryStorageAdapter,
  createFailingWriteAdapter,
} from "../helpers/memoryStorage";

describe("createLocalStorageAdapter", () => {
  it("正常读写删", () => {
    const adapter = createLocalStorageAdapter(window.localStorage);

    expect(adapter.write("moment.test", "value")).toBe(true);
    expect(adapter.read("moment.test")).toBe("value");
    adapter.remove("moment.test");
    expect(adapter.read("moment.test")).toBeNull();
  });

  it("底层抛错时不向外抛出", () => {
    const throwing = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    };
    const adapter = createLocalStorageAdapter(throwing);

    expect(adapter.read("k")).toBeNull();
    expect(adapter.write("k", "v")).toBe(false);
    expect(() => adapter.remove("k")).not.toThrow();
    expect(adapter.probe()).toBe(false);
  });

  it("probe 在读写可用时返回 true 并清理探针键", () => {
    const memory = createMemoryStorageAdapter();
    const adapter = createLocalStorageAdapter(memoryBuiltFrom(memory));

    expect(adapter.probe()).toBe(true);
    expect(adapter.read("moment.probe")).toBeNull();
  });

  it("写入失败时 probe 返回 false", () => {
    const adapter = createLocalStorageAdapter(memoryBuiltFrom(createFailingWriteAdapter()));
    expect(adapter.probe()).toBe(false);
  });
});

describe("storage 模块", () => {
  it("可在运行时替换适配器，并代理全部操作", () => {
    const adapter = createMemoryStorageAdapter();
    setStorageAdapter(adapter);

    expect(getStorageAdapter()).toBe(adapter);
    expect(write("moment.x", "1")).toBe(true);
    expect(read("moment.x")).toBe("1");
    remove("moment.x");
    expect(read("moment.x")).toBeNull();
    expect(probe()).toBe(true);
  });

  it("适配器写入失败时 write 返回 false", () => {
    setStorageAdapter(createFailingWriteAdapter());
    expect(write("moment.x", "1")).toBe(false);
    expect(probe()).toBe(false);
  });
});

/** 把 StorageAdapter 适配成 Web Storage 形状，供 createLocalStorageAdapter 使用 */
function memoryBuiltFrom(adapter) {
  return {
    getItem: (key) => adapter.read(key),
    setItem: (key, value) => {
      if (!adapter.write(key, value)) {
        throw new Error("write failed");
      }
    },
    removeItem: (key) => adapter.remove(key),
  };
}
