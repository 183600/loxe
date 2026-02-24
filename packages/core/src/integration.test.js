import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createStorage, MemoryStorage } from '../../storage/src/index.js';
import { createQueryEngine } from '../../query/src/index.js';

describe('Integration: Core + Storage + Query', () => {
  let core;
  let storage;
  let query;

  beforeEach(async () => {
    core = createCore();

    // 注册存储服务
    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      getData: (sourceName) => {
        // 从存储中获取数据
        const data = [];
        for (const [key, value] of storage.data.entries()) {
          if (key.startsWith(`${sourceName}:`)) {
            const id = key.split(':')[1];
            data.push({ id, ...value });
          }
        }
        return data;
      },
      setData: (data) => {
        // 存储数据（简化实现）
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.id) {
              storage.put(`users:${item.id}`, item);
            }
          });
        }
      },
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage.del(key)
    }), true);

    // 注册查询引擎
    core.register('query', () => createQueryEngine(core), true);

    query = core.get('query');
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should query data stored in storage', async () => {
    // 存储一些测试数据
    await storage.put('users:1', { name: 'Alice', age: 30, city: 'New York' });
    await storage.put('users:2', { name: 'Bob', age: 25, city: 'Los Angeles' });
    await storage.put('users:3', { name: 'Charlie', age: 35, city: 'New York' });

    // 查询所有用户
    const allUsers = query({ from: 'users' });
    expect(allUsers).toHaveLength(3);

    // 查询特定城市的用户
    const nyUsers = query({ from: 'users', where: { city: 'New York' } });
    expect(nyUsers).toHaveLength(2);
    expect(nyUsers.every(u => u.city === 'New York')).toBe(true);

    // 查询年龄大于 30 的用户
    const olderUsers = query({ from: 'users', where: { age: { $gt: 30 } } });
    expect(olderUsers).toHaveLength(1);
    expect(olderUsers[0].name).toBe('Charlie');
  });

  it('should handle complex queries across stored data', async () => {
    // 存储测试数据
    await storage.put('products:1', { name: 'Laptop', price: 999, category: 'electronics', inStock: true });
    await storage.put('products:2', { name: 'Mouse', price: 29, category: 'electronics', inStock: true });
    await storage.put('products:3', { name: 'Book', price: 15, category: 'books', inStock: false });
    await storage.put('products:4', { name: 'Keyboard', price: 79, category: 'electronics', inStock: true });

    // 查询电子产品中价格在 50-1000 之间且有库存的
    const result = query({
      from: 'products',
      where: (item) =>
        item.category === 'electronics' &&
        item.price >= 50 &&
        item.price <= 1000 &&
        item.inStock
    });

    expect(result).toHaveLength(2);
    expect(result.map(p => p.name)).toEqual(expect.arrayContaining(['Laptop', 'Keyboard']));
  });

  it('should work with compiled queries on stored data', async () => {
    await storage.put('orders:1', { id: 'ORD-001', total: 100, status: 'completed' });
    await storage.put('orders:2', { id: 'ORD-002', total: 200, status: 'pending' });
    await storage.put('orders:3', { id: 'ORD-003', total: 150, status: 'completed' });

    const compiledQuery = query.compile({
      from: 'orders',
      where: { status: 'completed' }
    });

    const completedOrders = compiledQuery();
    expect(completedOrders).toHaveLength(2);
    expect(completedOrders.every(o => o.status === 'completed')).toBe(true);
  });

  it('should handle empty storage results', async () => {
    // 不存储任何数据
    const result = query({ from: 'users', where: { active: true } });
    expect(result).toEqual([]);
  });

  it('should support direct array queries alongside storage queries', async () => {
    // 存储一些数据
    await storage.put('users:1', { name: 'Alice', age: 30 });

    // 查询存储中的数据
    const storageResult = query({ from: 'users' });
    expect(storageResult).toHaveLength(1);

    // 查询直接传入的数组
    const arrayData = [
      { name: 'Bob', age: 25 },
      { name: 'Charlie', age: 35 }
    ];
    const arrayResult = query({ from: arrayData, where: { age: { $gte: 30 } } });
    expect(arrayResult).toHaveLength(1);
    expect(arrayResult[0].name).toBe('Charlie');
  });

  it('should handle service dependencies correctly', () => {
    // 验证服务已正确注册
    expect(core.has('storage')).toBe(true);
    expect(core.has('query')).toBe(true);

    // 验证可以获取服务
    const storageService = core.get('storage');
    const queryService = core.get('query');

    expect(storageService).toBeDefined();
    expect(queryService).toBeDefined();
    expect(typeof queryService).toBe('function');
  });

  it('should maintain singleton behavior for services', () => {
    const query1 = core.get('query');
    const query2 = core.get('query');

    // 验证是同一个实例
    expect(query1).toBe(query2);
  });
});