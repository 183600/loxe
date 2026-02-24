import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from './index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Event + Cache Direct Interaction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should automatically invalidate cache on specific events', () => {
    const event = createEventEmitter();
    const cache = createCache();

    // 设置初始缓存
    cache.set('user:123', { name: 'Alice', age: 30 });
    cache.set('user:456', { name: 'Bob', age: 25 });

    // 监听失效事件
    event.on('cache:invalidate', (pattern) => {
      const keys = cache.keys();
      keys.forEach(key => {
        if (key.startsWith(pattern)) {
          cache.delete(key);
        }
      });
    });

    expect(cache.get('user:123')).toEqual({ name: 'Alice', age: 30 });
    expect(cache.get('user:456')).toEqual({ name: 'Bob', age: 25 });

    // 触发失效事件
    event.emit('cache:invalidate', 'user:');

    // 验证缓存已失效
    expect(cache.get('user:123')).toBeUndefined();
    expect(cache.get('user:456')).toBeUndefined();
  });

  it('should cache event payloads with TTL', () => {
    const event = createEventEmitter();
    const cache = createCache();

    const cacheKeys = [];

    // 监听事件并缓存
    event.on('data:*', (eventName, data) => {
      const cacheKey = `event:${eventName}`;
      cache.set(cacheKey, data, 1000);
      cacheKeys.push(cacheKey);
    });

    // 发射多个事件
    event.emit('data:user', { id: 1, name: 'Alice' });
    event.emit('data:product', { id: 101, name: 'Widget' });
    event.emit('data:order', { id: 1001, total: 99.99 });

    // 验证缓存
    expect(cache.get('event:data:user')).toEqual({ id: 1, name: 'Alice' });
    expect(cache.get('event:data:product')).toEqual({ id: 101, name: 'Widget' });
    expect(cache.get('event:data:order')).toEqual({ id: 1001, total: 99.99 });

    // 等待 TTL 过期
    vi.advanceTimersByTime(1000);

    // 验证缓存已过期
    expect(cache.get('event:data:user')).toBeUndefined();
    expect(cache.get('event:data:product')).toBeUndefined();
    expect(cache.get('event:data:order')).toBeUndefined();
  });

  it('should use cache to deduplicate repeated event processing', () => {
    const event = createEventEmitter();
    const cache = createCache();

    const processedEvents = [];

    // 监听事件，使用缓存去重
    event.on('process:*', (eventName, data) => {
      const cacheKey = `processed:${data.id}`;
      
      // 检查是否已处理
      if (cache.has(cacheKey)) {
        return;
      }

      // 标记为已处理
      cache.set(cacheKey, true);
      processedEvents.push({ event: eventName, data });
    });

    // 发射相同的事件多次
    event.emit('process:task', { id: 'task-1', name: 'Task 1' });
    event.emit('process:task', { id: 'task-1', name: 'Task 1' });
    event.emit('process:task', { id: 'task-1', name: 'Task 1' });

    event.emit('process:task', { id: 'task-2', name: 'Task 2' });
    event.emit('process:task', { id: 'task-2', name: 'Task 2' });

    // 验证只处理了唯一的事件
    expect(processedEvents).toHaveLength(2);
    expect(processedEvents[0]).toEqual({ event: 'process:task', data: { id: 'task-1', name: 'Task 1' } });
    expect(processedEvents[1]).toEqual({ event: 'process:task', data: { id: 'task-2', name: 'Task 2' } });
  });
});