/**
 * 内存缓存实现
 * 支持 TTL 过期和基本操作
 */

export function createCache(ctx) {
  const cache = new Map();
  const timers = new Map();

  const cacheApi = {
    get(key) {
      const entry = cache.get(key);
      if (!entry) return undefined;
      
      // 检查是否过期
      if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
        this.delete(key);
        return undefined;
      }
      
      return entry.value;
    },

    set(key, value, ttl) {
      // 清除旧定时器
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }

      const numTtl = ttl !== undefined && ttl !== null ? Number(ttl) : undefined;
      
      // TTL 为负数时立即过期
      if (numTtl !== undefined && numTtl < 0) {
        return this;
      }

      cache.set(key, { value, timestamp: Date.now(), ttl: numTtl });

      // 设置定时器（仅当 ttl 有效时）
      if (numTtl !== undefined) {
        const timer = setTimeout(() => {
          this.delete(key);
        }, numTtl);
        timers.set(key, timer);
      }

      return this;
    },

    has(key) {
      return cache.has(key);
    },

    delete(key) {
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }
      return cache.delete(key);
    },

    clear() {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      cache.clear();
    },

    size() {
      return cache.size;
    },

    keys() {
      return Array.from(cache.keys());
    }
  };

  return cacheApi;
}

export default createCache;
