import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Config + Cache', () => {
  let core;
  let config;
  let cache;

  beforeEach(() => {
    vi.useFakeTimers();
    core = createCore();

    // 注册配置服务
    core.register('config', () => createConfig({
      cache: {
        defaultTTL: 5000,
        maxSize: 100,
        enabled: true
      }
    }), true);

    // 注册缓存服务
    core.register('cache', (ctx) => {
      const config = ctx.get('config');
      return createCache();
    }, true);

    config = core.get('config');
    cache = core.get('cache');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use config values to control cache behavior', () => {
    const defaultTTL = config.get('cache.defaultTTL');
    const maxSize = config.get('cache.maxSize');
    const enabled = config.get('cache.enabled');

    expect(defaultTTL).toBe(5000);
    expect(maxSize).toBe(100);
    expect(enabled).toBe(true);

    // 使用配置的 TTL 设置缓存
    cache.set('user:123', { id: 123, name: 'Alice' }, defaultTTL);
    expect(cache.get('user:123')).toEqual({ id: 123, name: 'Alice' });

    // 验证 TTL 生效
    vi.advanceTimersByTime(defaultTTL);
    expect(cache.get('user:123')).toBeUndefined();
  });

  it('should support dynamic config updates affecting cache operations', () => {
    // 初始配置
    config.set('cache.defaultTTL', 1000);
    const initialTTL = config.get('cache.defaultTTL');

    // 使用初始 TTL 设置缓存
    cache.set('temp:data', { value: 'initial' }, initialTTL);
    expect(cache.get('temp:data')).toEqual({ value: 'initial' });

    // 更新配置
    config.set('cache.defaultTTL', 2000);
    const updatedTTL = config.get('cache.defaultTTL');

    // 使用更新后的 TTL 设置新缓存
    cache.set('temp:data2', { value: 'updated' }, updatedTTL);
    expect(cache.get('temp:data2')).toEqual({ value: 'updated' });

    // 验证初始缓存在初始 TTL 后过期
    vi.advanceTimersByTime(initialTTL);
    expect(cache.get('temp:data')).toBeUndefined();
    expect(cache.get('temp:data2')).toEqual({ value: 'updated' });

    // 验证新缓存在更新后的 TTL 后过期
    vi.advanceTimersByTime(updatedTTL - initialTTL);
    expect(cache.get('temp:data2')).toBeUndefined();
  });
});
