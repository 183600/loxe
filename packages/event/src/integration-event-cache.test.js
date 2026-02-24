import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Event + Cache Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate event emitter with cache', () => {
    const event = createEventEmitter();
    const cache = createCache();
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const results = [];
    event.on('cache:get', (key) => {
      const value = cache.get(key);
      results.push({ key, value });
    });
    
    event.emit('cache:get', 'key1');
    event.emit('cache:get', 'key2');
    
    expect(results).toEqual([
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' }
    ]);
  });

  it('should create a cached event service', () => {
    const event = createEventEmitter();
    const cache = createCache();
    
    const service = {
      emitWithCache(eventName, data, ttl) {
        const cacheKey = `event:${eventName}`;
        cache.set(cacheKey, data, ttl);
        event.emit(eventName, data);
      },
      getCachedEvent(eventName) {
        return cache.get(`event:${eventName}`);
      },
      on: event.on.bind(event)
    };
    
    const results = [];
    service.on('test', (data) => results.push(data));
    
    service.emitWithCache('test', 'message1', 1000);
    expect(results).toEqual(['message1']);
    expect(service.getCachedEvent('test')).toBe('message1');
    
    vi.advanceTimersByTime(1000);
    expect(service.getCachedEvent('test')).toBeUndefined();
  });

  it('should handle cache invalidation on events', () => {
    const event = createEventEmitter();
    const cache = createCache();
    
    cache.set('user:123', { name: 'John', age: 30 });
    cache.set('user:456', { name: 'Jane', age: 25 });
    
    event.on('user:updated', (userId) => {
      cache.delete(`user:${userId}`);
    });
    
    expect(cache.get('user:123')).toEqual({ name: 'John', age: 30 });
    
    event.emit('user:updated', '123');
    
    expect(cache.get('user:123')).toBeUndefined();
    expect(cache.get('user:456')).toEqual({ name: 'Jane', age: 25 });
  });

  it('should cache event results with TTL', () => {
    const event = createEventEmitter();
    const cache = createCache();
    
    const service = {
      getOrFetch(key, fetchFn, ttl) {
        const cached = cache.get(key);
        if (cached !== undefined) {
          event.emit('cache:hit', { key, value: cached });
          return cached;
        }
        
        const value = fetchFn();
        cache.set(key, value, ttl);
        event.emit('cache:miss', { key, value });
        return value;
      },
      on: event.on.bind(event)
    };
    
    const results = [];
    service.on('cache:hit', (data) => results.push({ type: 'hit', ...data }));
    service.on('cache:miss', (data) => results.push({ type: 'miss', ...data }));
    
    // 第一次调用 - cache miss
    const value1 = service.getOrFetch('expensive', () => ({ data: 'computed' }), 1000);
    expect(value1).toEqual({ data: 'computed' });
    expect(results).toHaveLength(1);
    expect(results[0].type).toBe('miss');
    
    // 第二次调用 - cache hit
    const value2 = service.getOrFetch('expensive', () => ({ data: 'new' }), 1000);
    expect(value2).toEqual({ data: 'computed' });
    expect(results).toHaveLength(2);
    expect(results[1].type).toBe('hit');
    
    // TTL 过期后 - cache miss
    vi.advanceTimersByTime(1000);
    const value3 = service.getOrFetch('expensive', () => ({ data: 'recomputed' }), 1000);
    expect(value3).toEqual({ data: 'recomputed' });
    expect(results).toHaveLength(3);
    expect(results[2].type).toBe('miss');
  });
});
