/**
 * 内存版 StorageAdapter：用于测试隔离，避免触碰真实 localStorage。
 * 与生产适配器保持同一契约：read / write / remove / probe。
 */
export function createMemoryStorageAdapter(initial = {}) {
  const map = new Map(Object.entries(initial));

  return {
    read(key) {
      return map.has(key) ? map.get(key) : null;
    },
    write(key, value) {
      map.set(key, String(value));
      return true;
    },
    remove(key) {
      map.delete(key);
    },
    probe() {
      const probeKey = "moment.probe";
      const ok = this.write(probeKey, "1") && this.read(probeKey) === "1";
      this.remove(probeKey);
      return ok;
    },
    /** 仅测试使用：读取底层数据 */
    dump() {
      return Object.fromEntries(map);
    },
  };
}

/** 写入始终失败的适配器，用于验证降级逻辑 */
export function createFailingWriteAdapter() {
  const adapter = createMemoryStorageAdapter();
  return {
    ...adapter,
    write() {
      return false;
    },
  };
}
