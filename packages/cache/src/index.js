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
      return entry ? entry.value : undefined;
    },

    set(key, value, ttl) {
      // 清除旧的定时器
      if (timers.has(key)) {
        clearTimeout(timers.get(key));
        timers.delete(key);
      }

      cache.set(key, { value, timestamp: Date.now() });

      // 设置 TTL
      if (typeof ttl === 'number') {
        const timer = setTimeout(() => {
          this.delete(key);
        }, ttl);
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
