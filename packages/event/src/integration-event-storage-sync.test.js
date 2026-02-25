import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from './index.js';
import { createStorage, MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Event + Storage', () => {
  let events;
  let storage;
  let eventLog;
  let syncPromises;

  beforeEach(async () => {
    events = createEventEmitter();
    storage = new MemoryStorage();
    await storage.open();
    eventLog = [];
    syncPromises = [];
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should emit events on storage operations', async () => {
    // 监听存储操作事件
    events.on('storage:write', async (key, value) => {
      const promise = storage.put(key, value).then(() => {
        eventLog.push({ type: 'write', key, value, timestamp: Date.now() });
      });
      syncPromises.push(promise);
      await promise;
    });

    events.on('storage:delete', async (key) => {
      const promise = storage.del(key).then(() => {
        eventLog.push({ type: 'delete', key, timestamp: Date.now() });
      });
      syncPromises.push(promise);
      await promise;
    });

    // 执行存储操作
    events.emit('storage:write', 'user:1', { id: 1, name: 'Alice' });
    events.emit('storage:write', 'user:2', { id: 2, name: 'Bob' });
    events.emit('storage:delete', 'user:1');

    // 等待所有异步操作完成
    await Promise.all(syncPromises);

    // 验证事件日志
    expect(eventLog).toHaveLength(3);
    expect(eventLog[0].type).toBe('write');
    expect(eventLog[0].key).toBe('user:1');
    expect(eventLog[1].type).toBe('write');
    expect(eventLog[1].key).toBe('user:2');
    expect(eventLog[2].type).toBe('delete');
    expect(eventLog[2].key).toBe('user:1');

    // 验证存储状态
    const user1 = await storage.get('user:1');
    const user2 = await storage.get('user:2');

    expect(user1).toBeNull();
    expect(user2).toEqual({ id: 2, name: 'Bob' });
  });

  it('should support event-driven data synchronization', async () => {
    const syncLog = [];

    // 监听数据同步事件
    events.on('data:sync', async (data) => {
      const key = `sync:${data.id}`;
      const existing = await storage.get(key);

      if (existing) {
        // 更新现有数据
        await storage.put(key, { ...existing, ...data, updatedAt: Date.now() });
        syncLog.push({ action: 'update', key, data });
      } else {
        // 创建新数据
        await storage.put(key, { ...data, createdAt: Date.now(), updatedAt: Date.now() });
        syncLog.push({ action: 'create', key, data });
      }
    });

    // 同步数据 - 依次执行以确保顺序
    await new Promise(resolve => {
      events.emit('data:sync', { id: 1, name: 'Alice', email: 'alice@example.com' });
      setTimeout(resolve, 10);
    });

    await new Promise(resolve => {
      events.emit('data:sync', { id: 2, name: 'Bob', email: 'bob@example.com' });
      setTimeout(resolve, 10);
    });

    await new Promise(resolve => {
      events.emit('data:sync', { id: 1, email: 'alice.new@example.com' }); // 更新
      setTimeout(resolve, 10);
    });

    // 等待所有异步操作完成
    await Promise.all(syncPromises);

    // 验证同步日志
    expect(syncLog).toHaveLength(3);
    expect(syncLog[0].action).toBe('create');
    expect(syncLog[1].action).toBe('create');
    expect(syncLog[2].action).toBe('update');

    // 验证存储中的数据
    const user1 = await storage.get('sync:1');
    const user2 = await storage.get('sync:2');

    expect(user1.id).toBe(1);
    expect(user1.name).toBe('Alice');
    expect(user1.email).toBe('alice.new@example.com');
    expect(user1.createdAt).toBeDefined();
    expect(user1.updatedAt).toBeDefined();

    expect(user2.id).toBe(2);
    expect(user2.name).toBe('Bob');
    expect(user2.email).toBe('bob@example.com');
    expect(user2.createdAt).toBeDefined();
    expect(user2.updatedAt).toBeDefined();
  });
});