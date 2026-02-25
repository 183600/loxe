import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Event + Cache', () => {
  let core;
  let events;
  let cache;

  beforeEach(() => {
    vi.useFakeTimers();
    core = createCore();

    // 注册事件服务
    core.register('events', () => createEventEmitter(), true);

    // 注册缓存服务
    core.register('cache', () => createCache(), true);

    events = core.get('events');
    cache = core.get('cache');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should invalidate cache entries when events are emitted', () => {
    const invalidationKeys = [];

    // 设置缓存
    cache.set('user:1', { id: 1, name: 'Alice' });
    cache.set('user:2', { id: 2, name: 'Bob' });
    cache.set('user:3', { id: 3, name: 'Charlie' });

    expect(cache.size()).toBe(3);

    // 监听缓存失效事件
    events.on('cache:invalidate', (keys) => {
      invalidationKeys.push(...keys);
      keys.forEach(key => cache.delete(key));
    });

    // 发出缓存失效事件
    events.emit('cache:invalidate', ['user:1', 'user:3']);

    // 验证缓存已失效
    expect(invalidationKeys).toEqual(['user:1', 'user:3']);
    expect(cache.has('user:1')).toBe(false);
    expect(cache.has('user:2')).toBe(true);
    expect(cache.has('user:3')).toBe(false);
    expect(cache.size()).toBe(1);
  });

  it('should support pattern-based cache invalidation', () => {
    // 设置多个缓存条目
    cache.set('user:1', { id: 1 });
    cache.set('user:2', { id: 2 });
    cache.set('user:3', { id: 3 });
    cache.set('product:1', { id: 1 });
    cache.set('product:2', { id: 2 });

    expect(cache.size()).toBe(5);

    // 监听通配符失效事件
    events.on('cache:invalidate:user:*', (event, keys) => {
      keys.forEach(key => cache.delete(key));
    });

    // 发出用户缓存失效事件
    events.emit('cache:invalidate:user:all', ['user:1', 'user:2', 'user:3']);

    // 验证只有用户缓存被失效
    expect(cache.has('user:1')).toBe(false);
    expect(cache.has('user:2')).toBe(false);
    expect(cache.has('user:3')).toBe(false);
    expect(cache.has('product:1')).toBe(true);
    expect(cache.has('product:2')).toBe(true);
    expect(cache.size()).toBe(2);
  });

  it('should auto-invalidate cache on data update events', () => {
    const updateEvents = [];

    // 设置缓存
    cache.set('data:123', { value: 'original' });

    // 监听数据更新事件并使缓存失效
    events.on('data:updated', (data) => {
      updateEvents.push(data);
      const cacheKey = `data:${data.id}`;
      cache.delete(cacheKey);
    });

    // 发出数据更新事件
    events.emit('data:updated', { id: 123, value: 'updated' });

    // 验证缓存已失效
    expect(updateEvents).toHaveLength(1);
    expect(updateEvents[0].value).toBe('updated');
    expect(cache.has('data:123')).toBe(false);
  });

  it('should support cache refresh on events', () => {
    const refreshData = { id: 456, name: 'Refreshed User' };

    // 设置缓存
    cache.set('user:456', { id: 456, name: 'Old User' });

    // 监听缓存刷新事件
    events.on('cache:refresh', ({ key, data }) => {
      cache.set(key, data);
    });

    // 发出缓存刷新事件
    events.emit('cache:refresh', { key: 'user:456', data: refreshData });

    // 验证缓存已刷新
    const cached = cache.get('user:456');
    expect(cached).toEqual(refreshData);
    expect(cached.name).toBe('Refreshed User');
  });

  it('should handle batch cache invalidation', () => {
    // 批量设置缓存
    for (let i = 1; i <= 10; i++) {
      cache.set(`item:${i}`, { id: i });
    }

    expect(cache.size()).toBe(10);

    const invalidatedKeys = [];

    // 监听批量失效事件
    events.on('cache:invalidate:batch', (keys) => {
      invalidatedKeys.push(...keys);
      keys.forEach(key => cache.delete(key));
    });

    // 发出批量失效事件
    events.emit('cache:invalidate:batch', ['item:1', 'item:3', 'item:5', 'item:7', 'item:9']);

    // 验证指定键已失效
    expect(invalidatedKeys).toHaveLength(5);
    expect(cache.size()).toBe(5);
    expect(cache.has('item:1')).toBe(false);
    expect(cache.has('item:2')).toBe(true);
    expect(cache.has('item:3')).toBe(false);
    expect(cache.has('item:4')).toBe(true);
  });

  it('should support cache invalidation with TTL events', () => {
    // 设置带 TTL 的缓存
    cache.set('temp:1', { data: 'temp' }, 1000);

    // 监听 TTL 过期事件
    events.on('cache:expired', (event, key) => {
      // 可以在这里执行额外的清理逻辑
      expect(key).toBe('temp:1');
    });

    // 等待 TTL 过期
    vi.advanceTimersByTime(1000);

    // 验证缓存已过期
    expect(cache.get('temp:1')).toBeUndefined();
  });

  it('should handle cache invalidation errors gracefully', () => {
    // 设置缓存
    cache.set('user:1', { id: 1 });

    const errorLog = [];

    // 监听失效事件，但故意抛出错误
    events.on('cache:invalidate', (keys) => {
      if (keys.includes('user:1')) {
        throw new Error('Invalidation error');
      }
    });

    // 监听错误事件
    events.on('error', (error) => {
      errorLog.push(error);
    });

    // 发出失效事件
    expect(() => events.emit('cache:invalidate', ['user:1'])).toThrow('Invalidation error');
  });

  it('should support conditional cache invalidation', () => {
    // 设置不同类型的缓存
    cache.set('user:1', { id: 1, type: 'user' });
    cache.set('admin:1', { id: 1, type: 'admin' });
    cache.set('user:2', { id: 2, type: 'user' });

    const invalidatedKeys = [];

    // 监听条件失效事件
    events.on('cache:invalidate:conditional', (condition) => {
      const keys = cache.keys();
      keys.forEach(key => {
        const data = cache.get(key);
        if (data && data.type === condition.type) {
          cache.delete(key);
          invalidatedKeys.push(key);
        }
      });
    });

    // 发出条件失效事件
    events.emit('cache:invalidate:conditional', { type: 'user' });

    // 验证只有用户类型的缓存被失效
    expect(invalidatedKeys).toContain('user:1');
    expect(invalidatedKeys).toContain('user:2');
    expect(invalidatedKeys).not.toContain('admin:1');
    expect(cache.has('admin:1')).toBe(true);
  });
});