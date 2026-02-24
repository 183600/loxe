import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Core + Event + Cache Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate core with event emitter and cache', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    const event = core.get('event');
    const cache = core.get('cache');
    
    cache.set('key', 'value');
    
    const results = [];
    event.on('test', (data) => {
      results.push(data);
      const cached = cache.get('key');
      results.push(cached);
    });
    
    event.emit('test', 'hello');
    
    expect(results).toEqual(['hello', 'value']);
  });

  it('should create an event-driven cache service', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    core.register('eventCache', (ctx) => {
      const event = ctx.get('event');
      const cache = ctx.get('cache');
      
      return {
        set(key, value, ttl) {
          cache.set(key, value, ttl);
          event.emit('cache:set', { key, value, ttl });
        },
        get(key) {
          const value = cache.get(key);
          event.emit('cache:get', { key, value });
          return value;
        },
        delete(key) {
          cache.delete(key);
          event.emit('cache:delete', { key });
        },
        on: event.on.bind(event)
      };
    }, true);
    
    const service = core.get('eventCache');
    const events = [];
    
    service.on('cache:set', (data) => events.push({ type: 'set', ...data }));
    service.on('cache:get', (data) => events.push({ type: 'get', ...data }));
    service.on('cache:delete', (data) => events.push({ type: 'delete', ...data }));
    
    service.set('key1', 'value1', 1000);
    expect(service.get('key1')).toBe('value1');
    service.delete('key1');
    
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'set', key: 'key1', value: 'value1', ttl: 1000 });
    expect(events[1]).toEqual({ type: 'get', key: 'key1', value: 'value1' });
    expect(events[2]).toEqual({ type: 'delete', key: 'key1' });
  });

  it('should handle cache invalidation via events', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    core.register('invalidatingCache', (ctx) => {
      const event = ctx.get('event');
      const cache = ctx.get('cache');
      
      // 监听失效事件
      event.on('invalidate', (pattern) => {
        const keys = cache.keys();
        keys.forEach(key => {
          if (key.startsWith(pattern)) {
            cache.delete(key);
          }
        });
      });
      
      return {
        set(key, value) {
          cache.set(key, value);
        },
        get(key) {
          return cache.get(key);
        },
        invalidate(pattern) {
          event.emit('invalidate', pattern);
        },
        keys: cache.keys.bind(cache)
      };
    }, true);
    
    const service = core.get('invalidatingCache');
    
    service.set('user:123', { name: 'John' });
    service.set('user:456', { name: 'Jane' });
    service.set('product:789', { name: 'Widget' });
    
    expect(service.keys()).toHaveLength(3);
    
    service.invalidate('user:');
    
    expect(service.keys()).toHaveLength(1);
    expect(service.get('user:123')).toBeUndefined();
    expect(service.get('user:456')).toBeUndefined();
    expect(service.get('product:789')).toEqual({ name: 'Widget' });
  });

  it('should cache event results with automatic expiration', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    core.register('cachedEventService', (ctx) => {
      const event = ctx.get('event');
      const cache = ctx.get('cache');
      
      return {
        subscribe(eventName, callback, ttl) {
          const cacheKey = `sub:${eventName}`;
          const subscription = event.on(eventName, callback);
          cache.set(cacheKey, { active: true, timestamp: Date.now() }, ttl);
          
          return {
            unsubscribe: () => {
              subscription();
              cache.delete(cacheKey);
              event.emit('subscription:expired', { eventName });
            }
          };
        },
        emit: event.emit.bind(event),
        hasSubscription: (eventName) => cache.has(`sub:${eventName}`)
      };
    }, true);
    
    const service = core.get('cachedEventService');
    const results = [];
    
    const sub = service.subscribe('test', (data) => results.push(data), 1000);
    
    expect(service.hasSubscription('test')).toBe(true);
    
    service.emit('test', 'message1');
    expect(results).toEqual(['message1']);
    
    vi.advanceTimersByTime(1000);
    
    expect(service.hasSubscription('test')).toBe(false);
    
    // 订阅已过期，但监听器仍然存在（因为没有自动移除）
    // 这个测试验证缓存过期，而不是监听器移除
    service.emit('test', 'message2');
    expect(results).toEqual(['message1', 'message2']);
  });
});
