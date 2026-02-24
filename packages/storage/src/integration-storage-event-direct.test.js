
import { describe, it, expect } from 'vitest';
import { MemoryStorage } from './index.js';
import { createEventEmitter } from '../event/src/index.js';

describe('Integration: Storage + Event Direct Interaction', () => {
  let storage;
  let event;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.open();
    event = createEventEmitter();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should emit events on storage operations', async () => {
    const events = [];

    // 监听存储事件
    event.on('storage:put', (data) => events.push({ type: 'put', ...data }));
    event.on('storage:get', (data) => events.push({ type: 'get', ...data }));
    event.on('storage:delete', (data) => events.push({ type: 'delete', ...data }));

    // 包装存储方法以发射事件
    const originalPut = storage.put.bind(storage);
    const wrappedPut = async (key, value) => {
      await originalPut(key, value);
      event.emit('storage:put', { key, value });
    };

    const originalGet = storage.get.bind(storage);
    const wrappedGet = async (key) => {
      const value = await originalGet(key);
      event.emit('storage:get', { key, value });
      return value;
    };

    const originalDel = storage.del.bind(storage);
    const wrappedDel = async (key) => {
      const deleted = await originalDel(key);
      event.emit('storage:delete', { key, deleted });
      return deleted;
    };

    await wrappedPut('user:1', { name: 'Alice' });
    await wrappedGet('user:1');
    await wrappedDel('user:1');

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'put', key: 'user:1', value: { name: 'Alice' } });
    expect(events[1]).toEqual({ type: 'get', key: 'user:1', value: { name: 'Alice' } });
    expect(events[2]).toEqual({ type: 'delete', key: 'user:1', deleted: true });
  });

  it('should emit events on scan operations', async () => {
    const events = [];

    event.on('storage:scan', (data) => events.push(data));

    await storage.put('user:1', { name: 'Alice' });
    await storage.put('user:2', { name: 'Bob' });
    await storage.put('product:1', { name: 'Widget' });

    // 包装 scan 方法以发射事件
    const originalScan = storage.scan.bind(storage);
    const wrappedScan = async (options) => {
      const results = await originalScan(options);
      event.emit('storage:scan', { options, count: results.length });
      return results;
    };

    const users = await wrappedScan({ prefix: 'user:' });

    expect(users).toHaveLength(2);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ options: { prefix: 'user:' }, count: 2 });
  });

  it('should use events to trigger storage invalidation', async () => {
    await storage.put('cache:user:1', { name: 'Alice', age: 30 });
    await storage.put('cache:user:2', { name: 'Bob', age: 25 });
    await storage.put('cache:product:1', { name: 'Widget', price: 9.99 });

    // 监听失效事件并删除相关缓存
    event.on('cache:invalidate', (pattern) => {
      const keys = storage.data.keys();
      for (const key of keys) {
        if (key.startsWith(pattern)) {
          storage.data.delete(key);
        }
      }
    });

    // 验证初始数据
    expect(await storage.get('cache:user:1')).toEqual({ name: 'Alice', age: 30 });
    expect(await storage.get('cache:user:2')).toEqual({ name: 'Bob', age: 25 });

    // 触发失效事件
    event.emit('cache:invalidate', 'cache:user:');

    // 验证缓存已失效
    expect(await storage.get('cache:user:1')).toBeNull();
    expect(await storage.get('cache:user:2')).toBeNull();
    expect(await storage.get('cache:product:1')).toEqual({ name: 'Widget', price: 9.99 });
  });
});