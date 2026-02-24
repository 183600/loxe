import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Cache', () => {
  let core;

  beforeEach(() => {
    core = createCore();
    core.register('cache', () => createCache(), true);
  });

  it('should provide cache service through core', () => {
    const cache = core.get('cache');
    expect(cache).toBeDefined();
    expect(typeof cache.get).toBe('function');
    expect(typeof cache.set).toBe('function');
  });

  it('should store and retrieve values via cache', () => {
    const cache = core.get('cache');
    
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
    
    cache.set('key2', { data: 123 });
    expect(cache.get('key2')).toEqual({ data: 123 });
  });

  it('should return same cache instance for singleton', () => {
    const cache1 = core.get('cache');
    const cache2 = core.get('cache');
    expect(cache1).toBe(cache2);
  });

  it('should support TTL expiration', () => {
    const cache = core.get('cache');
    
    cache.set('temp', 'value', 10);
    expect(cache.get('temp')).toBe('value');
    
    // 等待过期
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('temp')).toBeUndefined();
        resolve();
      }, 20);
    });
  });

  it('should clear all cache entries', () => {
    const cache = core.get('cache');
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    expect(cache.size()).toBe(3);
    
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
  });

  it('should support service with cache dependency', () => {
    core.register('userService', (ctx) => {
      const cache = ctx.get('cache');
      return {
        getUser: (id) => {
          const cached = cache.get(`user:${id}`);
          if (cached) return cached;
          
          const user = { id, name: `User${id}` };
          cache.set(`user:${id}`, user);
          return user;
        },
        clearCache: () => cache.clear()
      };
    }, true);

    const userService = core.get('userService');
    
    const user1 = userService.getUser(1);
    const user2 = userService.getUser(1);
    
    expect(user1).toBe(user2);
    expect(user1.name).toBe('User1');
  });
});