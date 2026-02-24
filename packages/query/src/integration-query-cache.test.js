import { describe, it, expect, beforeEach } from 'vitest';
import { createQueryEngine } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Query + Cache', () => {
  let query;
  let cache;
  let dataStore;

  beforeEach(() => {
    cache = createCache();
    dataStore = new Map();
    
    dataStore.set('users', [
      { id: 1, name: 'Alice', status: 'active' },
      { id: 2, name: 'Bob', status: 'inactive' },
      { id: 3, name: 'Charlie', status: 'active' }
    ]);

    const ctx = {
      get: (name) => {
        if (name === 'data') {
          return {
            getData: (source) => dataStore.get(source) || []
          };
        }
        if (name === 'cache') {
          return cache;
        }
        throw new Error(`Service '${name}' not registered`);
      }
    };

    query = createQueryEngine(ctx);
  });

  it('should cache query results', () => {
    const cacheKey = JSON.stringify({ from: 'users', where: { status: 'active' } });
    
    const result1 = query({ from: 'users', where: { status: 'active' } });
    cache.set(cacheKey, result1);
    
    const cachedResult = cache.get(cacheKey);
    expect(cachedResult).toEqual(result1);
    expect(cachedResult).toHaveLength(2);
  });

  it('should return cached results when available', () => {
    const options = { from: 'users', where: { status: 'active' } };
    const cacheKey = JSON.stringify(options);
    
    const originalResult = query(options);
    cache.set(cacheKey, originalResult);
    
    const cachedResult = cache.get(cacheKey);
    expect(cachedResult).toBe(originalResult);
  });

  it('should invalidate cache when data changes', () => {
    const options = { from: 'users', where: { status: 'active' } };
    const cacheKey = JSON.stringify(options);
    
    const result1 = query(options);
    cache.set(cacheKey, result1);
    expect(cache.get(cacheKey)).toHaveLength(2);
    
    // 修改数据
    const users = dataStore.get('users');
    users.push({ id: 4, name: 'David', status: 'active' });
    
    // 清除缓存
    cache.delete(cacheKey);
    expect(cache.get(cacheKey)).toBeUndefined();
    
    // 重新查询
    const result2 = query(options);
    expect(result2).toHaveLength(3);
  });

  it('should support query with cache fallback', () => {
    const options = { from: 'users', where: { name: 'Alice' } };
    const cacheKey = JSON.stringify(options);
    
    // 缓存不存在时执行查询
    let result = cache.get(cacheKey);
    if (!result) {
      result = query(options);
      cache.set(cacheKey, result);
    }
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
    expect(cache.get(cacheKey)).toBe(result);
  });

  it('should support cache with TTL for query results', () => {
    const options = { from: 'users', where: { status: 'active' } };
    const cacheKey = JSON.stringify(options);
    
    const result = query(options);
    cache.set(cacheKey, result, 50);
    
    expect(cache.get(cacheKey)).toHaveLength(2);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get(cacheKey)).toBeUndefined();
        resolve();
      }, 60);
    });
  });

  it('should support batch query caching', () => {
    const queries = [
      { from: 'users', where: { status: 'active' } },
      { from: 'users', where: { status: 'inactive' } },
      { from: 'users', where: { name: 'Alice' } }
    ];
    
    queries.forEach(options => {
      const cacheKey = JSON.stringify(options);
      const result = query(options);
      cache.set(cacheKey, result);
    });
    
    expect(cache.size()).toBe(3);
    
    queries.forEach(options => {
      const cacheKey = JSON.stringify(options);
      const cached = cache.get(cacheKey);
      expect(cached).toBeDefined();
    });
  });

  it('should clear all query cache on demand', () => {
    const queries = [
      { from: 'users', where: { status: 'active' } },
      { from: 'users', where: { status: 'inactive' } }
    ];
    
    queries.forEach(options => {
      const cacheKey = JSON.stringify(options);
      const result = query(options);
      cache.set(cacheKey, result);
    });
    
    expect(cache.size()).toBe(2);
    
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});