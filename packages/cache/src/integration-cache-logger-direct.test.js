import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCache } from './index.js';
import { createLogger } from '../logger/src/index.js';

describe('Integration: Cache + Logger Direct Interaction', () => {
  let cache;
  let logger;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = createCache();
    logger = createLogger(null, { level: 'info' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log cache operations', () => {
    const spyLog = vi.spyOn(console, 'log');

    // 包装缓存方法以记录日志
    const originalSet = cache.set.bind(cache);
    const wrappedSet = (key, value, ttl) => {
      logger.info(`Cache set: ${key}`, { ttl });
      return originalSet(key, value, ttl);
    };

    const originalGet = cache.get.bind(cache);
    const wrappedGet = (key) => {
      const value = originalGet(key);
      logger.info(`Cache get: ${key}`, { hit: value !== undefined });
      return value;
    };

    wrappedSet('user:1', { name: 'Alice' }, 1000);
    wrappedGet('user:1');
    wrappedGet('nonexistent');

    expect(spyLog).toHaveBeenCalledTimes(3);
    expect(spyLog.mock.calls[0][0]).toContain('Cache set: user:1');
    expect(spyLog.mock.calls[1][0]).toContain('Cache get: user:1');
    expect(spyLog.mock.calls[1][0]).toContain('"hit":true');
    expect(spyLog.mock.calls[2][0]).toContain('Cache get: nonexistent');
    expect(spyLog.mock.calls[2][0]).toContain('"hit":false');

    spyLog.mockRestore();
  });

  it('should log cache expiration events', () => {
    const spyLog = vi.spyOn(console, 'log');

    // 设置带 TTL 的缓存项
    cache.set('temp', 'value', 1000);

    // 检查缓存是否存在
    expect(cache.get('temp')).toBe('value');

    // 等待 TTL 过期
    vi.advanceTimersByTime(1000);

    // 验证缓存已过期
    expect(cache.get('temp')).toBeUndefined();

    spyLog.mockRestore();
  });

  it('should log cache clear operations', () => {
    const spyLog = vi.spyOn(console, 'log');

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    expect(cache.size()).toBe(3);

    // 包装 clear 方法以记录日志
    const originalClear = cache.clear.bind(cache);
    const wrappedClear = () => {
      const size = cache.size();
      logger.info(`Cache clear: ${size} entries`);
      return originalClear();
    };

    wrappedClear();

    expect(cache.size()).toBe(0);
    expect(spyLog).toHaveBeenCalled();
    expect(spyLog.mock.calls[0][0]).toContain('Cache clear: 3 entries');

    spyLog.mockRestore();
  });

  it('should log cache statistics', () => {
    const spyLog = vi.spyOn(console, 'log');

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');

    // 记录缓存统计信息
    logger.info('Cache statistics', {
      size: cache.size(),
      keys: cache.keys()
    });

    expect(spyLog).toHaveBeenCalled();
    expect(spyLog.mock.calls[0][0]).toContain('Cache statistics');
    expect(spyLog.mock.calls[0][0]).toContain('"size":3');

    spyLog.mockRestore();
  });
});