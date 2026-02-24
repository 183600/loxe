import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCore } from '../core/src/index.js';
import { createEventEmitter } from '../event/src/index.js';
import { createCache } from '../cache/src/index.js';

describe('Core + Event + Cache Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate core with event emitter', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    
    const emitter = core.get('event');
    let received = null;
    
    emitter.on('test', (data) => { received = data; });
    emitter.emit('test', 'hello world');
    
    expect(received).toBe('hello world');
  });

  it('should integrate core with cache', () => {
    const core = createCore();
    
    core.register('cache', createCache, true);
    
    const cache = core.get('cache');
    cache.set('key', 'value');
    
    expect(cache.get('key')).toBe('value');
    expect(cache.has('key')).toBe(true);
  });

  it('should use event emitter to notify cache changes', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    const event = core.get('event');
    const cache = core.get('cache');
    
    const changes = [];
    event.on('cache:set', (data) => { changes.push({ type: 'set', ...data }); });
    event.on('cache:delete', (key) => { changes.push({ type: 'delete', key }); });
    
    cache.set('key1', 'value1');
    event.emit('cache:set', { key: 'key1', value: 'value1' });
    
    cache.set('key2', 'value2');
    event.emit('cache:set', { key: 'key2', value: 'value2' });
    
    cache.delete('key1');
    event.emit('cache:delete', 'key1');
    
    expect(changes).toHaveLength(3);
    expect(changes[0]).toEqual({ type: 'set', key: 'key1', value: 'value1' });
    expect(changes[1]).toEqual({ type: 'set', key: 'key2', value: 'value2' });
    expect(changes[2]).toEqual({ type: 'delete', key: 'key1' });
  });

  it('should create a cached event service', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    core.register('cachedEvent', (ctx) => {
      const event = ctx.get('event');
      const cache = ctx.get('cache');
      
      return {
        emitCached(key, data, ttl) {
          cache.set(key, data, ttl);
          event.emit(key, data);
        },
        getCached(key) {
          return cache.get(key);
        }
      };
    }, true);
    
    const service = core.get('cachedEvent');
    
    let received = null;
    core.get('event').on('user:login', (data) => { received = data; });
    
    service.emitCached('user:login', { userId: 123 }, 1000);
    
    expect(received).toEqual({ userId: 123 });
    expect(service.getCached('user:login')).toEqual({ userId: 123 });
  });

  it('should handle cache TTL with event notifications', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('cache', createCache, true);
    
    const event = core.get('event');
    const cache = core.get('cache');
    
    const expiredKeys = [];
    event.on('cache:expired', (key) => { expiredKeys.push(key); });
    
    cache.set('temp', 'data', 1000);
    
    vi.advanceTimersByTime(1000);
    
    expect(cache.get('temp')).toBeUndefined();
    event.emit('cache:expired', 'temp');
    
    expect(expiredKeys).toContain('temp');
  });
});