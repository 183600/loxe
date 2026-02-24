import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCache } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Cache and Storage Integration', () => {
  let cache;
  let storage;

  beforeEach(async () => {
    cache = createCache();
    storage = createStorage('memory');
    await storage.open();
  });

  afterEach(async () => {
    cache.clear();
    await storage.close();
  });

  it('should create a cached storage layer', async () => {
    const cachedStorage = {
      async get(key) {
        // 先查缓存
        const cached = cache.get(key);
        if (cached !== undefined) return cached;
        
        // 从存储获取
        const value = await storage.get(key);
        if (value !== null) {
          cache.set(key, value);
        }
        return value;
      },
      
      async set(key, value) {
        await storage.put(key, value);
        cache.set(key, value);
      },
      
      async delete(key) {
        await storage.del(key);
        cache.delete(key);
      }
    };

    // 初始数据
    await cachedStorage.set('user:1', { id: 1, name: 'Alice' });
    
    // 第一次获取 - 从 storage
    const user1 = await cachedStorage.get('user:1');
    expect(user1.name).toBe('Alice');
    expect(cache.has('user:1')).toBe(true);
    
    // 第二次获取 - 从 cache
    const user2 = await cachedStorage.get('user:1');
    expect(user2).toBe(user1);
  });

  it('should handle cache miss and populate from storage', async () => {
    await storage.put('product:1', { id: 1, price: 100 });
    await storage.put('product:2', { id: 2, price: 200 });
    
    // 缓存为空
    expect(cache.get('product:1')).toBeUndefined();
    
    // 通过集成层获取
    const product1 = await storage.get('product:1');
    cache.set('product:1', product1);
    
    expect(cache.get('product:1')).toEqual({ id: 1, price: 100 });
  });

  it('should sync cache invalidation with storage updates', async () => {
    await storage.put('config:theme', 'dark');
    cache.set('config:theme', 'dark');
    
    expect(cache.get('config:theme')).toBe('dark');
    
    // 更新存储
    await storage.put('config:theme', 'light');
    // 使缓存失效
    cache.delete('config:theme');
    
    expect(cache.get('config:theme')).toBeUndefined();
    
    // 重新获取
    const theme = await storage.get('config:theme');
    cache.set('config:theme', theme);
    
    expect(cache.get('config:theme')).toBe('light');
  });

  it('should implement write-through caching pattern', async () => {
    const writeThroughCache = {
      async write(key, value) {
        // 先写存储
        await storage.put(key, value);
        // 再写缓存
        cache.set(key, value);
      },
      
      async read(key) {
        return cache.get(key) ?? await storage.get(key);
      }
    };

    await writeThroughCache.write('session:123', { userId: 1, token: 'abc' });
    
    // 验证两者都有数据
    const cached = cache.get('session:123');
    const stored = await storage.get('session:123');
    
    expect(cached).toEqual(stored);
    expect(cached.userId).toBe(1);
  });

  it('should implement write-behind caching pattern', async () => {
    const pendingWrites = [];
    
    const writeBehindCache = {
      async write(key, value) {
        // 立即写缓存
        cache.set(key, value);
        // 加入待写队列
        pendingWrites.push({ key, value });
      },
      
      async flush() {
        // 批量写入存储
        for (const { key, value } of pendingWrites) {
          await storage.put(key, value);
        }
        pendingWrites.length = 0;
      },
      
      async read(key) {
        return cache.get(key) ?? await storage.get(key);
      }
    };

    // 多次写入
    await writeBehindCache.write('counter', 1);
    await writeBehindCache.write('counter', 2);
    await writeBehindCache.write('counter', 3);
    
    // 缓存有最新值
    expect(cache.get('counter')).toBe(3);
    // 存储还没有
    expect(await storage.get('counter')).toBeNull();
    
    // 刷新到存储
    await writeBehindCache.flush();
    
    // 现在存储也有最新值
    expect(await storage.get('counter')).toBe(3);
  });

  it('should handle cache expiration with storage fallback', async () => {
    vi.useFakeTimers();
    
    await storage.put('temp:data', { value: 42 });
    
    // 设置带 TTL 的缓存
    const data = await storage.get('temp:data');
    cache.set('temp:data', data, 1000);
    
    expect(cache.get('temp:data')).toEqual({ value: 42 });
    
    // TTL 过期
    vi.advanceTimersByTime(1000);
    expect(cache.get('temp:data')).toBeUndefined();
    
    // 从存储重新加载
    const reloaded = await storage.get('temp:data');
    cache.set('temp:data', reloaded);
    
    expect(cache.get('temp:data')).toEqual({ value: 42 });
    
    vi.restoreAllMocks();
  });

  it('should batch load from storage into cache', async () => {
    // 准备存储数据
    await storage.put('user:1', { id: 1, name: 'Alice' });
    await storage.put('user:2', { id: 2, name: 'Bob' });
    await storage.put('user:3', { id: 3, name: 'Charlie' });
    
    // 批量加载
    const keys = ['user:1', 'user:2', 'user:3'];
    for (const key of keys) {
      const value = await storage.get(key);
      if (value) {
        cache.set(key, value);
      }
    }
    
    // 验证缓存
    expect(cache.get('user:1')).toEqual({ id: 1, name: 'Alice' });
    expect(cache.get('user:2')).toEqual({ id: 2, name: 'Bob' });
    expect(cache.get('user:3')).toEqual({ id: 3, name: 'Charlie' });
    expect(cache.size()).toBe(3);
  });

  it('should handle cache clear with storage persistence', async () => {
    await storage.put('persistent:data', { important: true });
    cache.set('persistent:data', { important: true });
    
    // 清除缓存
    cache.clear();
    
    // 缓存为空，但存储仍有数据
    expect(cache.size()).toBe(0);
    expect(await storage.get('persistent:data')).toEqual({ important: true });
    
    // 可以从存储恢复
    const restored = await storage.get('persistent:data');
    cache.set('persistent:data', restored);
    
    expect(cache.get('persistent:data')).toEqual({ important: true });
  });
});