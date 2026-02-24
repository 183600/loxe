import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createQueryEngine } from '../../query/src/index.js';
import { MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Core + Query + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();
    storage = new MemoryStorage();
    await storage.open();

    // 注册存储服务
    core.register('storage', () => ({
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage.del(key),
      getData: (sourceName) => {
        // 从存储中扫描并返回数据
        const data = [];
        storage.data.forEach((value, key) => {
          if (key.startsWith(sourceName + ':')) {
            data.push(value);
          }
        });
        return data;
      }
    }), true);

    // 注册查询服务
    core.register('query', (ctx) => createQueryEngine(ctx), true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should query data from storage', async () => {
    const query = core.get('query');
    const storageService = core.get('storage');

    // 存储用户数据
    await storageService.put('users:1', { id: 1, name: 'Alice', age: 30, city: 'New York' });
    await storageService.put('users:2', { id: 2, name: 'Bob', age: 25, city: 'Los Angeles' });
    await storageService.put('users:3', { id: 3, name: 'Charlie', age: 35, city: 'New York' });

    // 查询所有用户
    const allUsers = query({ from: 'users' });
    expect(allUsers).toHaveLength(3);

    // 查询特定城市的用户
    const nyUsers = query({ from: 'users', where: { city: 'New York' } });
    expect(nyUsers).toHaveLength(2);
    expect(nyUsers.every(u => u.city === 'New York')).toBe(true);

    // 查询年龄大于30的用户
    const olderUsers = query({ from: 'users', where: { age: { $gt: 30 } } });
    expect(olderUsers).toHaveLength(1);
    expect(olderUsers[0].name).toBe('Charlie');
  });

  it('should support complex queries with multiple conditions', async () => {
    const query = core.get('query');
    const storageService = core.get('storage');

    // 存储产品数据
    await storageService.put('products:1', { id: 1, name: 'Laptop', price: 999, category: 'electronics', inStock: true });
    await storageService.put('products:2', { id: 2, name: 'Mouse', price: 29, category: 'electronics', inStock: true });
    await storageService.put('products:3', { id: 3, name: 'Desk', price: 299, category: 'furniture', inStock: false });
    await storageService.put('products:4', { id: 4, name: 'Chair', price: 149, category: 'furniture', inStock: true });

    // 查询有库存且价格低于300的电子产品
    const result = query({
      from: 'products',
      where: (p) => p.category === 'electronics' && p.inStock && p.price < 300
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Mouse');
  });

  it('should handle empty storage results', async () => {
    const query = core.get('query');

    // 查询不存在的数据源
    const result = query({ from: 'nonexistent' });
    expect(result).toEqual([]);
  });

  it('should support query compilation with storage data', async () => {
    const query = core.get('query');
    const storageService = core.get('storage');

    // 存储订单数据
    await storageService.put('orders:1', { id: 1, customerId: 1, total: 100, status: 'pending' });
    await storageService.put('orders:2', { id: 2, customerId: 1, total: 200, status: 'completed' });
    await storageService.put('orders:3', { id: 3, customerId: 2, total: 150, status: 'pending' });

    // 编译查询
    const compiledQuery = query.compile({
      from: 'orders',
      where: { status: 'pending' }
    });

    // 执行编译后的查询
    const pendingOrders = compiledQuery();
    expect(pendingOrders).toHaveLength(2);
    expect(pendingOrders.every(o => o.status === 'pending')).toBe(true);
  });
});
