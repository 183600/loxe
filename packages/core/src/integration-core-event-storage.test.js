import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createStorage, MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Core + Event + Storage', () => {
  let core;
  let events;
  let storage;

  beforeEach(async () => {
    core = createCore();

    // 注册事件服务
    core.register('events', () => createEventEmitter(), true);

    // 注册存储服务
    core.register('storage', async () => {
      const storage = new MemoryStorage();
      await storage.open();
      return storage;
    }, true);

    events = core.get('events');
    storage = await core.get('storage');
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should persist data to storage on data change events', async () => {
    const persistedData = [];
    const persistPromises = [];

    // 监听数据变更事件并持久化到存储
    events.on('data:persist', async (data) => {
      const key = `data:${data.id}`;
      const promise = storage.put(key, data).then(() => {
        persistedData.push({ key, data });
      });
      persistPromises.push(promise);
      await promise;
    });

    // 发出数据持久化事件
    events.emit('data:persist', { id: 1, name: 'Alice', email: 'alice@example.com' });
    events.emit('data:persist', { id: 2, name: 'Bob', email: 'bob@example.com' });

    // 等待所有异步操作完成
    await Promise.all(persistPromises);

    // 验证数据已持久化
    expect(persistedData).toHaveLength(2);
    expect(persistedData[0].key).toBe('data:1');
    expect(persistedData[1].key).toBe('data:2');

    const user1 = await storage.get('data:1');
    const user2 = await storage.get('data:2');

    expect(user1).toEqual({ id: 1, name: 'Alice', email: 'alice@example.com' });
    expect(user2).toEqual({ id: 2, name: 'Bob', email: 'bob@example.com' });
  });

  it('should support storage operations with event notifications', async () => {
    const operationLog = [];

    // 监听存储操作事件
    events.on('storage:operation', (operation) => {
      operationLog.push(operation);
    });

    // 模拟存储操作并发出事件
    const performStorageOperation = async (type, key, value) => {
      if (type === 'put') {
        await storage.put(key, value);
      } else if (type === 'del') {
        await storage.del(key);
      }
      events.emit('storage:operation', { type, key, value, timestamp: Date.now() });
    };

    await performStorageOperation('put', 'user:1', { id: 1, name: 'Alice' });
    await performStorageOperation('put', 'user:2', { id: 2, name: 'Bob' });
    await performStorageOperation('del', 'user:1', null);

    // 验证操作日志
    expect(operationLog).toHaveLength(3);
    expect(operationLog[0].type).toBe('put');
    expect(operationLog[0].key).toBe('user:1');
    expect(operationLog[1].type).toBe('put');
    expect(operationLog[1].key).toBe('user:2');
    expect(operationLog[2].type).toBe('del');
    expect(operationLog[2].key).toBe('user:1');

    // 验证存储状态
    const user1 = await storage.get('user:1');
    const user2 = await storage.get('user:2');

    expect(user1).toBeNull();
    expect(user2).toEqual({ id: 2, name: 'Bob' });
  });
});
