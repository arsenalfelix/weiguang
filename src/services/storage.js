/** 存储服务：把 Web Storage 包装成可替换的适配器，任何异常都不外抛 */

/**
 * 基于 Web Storage（localStorage / sessionStorage）的适配器。
 * 传入对象为空或读写抛错时，全部操作安全降级。
 */
export function createLocalStorageAdapter(storage) {
  const hasStorage = Boolean(storage);

  return {
    read(key) {
      if (!hasStorage) {
        return null;
      }
      try {
        return storage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    write(key, value) {
      if (!hasStorage) {
        return false;
      }
      try {
        storage.setItem(key, String(value));
        return true;
      } catch (error) {
        return false;
      }
    },
    remove(key) {
      if (!hasStorage) {
        return;
      }
      try {
        storage.removeItem(key);
      } catch (error) {
        /* 忽略：存储不可用时无需清理 */
      }
    },
    probe() {
      const ok = this.write("moment.probe", "1") && this.read("moment.probe") === "1";
      this.remove("moment.probe");
      return ok;
    },
  };
}

function createDefaultAdapter() {
  if (typeof window !== "undefined" && window.localStorage) {
    return createLocalStorageAdapter(window.localStorage);
  }
  return createLocalStorageAdapter(null);
}

let adapter = createDefaultAdapter();

/** 运行时替换适配器（测试注入或降级场景使用） */
export function setStorageAdapter(next) {
  adapter = next;
  return adapter;
}

/** 读取当前适配器 */
export function getStorageAdapter() {
  return adapter;
}

export function read(key) {
  return adapter.read(key);
}

export function write(key, value) {
  return adapter.write(key, value);
}

export function remove(key) {
  adapter.remove(key);
}

/** 探测存储是否真正可写（隐私模式下可能抛错） */
export function probe() {
  return adapter.probe();
}

/** 读取 JSON；解析失败时清理脏数据并返回 fallback */
export function readJSON(key, fallback = null) {
  const raw = read(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    remove(key);
    return fallback;
  }
}

/** 写入 JSON，返回是否成功 */
export function writeJSON(key, value) {
  return write(key, JSON.stringify(value));
}
