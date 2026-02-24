import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createCache } from '../../cache/src/index.js';
import { MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Core + Cache + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();
    storage = new MemoryStorage();
    await storage.open();

    // 注册存储服务
    core.register('storage', () => ({
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage.del(key)
    }), true);

    // 注册缓存服务
    core.register('cache', (ctx) => createCache(ctx), true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should cache storage reads', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 存储数据
    await storageService.put('user:1', { id: 1, name: 'Alice' });

    // 第一次读取（从存储）
    const user1 = await storageService.get('user:1');
    expect(user1).toEqual({ id: 1, name: 'Alice' });

    // 缓存结果
    cache.set('user:1', user1, 1000);

    // 第二次读取（从缓存）
    const cachedUser = cache.get('user:1');
    expect(cachedUser).toEqual({ id: 1, name: 'Alice' });
  });

  it('should invalidate cache on storage writes', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 存储并缓存数据
    await storageService.put('config:theme', 'dark');
    cache.set('config:theme', 'dark');

    expect(cache.get('config:theme')).toBe('dark');

    // 更新存储
    await storageService.put('config:theme', 'light');

    // 使缓存失效
    cache.delete('config:theme');

    // 缓存应该已清空
    expect(cache.get('config:theme')).toBeUndefined();

    // 从存储获取新值
    const newValue = await storageService.get('config:theme');
    expect(newValue).toBe('light');
  });

  it('should handle cache TTL expiration', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 存储数据
    await storageService.put('session:123', { userId: 1, token: 'abc' });

    // 缓存数据，设置短 TTL
    cache.set('session:123', { userId: 1, token: 'abc' }, 100);

    // 立即获取应该成功
    expect(cache.get('session:123')).toEqual({ userId: 1, token: 'abc' });

    // 等待 TTL 过期（使用 setTimeout 模拟）
    await new Promise(resolve => setTimeout(resolve, 150));

    // TTL 过期后应该返回 undefined
    expect(cache.get('session:123')).toBeUndefined();
  });

  it('should support cache warming on startup', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 预先存储一些数据
    await storageService.put('config:apiUrl', 'https://api.example.com');
    await storageService.put('config:timeout', 5000);
    await storageService.put('config:retries', 3);

    // 缓存预热：从存储加载常用配置到缓存
    const warmCache = async () => {
      const keys = ['config:apiUrl', 'config:timeout', 'config:retries'];
      for (const key of keys) {
        const value = await storageService.get(key);
        if (value !== null) {
          cache.set(key, value, 60000); // 1分钟 TTL
        }
      }
    };

    await warmCache();

    // 验证缓存已预热
    expect(cache.get('config:apiUrl')).toBe('https://api.example.com');
    expect(cache.get('config:timeout')).toBe(5000);
    expect(cache.get('config:retries')).toBe(3);
  });

  it('should handle cache misses gracefully', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 尝试从缓存获取不存在的数据
    const cachedValue = cache.get('nonexistent:key');
    expect(cachedValue).toBeUndefined();

    // 从存储获取
    const storedValue = await storageService.get('nonexistent:key');
    expect(storedValue).toBeNull();

    // 实现 cache-aside 模式
    const getWithCache = async (key) => {
      // 先查缓存
      let value = cache.get(key);
      if (value !== undefined) {
        return value;
      }

      // 缓存未命中，查存储
      value = await storageService.get(key);
      if (value !== null) {
        cache.set(key, value, 1000);
      }

      return value;
    };

    // 测试缓存未命中
    const result = await getWithCache('new:key');
    expect(result).toBeNull();
  });

  it('should support bulk cache operations', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 批量存储数据
    const users = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Charlie' }
    ];

    for (const user of users) {
      await storageService.put(`user:${user.id}`, user);
    }

    // 批量缓存
    users.forEach(user => {
      cache.set(`user:${user.id}`, user, 1000);
    });

    // 验证批量缓存
    expect(cache.size()).toBe(3);
    expect(cache.get('user:1')).toEqual({ id: 1, name: 'Alice' });
    expect(cache.get('user:2')).toEqual({ id: 2, name: 'Bob' });
    expect(cache.get('user:3')).toEqual({ id: 3, name: 'Charlie' });
  });

  it('should clear cache selectively', async () => {
    const cache = core.get('cache');
    const storageService = core.get('storage');

    // 存储不同类型的数据
    await storageService.put('user:1', { id: 1, name: 'Alice' });
    await storageService.put('session:123', { userId: 1, token: 'abc' });
    await storageService.put('config:theme', 'dark');

    // 缓存所有数据
    cache.set('user:1', { id: 1, name: 'Alice' });
    cache.set('session:123', { userId: 1, token: 'abc' });
    cache.set('config:theme', 'dark');

    expect(cache.size()).toBe(3);

    // 选择性清除：只清除会话缓存
    cache.delete('session:123');

    expect(cache.size()).toBe(2);
    expect(cache.get('user:1')).toBeDefined();
    expect(cache.get('session:123')).toBeUndefined();
    expect(cache.get('config:theme')).toBeDefined();
  });

  it('should handle cache size limits', async () => {
    const cache = core.get('cache');

    // 设置大量缓存项
    for (let i = 0; i < 100; i++) {
      cache.set(`key:${i}`, { value: i }, 1000);
    }

    // 验证缓存大小
    expect(cache.size()).toBe(100);

    // 获取所有键
    const keys = cache.keys();
    expect(keys).toHaveLength(100);
    expect(keys[0]).toBe('key:0');
    expect(keys[99]).toBe('key:99');
  });
});