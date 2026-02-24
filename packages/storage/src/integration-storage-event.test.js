import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from '../../event/src/index.js';
import { createStorage } from './index.js';

describe('Event + Storage Integration', () => {
  let event;
  let storage;

  beforeEach(async () => {
    event = createEventEmitter();
    storage = createStorage('memory');
    await storage.open();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should emit events on storage operations', async () => {
    const events = [];

    event.on('storage:put', (data) => events.push({ type: 'put', ...data }));
    event.on('storage:get', (data) => events.push({ type: 'get', ...data }));
    event.on('storage:del', (data) => events.push({ type: 'del', ...data }));

    await storage.put('user:123', { name: 'Alice' });
    event.emit('storage:put', { key: 'user:123', value: { name: 'Alice' } });

    const user = await storage.get('user:123');
    event.emit('storage:get', { key: 'user:123', value: user });

    await storage.del('user:123');
    event.emit('storage:del', { key: 'user:123', deleted: true });

    expect(events).toHaveLength(3);
    expect(events[0].type).toBe('put');
    expect(events[0].key).toBe('user:123');
    expect(events[1].type).toBe('get');
    expect(events[2].type).toBe('del');
  });

  it('should create an event-driven storage service', async () => {
    const eventStorage = {
      async put(key, value) {
        await storage.put(key, value);
        event.emit('data:changed', { action: 'put', key, value });
      },
      async get(key) {
        const value = await storage.get(key);
        event.emit('data:accessed', { action: 'get', key, found: value !== null });
        return value;
      },
      async del(key) {
        const deleted = await storage.del(key);
        event.emit('data:changed', { action: 'del', key, deleted });
        return deleted;
      },
      on: event.on.bind(event)
    };

    const events = [];
    eventStorage.on('data:changed', (data) => events.push(data));
    eventStorage.on('data:accessed', (data) => events.push(data));

    await eventStorage.put('product:1', { id: 1, name: 'Widget' });
    await eventStorage.get('product:1');
    await eventStorage.del('product:1');

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ action: 'put', key: 'product:1', value: { id: 1, name: 'Widget' } });
    expect(events[1]).toEqual({ action: 'get', key: 'product:1', found: true });
    expect(events[2]).toEqual({ action: 'del', key: 'product:1', deleted: true });
  });

  it('should handle storage sync via events', async () => {
    const syncEvents = [];

    event.on('storage:sync', (data) => {
      syncEvents.push(data);
      // 模拟同步到存储
      if (data.action === 'upsert') {
        storage.put(data.key, data.value);
      }
    });

    // 模拟外部数据变更
    event.emit('storage:sync', { action: 'upsert', key: 'config:theme', value: 'dark' });
    event.emit('storage:sync', { action: 'upsert', key: 'config:lang', value: 'en' });

    expect(syncEvents).toHaveLength(2);

    // 验证存储已同步
    const theme = await storage.get('config:theme');
    const lang = await storage.get('config:lang');

    expect(theme).toBe('dark');
    expect(lang).toBe('en');
  });

  it('should handle transaction events', async () => {
    const txEvents = [];

    event.on('tx:begin', () => txEvents.push('begin'));
    event.on('tx:commit', () => txEvents.push('commit'));
    event.on('tx:rollback', () => txEvents.push('rollback'));

    const eventTx = {
      async begin() {
        event.emit('tx:begin');
        return await storage.tx();
      },
      async commit(tx) {
        await tx.commit();
        event.emit('tx:commit');
      },
      async rollback(tx) {
        await tx.rollback();
        event.emit('tx:rollback');
      }
    };

    const tx = await eventTx.begin();
    await tx.put('key1', 'value1');
    await tx.put('key2', 'value2');
    await eventTx.commit(tx);

    expect(txEvents).toEqual(['begin', 'commit']);

    // 测试回滚
    const tx2 = await eventTx.begin();
    await tx2.put('key3', 'value3');
    await eventTx.rollback(tx2);

    expect(txEvents).toEqual(['begin', 'commit', 'begin', 'rollback']);
  });

  it('should handle batch operations with events', async () => {
    const batchEvents = [];

    event.on('batch:start', (data) => batchEvents.push({ type: 'start', ...data }));
    event.on('batch:end', (data) => batchEvents.push({ type: 'end', ...data }));

    const batchStorage = {
      async batchPut(items) {
        event.emit('batch:start', { count: items.length });
        for (const [key, value] of items) {
          await storage.put(key, value);
        }
        event.emit('batch:end', { count: items.length });
      }
    };

    await batchStorage.batchPut([
      ['user:1', { id: 1, name: 'Alice' }],
      ['user:2', { id: 2, name: 'Bob' }],
      ['user:3', { id: 3, name: 'Charlie' }]
    ]);

    expect(batchEvents).toHaveLength(2);
    expect(batchEvents[0]).toEqual({ type: 'start', count: 3 });
    expect(batchEvents[1]).toEqual({ type: 'end', count: 3 });

    // 验证存储
    const user1 = await storage.get('user:1');
    const user2 = await storage.get('user:2');
    const user3 = await storage.get('user:3');

    expect(user1.name).toBe('Alice');
    expect(user2.name).toBe('Bob');
    expect(user3.name).toBe('Charlie');
  });
});