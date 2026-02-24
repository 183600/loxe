import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { MemoryStorage } from '../../storage/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Storage + Cache', () => {
  let core;
  let storage;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (storage) {
      await storage.close();
    }
  });

  it('should cache storage results to improve performance', async () => {
    core = createCore();

    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      get: async (key) => storage.get(key),
      put: async (key, value) => storage.put(key, value)
    }), true);

    core.register('cache', createCache, true);

    core.register('cachedStorage', (ctx) => {
      const storage = ctx.get('storage');
      const cache = ctx.get('cache');

      return {
        async get(key) {
          // 先检查缓存
          const cached = cache.get(key);
          if (cached !== undefined) {
            return cached;
          }

          // 从存储获取
          const value = await storage.get(key);
          if (value !== null) {
            cache.set(key, value, 5000); // 缓存 5 秒
          }
          return value;
        },

        async put(key, value) {
          // 写入存储
          await storage.put(key, value);
          // 更新缓存
          cache.set(key, value, 5000);
        }
      };
    }, true);

    const cachedStorage = core.get('cachedStorage');

    // 第一次获取 - 从存储读取
    await cachedStorage.put('user:1', { name: 'Alice', age: 30 });
    let result = await cachedStorage.get('user:1');
    expect(result).toEqual({ name: 'Alice', age: 30 });

    // 第二次获取 - 从缓存读取
    result = await cachedStorage.get('user:1');
    expect(result).toEqual({ name: 'Alice', age: 30 });

    // 缓存过期后
    vi.advanceTimersByTime(5000);
    result = await cachedStorage.get('user:1');
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('should invalidate cache when storage data is updated', async () => {
    core = createCore();

    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      get: async (key) => storage.get(key),
      put: async (key, value) => storage.put(key, value)
    }), true);

    core.register('cache', createCache, true);

    core.register('invalidatingCachedStorage', (ctx) => {
      const storage = ctx.get('storage');
      const cache = ctx.get('cache');

      return {
        async get(key) {
          const cached = cache.get(key);
          if (cached !== undefined) {
            return cached;
          }
          const value = await storage.get(key);
          if (value !== null) {
            cache.set(key, value);
          }
          return value;
        },

        async put(key, value) {
          await storage.put(key, value);
          cache.delete(key); // 更新时失效缓存
        }
      };
    }, true);

    const service = core.get('invalidatingCachedStorage');

    // 存储并缓存数据
    await service.put('data:1', { value: 'original' });
    let result = await service.get('data:1');
    expect(result).toEqual({ value: 'original' });

    // 更新数据
    await service.put('data:1', { value: 'updated' });

    // 再次获取应该得到更新后的值
    result = await service.get('data:1');
    expect(result).toEqual({ value: 'updated' });
  });

  it('should handle cache warming for frequently accessed storage data', async () => {
    core = createCore();

    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      get: async (key) => storage.get(key),
      put: async (key, value) => storage.put(key, value)
    }), true);

    core.register('cache', createCache, true);

    core.register('cacheWarmer', (ctx) => {
      const storage = ctx.get('storage');
      const cache = ctx.get('cache');

      return {
        async warmUp(keys) {
          for (const key of keys) {
            const value = await storage.get(key);
            if (value !== null) {
              cache.set(key, value);
            }
          }
        },

        async get(key) {
          return cache.get(key);
        },

        async put(key, value) {
          await storage.put(key, value);
          cache.set(key, value);
        }
      };
    }, true);

    const service = core.get('cacheWarmer');

    // 预先存储数据
    await service.put('config:app', { name: 'MyApp', version: '1.0' });
    await service.put('config:db', { host: 'localhost', port: 5432 });

    // 预热缓存
    await service.warmUp(['config:app', 'config:db']);

    // 从缓存获取
    expect(await service.get('config:app')).toEqual({ name: 'MyApp', version: '1.0' });
    expect(await service.get('config:db')).toEqual({ host: 'localhost', port: 5432 });
  });
});