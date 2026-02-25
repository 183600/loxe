import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCache } from './index.js';
import { createStorage, MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Cache + Storage', () => {
  let cache;
  let storage;

  beforeEach(async () => {
    vi.useFakeTimers();
    cache = createCache();
    storage = new MemoryStorage();
    await storage.open();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (storage) {
      await storage.close();
    }
  });

  it('should cache data loaded from storage', async () => {
    // 先将数据存储到持久化存储
    await storage.put('user:123', { id: 123, name: 'Alice', email: 'alice@example.com' });
    await storage.put('user:456', { id: 456, name: 'Bob', email: 'bob@example.com' });

    // 从存储加载数据并缓存
    const loadAndCache = async (key) => {
      const data = await storage.get(key);
      if (data) {
        cache.set(key, data, 5000);
        return data;
      }
      return null;
    };

    // 加载并缓存用户数据
    const user1 = await loadAndCache('user:123');
    const user2 = await loadAndCache('user:456');

    // 验证数据已加载
    expect(user1).toEqual({ id: 123, name: 'Alice', email: 'alice@example.com' });
    expect(user2).toEqual({ id: 456, name: 'Bob', email: 'bob@example.com' });

    // 验证数据已缓存
    expect(cache.get('user:123')).toEqual({ id: 123, name: 'Alice', email: 'alice@example.com' });
    expect(cache.get('user:456')).toEqual({ id: 456, name: 'Bob', email: 'bob@example.com' });
    expect(cache.size()).toBe(2);

    // 验证缓存命中（不从存储读取）
    const cachedUser1 = cache.get('user:123');
    expect(cachedUser1).toEqual({ id: 123, name: 'Alice', email: 'alice@example.com' });
  });

  it('should persist cached data back to storage', async () => {
    // 先将数据缓存
    cache.set('product:1', { id: 1, name: 'Widget', price: 9.99 });
    cache.set('product:2', { id: 2, name: 'Gadget', price: 19.99 });

    // 将缓存的数据持久化到存储
    const persistCache = async () => {
      const keys = cache.keys();
      for (const key of keys) {
        const data = cache.get(key);
        if (data) {
          await storage.put(key, data);
        }
      }
    };

    // 持久化缓存
    await persistCache();

    // 验证数据已持久化
    const product1 = await storage.get('product:1');
    const product2 = await storage.get('product:2');

    expect(product1).toEqual({ id: 1, name: 'Widget', price: 9.99 });
    expect(product2).toEqual({ id: 2, name: 'Gadget', price: 19.99 });

    // 验证存储中的数据可以扫描到
    const products = await storage.scan({ prefix: 'product:' });
    expect(products).toHaveLength(2);
    expect(products[0].key).toBe('product:1');
    expect(products[1].key).toBe('product:2');
  });
});