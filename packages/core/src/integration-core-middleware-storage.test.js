import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { MemoryStorage } from '../../storage/src/index.js';
import { createMiddleware } from '../../middleware/src/index.js';

describe('Integration: Core + Middleware + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();

    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      get: async (key) => storage.get(key),
      put: async (key, value) => storage.put(key, value),
      del: async (key) => storage.del(key)
    }), true);

    core.register('middleware', createMiddleware, true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should apply middleware to storage operations', async () => {
    const storageService = core.get('storage');
    const middleware = core.get('middleware');

    // 添加日志中间件
    middleware.use(async (ctx, next) => {
      const startTime = Date.now();
      ctx.metadata = { startTime };
      await next();
      const duration = Date.now() - ctx.metadata.startTime;
      ctx.metadata.duration = duration;
    });

    // 添加验证中间件
    middleware.use(async (ctx, next) => {
      if (ctx.operation === 'put' && ctx.value) {
        // 验证数据不为空
        if (typeof ctx.value === 'object' && Object.keys(ctx.value).length === 0) {
          throw new Error('Cannot store empty object');
        }
      }
      await next();
    });

    // 创建中间件包装的存储服务
    core.register('middlewareStorage', (ctx) => {
      const storage = ctx.get('storage');
      const middleware = ctx.get('middleware');

      return {
        async get(key) {
          const context = { operation: 'get', key };
          await middleware.execute(context);
          return storage.get(key);
        },

        async put(key, value) {
          const context = { operation: 'put', key, value };
          await middleware.execute(context);
          return storage.put(key, value);
        }
      };
    }, true);

    const mwStorage = core.get('middlewareStorage');

    // 测试 put 操作
    await mwStorage.put('user:1', { name: 'Alice', age: 30 });
    const result = await mwStorage.get('user:1');
    expect(result).toEqual({ name: 'Alice', age: 30 });
  });

  it('should handle middleware errors gracefully', async () => {
    const middleware = core.get('middleware');

    // 添加权限检查中间件
    middleware.use(async (ctx, next) => {
      if (ctx.operation === 'put' && ctx.key.startsWith('admin:')) {
        if (!ctx.user || ctx.user.role !== 'admin') {
          throw new Error('Permission denied: admin access required');
        }
      }
      await next();
    });

    core.register('secureStorage', (ctx) => {
      const storage = ctx.get('storage');
      const middleware = ctx.get('middleware');

      return {
        async put(key, value, user) {
          const context = { operation: 'put', key, value, user };
          try {
            await middleware.execute(context);
            return storage.put(key, value);
          } catch (error) {
            return { error: error.message };
          }
        }
      };
    }, true);

    const secureStorage = core.get('secureStorage');

    // 普通用户尝试写入 admin 数据
    const result1 = await secureStorage.put('admin:config', { debug: true }, { role: 'user' });
    expect(result1).toEqual({ error: 'Permission denied: admin access required' });

    // 管理员写入 admin 数据
    const result2 = await secureStorage.put('admin:config', { debug: true }, { role: 'admin' });
    expect(result2).toBeUndefined(); // 成功，没有错误
  });

  it('should support middleware chain with multiple storage operations', async () => {
    const middleware = core.get('middleware');

    const operations = [];

    // 添加操作记录中间件
    middleware.use(async (ctx, next) => {
      operations.push({ operation: ctx.operation, key: ctx.key });
      await next();
    });

    // 添加缓存中间件
    const cache = new Map();
    middleware.use(async (ctx, next) => {
      if (ctx.operation === 'get') {
        const cached = cache.get(ctx.key);
        if (cached !== undefined) {
          ctx.fromCache = true;
          return;
        }
      }
      await next();
      if (ctx.operation === 'put') {
        cache.set(ctx.key, ctx.value);
      }
    });

    core.register('cachedMiddlewareStorage', (ctx) => {
      const storage = ctx.get('storage');
      const middleware = ctx.get('middleware');

      return {
        async get(key) {
          const context = { operation: 'get', key };
          await middleware.execute(context);
          if (context.fromCache) {
            return cache.get(key);
          }
          return storage.get(key);
        },

        async put(key, value) {
          const context = { operation: 'put', key, value };
          await middleware.execute(context);
          return storage.put(key, value);
        }
      };
    }, true);

    const mwStorage = core.get('cachedMiddlewareStorage');

    // 测试缓存
    await mwStorage.put('key1', 'value1');
    await mwStorage.put('key2', 'value2');

    // 第一次获取 - 从存储
    await mwStorage.get('key1');
    expect(operations).toHaveLength(3); // 2 puts + 1 get

    // 第二次获取 - 从缓存
    await mwStorage.get('key1');
    expect(operations).toHaveLength(4); // 只增加 1 个 get 记录
  });
});