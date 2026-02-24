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

describe('Integration: Core + Event + Logger', () => {
  let core;
  let eventEmitter;
  let logger;
  const logs = [];

  beforeEach(() => {
    core = createCore();
    logs.length = 0;

    // 注册事件发射器
    core.register('events', () => {
      const listeners = new Map();
      return {
        on(event, callback) {
          if (!listeners.has(event)) {
            listeners.set(event, new Set());
          }
          listeners.get(event).add(callback);
          return () => this.off(event, callback);
        },
        off(event, callback) {
          if (listeners.has(event)) {
            listeners.get(event).delete(callback);
          }
        },
        emit(event, data) {
          if (listeners.has(event)) {
            for (const callback of listeners.get(event)) {
              callback(data);
            }
          }
        }
      };
    }, true);

    // 注册日志记录器
    core.register('logger', () => {
      return {
        info: (msg, meta) => logs.push({ level: 'info', msg, meta }),
        error: (msg, meta) => logs.push({ level: 'error', msg, meta }),
        warn: (msg, meta) => logs.push({ level: 'warn', msg, meta })
      };
    }, true);

    eventEmitter = core.get('events');
    logger = core.get('logger');
  });

  it('should log events when they are emitted', () => {
    // 监听事件并记录日志
    eventEmitter.on('user:login', (data) => {
      logger.info('User logged in', { userId: data.userId, timestamp: data.timestamp });
    });

    eventEmitter.on('user:logout', (data) => {
      logger.info('User logged out', { userId: data.userId });
    });

    // 触发事件
    eventEmitter.emit('user:login', { userId: 123, timestamp: Date.now() });
    eventEmitter.emit('user:logout', { userId: 123 });

    // 验证日志记录
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual({
      level: 'info',
      msg: 'User logged in',
      meta: { userId: 123, timestamp: expect.any(Number) }
    });
    expect(logs[1]).toEqual({
      level: 'info',
      msg: 'User logged out',
      meta: { userId: 123 }
    });
  });

  it('should handle error events with error logging', () => {
    eventEmitter.on('error', (data) => {
      logger.error('Application error', { error: data.message, code: data.code });
    });

    eventEmitter.emit('error', { message: 'Database connection failed', code: 'DB_ERROR' });

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe('error');
    expect(logs[0].msg).toBe('Application error');
    expect(logs[0].meta.error).toBe('Database connection failed');
  });

  it('should support event chaining with logging', () => {
    eventEmitter.on('step1', (data) => {
      logger.info('Step 1 completed', { data });
      eventEmitter.emit('step2', { ...data, step: 2 });
    });

    eventEmitter.on('step2', (data) => {
      logger.info('Step 2 completed', { data });
      eventEmitter.emit('step3', { ...data, step: 3 });
    });

    eventEmitter.on('step3', (data) => {
      logger.info('Step 3 completed', { data });
    });

    eventEmitter.emit('step1', { id: 'test-123' });

    expect(logs).toHaveLength(3);
    expect(logs[0].msg).toBe('Step 1 completed');
    expect(logs[1].msg).toBe('Step 2 completed');
    expect(logs[2].msg).toBe('Step 3 completed');
  });
});

describe('Integration: Core + Security + Cache', () => {
  let core;
  let security;
  let cache;

  beforeEach(() => {
    core = createCore();

    // 注册安全服务
    core.register('security', () => {
      return {
        encrypt: (data) => Buffer.from(JSON.stringify(data)).toString('base64'),
        decrypt: (encrypted) => JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'))
      };
    }, true);

    // 注册缓存服务
    core.register('cache', () => {
      const store = new Map();
      return {
        get: (key) => store.get(key),
        set: (key, value) => store.set(key, value),
        has: (key) => store.has(key),
        delete: (key) => store.delete(key),
        clear: () => store.clear()
      };
    }, true);

    security = core.get('security');
    cache = core.get('cache');
  });

  it('should cache encrypted data', () => {
    const sensitiveData = { userId: 123, apiKey: 'secret-key-12345' };
    const cacheKey = `user:${sensitiveData.userId}:session`;

    // 加密数据
    const encrypted = security.encrypt(sensitiveData);

    // 缓存加密后的数据
    cache.set(cacheKey, encrypted);

    // 验证缓存存在
    expect(cache.has(cacheKey)).toBe(true);

    // 从缓存获取并解密
    const cachedEncrypted = cache.get(cacheKey);
    const decrypted = security.decrypt(cachedEncrypted);

    expect(decrypted).toEqual(sensitiveData);
    expect(decrypted.apiKey).toBe('secret-key-12345');
  });

  it('should handle cache miss with security fallback', () => {
    const cacheKey = 'session:nonexistent';

    // 尝试从缓存获取
    const cachedData = cache.get(cacheKey);

    expect(cachedData).toBeUndefined();

    // 缓存未命中，创建新数据并加密缓存
    const newData = { sessionId: 'new-session', createdAt: Date.now() };
    const encrypted = security.encrypt(newData);
    cache.set(cacheKey, encrypted);

    // 验证现在可以获取
    const retrieved = cache.get(cacheKey);
    const decrypted = security.decrypt(retrieved);

    expect(decrypted.sessionId).toBe('new-session');
  });

  it('should support cache invalidation with encrypted data', () => {
    const cacheKey = 'user:456:profile';
    const data = { name: 'Alice', email: 'alice@example.com' };

    // 加密并缓存
    cache.set(cacheKey, security.encrypt(data));
    expect(cache.has(cacheKey)).toBe(true);

    // 使缓存失效
    cache.delete(cacheKey);
    expect(cache.has(cacheKey)).toBe(false);

    // 尝试获取应该返回 undefined
    expect(cache.get(cacheKey)).toBeUndefined();
  });

  it('should handle multiple encrypted cache entries', () => {
    const entries = [
      { key: 'user:1', data: { id: 1, name: 'Alice' } },
      { key: 'user:2', data: { id: 2, name: 'Bob' } },
      { key: 'user:3', data: { id: 3, name: 'Charlie' } }
    ];

    // 加密并缓存所有条目
    entries.forEach(({ key, data }) => {
      cache.set(key, security.encrypt(data));
    });

    // 验证所有条目都可以正确解密
    entries.forEach(({ key, data }) => {
      const encrypted = cache.get(key);
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toEqual(data);
    });
  });
});