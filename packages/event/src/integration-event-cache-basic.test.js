import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Event + Cache', () => {
  let event, cache;

  beforeEach(() => {
    vi.useFakeTimers();
    event = createEventEmitter();
    cache = createCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate event emitter with cache for reactive caching', () => {
    const results = [];
    
    // 监听数据变更事件
    event.on('data:changed', (key, value) => {
      cache.set(key, value);
      results.push({ action: 'cache', key, value });
    });
    
    // 模拟数据变更
    event.emit('data:changed', 'user:123', { name: 'Alice', id: 123 });
    
    expect(cache.get('user:123')).toEqual({ name: 'Alice', id: 123 });
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ 
      action: 'cache', 
      key: 'user:123', 
      value: { name: 'Alice', id: 123 } 
    });
  });

  it('should create a reactive cache service with event-driven updates', () => {
    const reactiveCache = {
      event,
      cache,
      
      set(key, value, ttl) {
        this.cache.set(key, value, ttl);
        this.event.emit('cache:set', { key, value, ttl });
      },
      
      get(key) {
        const value = this.cache.get(key);
        this.event.emit('cache:get', { key, value });
        return value;
      },
      
      delete(key) {
        this.cache.delete(key);
        this.event.emit('cache:delete', { key });
      },
      
      on(event, callback) {
        return this.event.on(event, callback);
      },
      
      emit(event, data) {
        this.event.emit(event, data);
      }
    };
    
    const events = [];
    reactiveCache.on('cache:set', (data) => events.push({ type: 'set', ...data }));
    reactiveCache.on('cache:get', (data) => events.push({ type: 'get', ...data }));
    reactiveCache.on('cache:delete', (data) => events.push({ type: 'delete', ...data }));
    
    reactiveCache.set('key1', 'value1', 1000);
    expect(reactiveCache.get('key1')).toBe('value1');
    reactiveCache.delete('key1');
    
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('set');
    expect(events[1].type).toBe('get');
    expect(events[2].type).toBe('delete');
  });

  it('should handle cache invalidation via events', () => {
    const invalidationPattern = 'user:';
    
    // 监听失效事件
    event.on('invalidate', (pattern) => {
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith(pattern)) {
          cache.delete(key);
        }
      });
    });
    
    // 添加一些缓存
    cache.set('user:123', { name: 'Alice' });
    cache.set('user:456', { name: 'Bob' });
    cache.set('product:789', { name: 'Widget' });
    
    expect(cache.keys()).toHaveLength(3);
    
    // 触发失效事件
    event.emit('invalidate', invalidationPattern);
    
    expect(cache.keys()).toHaveLength(1);
    expect(cache.get('user:123')).toBeUndefined();
    expect(cache.get('user:456')).toBeUndefined();
    expect(cache.get('product:789')).toEqual({ name: 'Widget' });
  });

  it('should support event-based cache warming', () => {
    const warmupEvents = [];
    
    // 监听缓存预热事件
    event.on('cache:warmup', (keys) => {
      keys.forEach(key => {
        const value = { data: `value-for-${key}`, timestamp: Date.now() };
        cache.set(key, value, 5000);
        warmupEvents.push(key);
      });
    });
    
    // 触发预热
    event.emit('cache:warmup', ['key1', 'key2', 'key3']);
    
    expect(warmupEvents).toEqual(['key1', 'key2', 'key3']);
    expect(cache.get('key1')).toEqual({ data: 'value-for-key1', timestamp: expect.any(Number) });
    expect(cache.get('key2')).toEqual({ data: 'value-for-key2', timestamp: expect.any(Number) });
    expect(cache.get('key3')).toEqual({ data: 'value-for-key3', timestamp: expect.any(Number) });
  });

  it('should handle cache hit/miss events', () => {
    const cacheStats = { hits: 0, misses: 0 };
    
    cache.set('existing-key', 'value');
    
    // 监听缓存命中事件
    event.on('cache:hit', (key) => {
      cacheStats.hits++;
    });
    
    // 监听缓存未命中事件
    event.on('cache:miss', (key) => {
      cacheStats.misses++;
    });
    
    // 模拟缓存访问
    const value = cache.get('existing-key');
    if (value !== undefined) {
      event.emit('cache:hit', 'existing-key');
    }
    
    const missing = cache.get('non-existing-key');
    if (missing === undefined) {
      event.emit('cache:miss', 'non-existing-key');
    }
    
    expect(cacheStats.hits).toBe(1);
    expect(cacheStats.misses).toBe(1);
  });

  it('should support wildcard-based cache invalidation', () => {
    cache.set('api:user:1', { id: 1, name: 'Alice' });
    cache.set('api:user:2', { id: 2, name: 'Bob' });
    cache.set('api:post:1', { id: 1, title: 'Hello' });
    cache.set('api:post:2', { id: 2, title: 'World' });
    
    // 监听通配符失效事件
    event.on('invalidate:api:*', (event, pattern) => {
      const keys = cache.keys();
      // pattern 现在是从 args 传递的，可能是 undefined
      // 从 event 中提取 pattern（去掉 'invalidate:' 前缀）
      const eventPattern = event.startsWith('invalidate:') ? event.substring('invalidate:'.length) : event;
      // 使用 eventPattern 作为前缀，去掉 '*' 后缀
      const prefix = eventPattern.endsWith('*') ? eventPattern.slice(0, -1) : eventPattern;
      keys.forEach(key => {
        if (key.startsWith(prefix)) {
          cache.delete(key);
        }
      });
    });
    
    expect(cache.keys()).toHaveLength(4);
    
    // 触发失效
    event.emit('invalidate:api:user:*');
    
    // 验证只有用户相关的缓存被清除
    expect(cache.keys()).toHaveLength(2);
    expect(cache.get('api:user:1')).toBeUndefined();
    expect(cache.get('api:user:2')).toBeUndefined();
    expect(cache.get('api:post:1')).toEqual({ id: 1, title: 'Hello' });
    expect(cache.get('api:post:2')).toEqual({ id: 2, title: 'World' });
  });

  it('should handle cache expiration events', () => {
    const expirationEvents = [];
    
    cache.set('temp-key', 'temp-value', 100);
    
    // 监听过期事件（需要手动触发）
    event.on('cache:expired', (key) => {
      expirationEvents.push(key);
    });
    
    // 模拟时间流逝
    vi.advanceTimersByTime(100);
    
    // 检查缓存是否过期
    const value = cache.get('temp-key');
    if (value === undefined) {
      event.emit('cache:expired', 'temp-key');
    }
    
    expect(value).toBeUndefined();
    expect(expirationEvents).toEqual(['temp-key']);
  });

  it('should support event-based cache statistics', () => {
    const stats = { sets: 0, gets: 0, deletes: 0 };
    
    // 监听所有缓存操作
    event.on('cache:*', (event, data) => {
      if (event === 'cache:set') stats.sets++;
      if (event === 'cache:get') stats.gets++;
      if (event === 'cache:delete') stats.deletes++;
    });
    
    // 执行缓存操作
    cache.set('key1', 'value1');
    event.emit('cache:set', { key: 'key1', value: 'value1' });
    
    cache.get('key1');
    event.emit('cache:get', { key: 'key1', value: 'value1' });
    
    cache.get('nonexistent');
    event.emit('cache:get', { key: 'nonexistent', value: undefined });
    
    cache.delete('key1');
    event.emit('cache:delete', { key: 'key1' });
    
    expect(stats.sets).toBe(1);
    expect(stats.gets).toBe(2);
    expect(stats.deletes).toBe(1);
  });
});