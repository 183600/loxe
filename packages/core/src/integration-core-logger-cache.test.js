import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createLogger } from '../../logger/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Core + Logger + Cache Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate core with logger and cache', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    const logger = core.get('logger');
    const cache = core.get('cache');
    
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
    
    const spy = vi.spyOn(console, 'log');
    logger.info('cache operation completed');
    expect(spy).toHaveBeenCalled();
  });

  it('should log cache operations', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    const logger = core.get('logger');
    const cache = core.get('cache');
    
    const spy = vi.spyOn(console, 'log');
    
    cache.set('key1', 'value1');
    logger.info('cache:set', { key: 'key1', value: 'value1' });
    
    cache.set('key2', 'value2');
    logger.info('cache:set', { key: 'key2', value: 'value2' });
    
    const value = cache.get('key1');
    logger.info('cache:get', { key: 'key1', value });
    
    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0][0]).toContain('cache:set');
    expect(spy.mock.calls[1][0]).toContain('cache:set');
    expect(spy.mock.calls[2][0]).toContain('cache:get');
  });

  it('should create a cached logger service', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    core.register('cachedLogger', (ctx) => {
      const logger = ctx.get('logger');
      const cache = ctx.get('cache');
      
      return {
        log(key, message, ttl) {
          const cacheKey = `log:${key}`;
          const timestamp = Date.now();
          const entry = { message, timestamp };
          
          cache.set(cacheKey, entry, ttl);
          logger.info(message, { key, timestamp });
        },
        getLog(key) {
          return cache.get(`log:${key}`);
        }
      };
    }, true);
    
    const service = core.get('cachedLogger');
    const spy = vi.spyOn(console, 'log');
    
    service.log('user:123', 'User logged in', 1000);
    
    expect(spy).toHaveBeenCalled();
    expect(service.getLog('user:123')).toEqual({
      message: 'User logged in',
      timestamp: expect.any(Number)
    });
  });

  it('should handle cache expiration with logging', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    const logger = core.get('logger');
    const cache = core.get('cache');
    
    const spy = vi.spyOn(console, 'log');
    
    cache.set('temp', 'data', 1000);
    logger.info('cache:set', { key: 'temp', ttl: 1000 });
    
    vi.advanceTimersByTime(1000);
    
    const value = cache.get('temp');
    logger.info('cache:get', { key: 'temp', value });
    
    expect(value).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('should log cache statistics', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    const logger = core.get('logger');
    const cache = core.get('cache');
    
    const spy = vi.spyOn(console, 'log');
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    const stats = {
      size: cache.size(),
      keys: cache.keys()
    };
    
    logger.info('cache:stats', stats);
    
    expect(stats.size).toBe(3);
    expect(stats.keys).toHaveLength(3);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain('cache:stats');
  });

  it('should handle cache clear with logging', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    core.register('cache', createCache, true);
    
    const logger = core.get('logger');
    const cache = core.get('cache');
    
    const spy = vi.spyOn(console, 'log');
    
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const sizeBefore = cache.size();
    logger.info('cache:clear:before', { size: sizeBefore });
    
    cache.clear();
    
    const sizeAfter = cache.size();
    logger.info('cache:clear:after', { size: sizeAfter });
    
    expect(sizeBefore).toBe(2);
    expect(sizeAfter).toBe(0);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
