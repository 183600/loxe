import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createCore } from './index.js';
import { createQueryEngine } from '../../query/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Query + Cache', () => {
  let core;

  beforeEach(() => {
    core = createCore();

    // 注册缓存服务
    core.register('cache', (ctx) => createCache(ctx), true);

    // 注册查询服务
    core.register('query', (ctx) => createQueryEngine(ctx), true);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should cache query results', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 },
      { id: 3, name: 'Charlie', age: 35 }
    ];

    const cacheKey = 'query:users:age_gt_30';
    const result = query({ from: data, where: { age: { $gt: 30 } } });

    // 缓存查询结果
    cache.set(cacheKey, result, 5000);

    // 从缓存获取结果
    const cachedResult = cache.get(cacheKey);
    expect(cachedResult).toEqual(result);
    expect(cachedResult).toHaveLength(1);
    expect(cachedResult[0].name).toBe('Charlie');
  });

  it('should invalidate cache on data changes', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ];

    const cacheKey = 'query:users:all';
    const initialResult = query({ from: data });
    cache.set(cacheKey, initialResult);

    // 修改数据
    data.push({ id: 3, name: 'Charlie', age: 35 });

    // 清除缓存
    cache.delete(cacheKey);

    // 重新查询
    const newResult = query({ from: data });
    expect(newResult).toHaveLength(3);
    expect(cache.get(cacheKey)).toBeUndefined();
  });

  it('should support TTL for cached query results', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ];

    const cacheKey = 'query:users:short_lived';
    const result = query({ from: data, where: { age: { $gte: 25 } } });

    // 设置短 TTL
    cache.set(cacheKey, result, 100);

    // 立即获取应该存在
    expect(cache.get(cacheKey)).toEqual(result);

    // 等待 TTL 过期
    vi.useFakeTimers();
    vi.advanceTimersByTime(150);

    // 缓存应该已过期
    expect(cache.get(cacheKey)).toBeUndefined();
    vi.useRealTimers();
  });

  it('should cache complex query results', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30, city: 'New York', active: true },
      { id: 2, name: 'Bob', age: 25, city: 'Los Angeles', active: false },
      { id: 3, name: 'Charlie', age: 35, city: 'New York', active: true }
    ];

    const cacheKey = 'query:users:complex';
    const result = query({
      from: data,
      where: (user) => user.city === 'New York' && user.active && user.age > 25
    });

    cache.set(cacheKey, result);

    const cachedResult = cache.get(cacheKey);
    expect(cachedResult).toHaveLength(2);
    expect(cachedResult.map(u => u.name)).toEqual(['Alice', 'Charlie']);
  });

  it('should handle cache misses gracefully', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ];

    const cacheKey = 'query:users:nonexistent';

    // 尝试获取不存在的缓存
    const cachedResult = cache.get(cacheKey);
    expect(cachedResult).toBeUndefined();

    // 执行查询并缓存
    const result = query({ from: data });
    cache.set(cacheKey, result);

    // 现在应该能获取到
    expect(cache.get(cacheKey)).toEqual(result);
  });

  it('should support clearing all query caches', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ];

    // 缓存多个查询结果
    cache.set('query:users:all', query({ from: data }));
    cache.set('query:users:active', query({ from: data, where: { age: { $gte: 25 } } }));
    cache.set('query:users:young', query({ from: data, where: { age: { $lt: 30 } } }));

    expect(cache.size()).toBe(3);

    // 清除所有缓存
    cache.clear();

    expect(cache.size()).toBe(0);
    expect(cache.get('query:users:all')).toBeUndefined();
  });

  it('should support cache key generation based on query params', () => {
    const query = core.get('query');
    const cache = core.get('cache');

    const data = [
      { id: 1, name: 'Alice', age: 30 },
      { id: 2, name: 'Bob', age: 25 }
    ];

    // 生成缓存键的辅助函数
    const generateCacheKey = (from, where) => {
      const whereStr = where ? JSON.stringify(where) : 'none';
      return `query:${from}:${Buffer.from(whereStr).toString('base64')}`;
    };

    const where1 = { age: { $gte: 25 } };
    const where2 = { age: { $lt: 30 } };

    const key1 = generateCacheKey('users', where1);
    const key2 = generateCacheKey('users', where2);

    cache.set(key1, query({ from: data, where: where1 }));
    cache.set(key2, query({ from: data, where: where2 }));

    expect(cache.get(key1)).toHaveLength(2);
    expect(cache.get(key2)).toHaveLength(1);
  });
});
