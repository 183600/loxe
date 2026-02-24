import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Logger + Cache Integration', () => {
  it('should log cache operations', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Cache' });
    const cache = createCache();

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    cache.set('key', 'value');
    logger.info('Cache set: key = value');

    const value = cache.get('key');
    logger.info('Cache get: key =', value);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('Cache set: key = value');
    expect(spy.mock.calls[1][0]).toContain('Cache get: key = "value"');

    spy.mockRestore();
  });

  it('should create a logged cache wrapper', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Cache' });
    const cache = createCache();

    const loggedCache = {
      get(key) {
        const value = cache.get(key);
        logger.info(`GET ${key}`, { hit: value !== undefined });
        return value;
      },
      set(key, value, ttl) {
        cache.set(key, value, ttl);
        logger.info(`SET ${key}`, { ttl });
      },
      delete(key) {
        cache.delete(key);
        logger.info(`DELETE ${key}`);
      },
      has(key) {
        const exists = cache.has(key);
        logger.info(`HAS ${key}`, { exists });
        return exists;
      }
    };

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    loggedCache.set('user:123', { name: 'Alice' });
    loggedCache.has('user:123');
    loggedCache.get('user:123');
    loggedCache.delete('user:123');

    expect(spy).toHaveBeenCalledTimes(4);

    const setOutput = spy.mock.calls[0][0];
    expect(setOutput).toContain('SET user:123');

    const hasOutput = spy.mock.calls[1][0];
    expect(hasOutput).toContain('HAS user:123');

    const getOutput = spy.mock.calls[2][0];
    expect(getOutput).toContain('GET user:123');

    const deleteOutput = spy.mock.calls[3][0];
    expect(deleteOutput).toContain('DELETE user:123');

    spy.mockRestore();
  });

  it('should log cache misses with debug level', () => {
    const logger = createLogger(null, { level: 'debug', prefix: 'Cache' });
    const cache = createCache();

    const loggedCache = {
      get(key) {
        const value = cache.get(key);
        if (value === undefined) {
          logger.debug(`Cache miss: ${key}`);
        } else {
          logger.info(`Cache hit: ${key}`);
        }
        return value;
      }
    };

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    spyLog.mockClear();
    spyWarn.mockClear();
    spyError.mockClear();

    // Cache miss
    loggedCache.get('nonexistent');
    expect(spyLog).toHaveBeenCalled();
    const missOutput = spyLog.mock.calls[0][0];
    expect(missOutput).toContain('Cache miss: nonexistent');

    // Cache hit
    cache.set('existing', 'value');
    loggedCache.get('existing');
    expect(spyLog).toHaveBeenCalledTimes(2);
    const hitOutput = spyLog.mock.calls[1][0];
    expect(hitOutput).toContain('Cache hit: existing');

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should log cache statistics', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Cache' });
    const cache = createCache();

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    const stats = {
      size: cache.size(),
      keys: cache.keys()
    };

    logger.info('Cache statistics', stats);

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Cache statistics');
    expect(output).toContain('size');
    expect(output).toContain('3');

    spy.mockRestore();
  });

  it('should log cache clear operations', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Cache' });
    const cache = createCache();

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');

    logger.info(`Cache cleared. Previous size: ${cache.size()}`);
    cache.clear();
    logger.info(`Cache cleared. New size: ${cache.size()}`);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('Previous size: 2');
    expect(spy.mock.calls[1][0]).toContain('New size: 0');

    spy.mockRestore();
  });
});