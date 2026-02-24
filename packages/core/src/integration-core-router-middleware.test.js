import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { createRouter } from '../../router/src/index.js';
import { createMiddleware } from '../../middleware/src/index.js';

describe('Integration: Core + Router + Middleware', () => {
  it('should apply middleware to route handlers', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('middleware', createMiddleware, true);

    const router = core.get('router');
    const middleware = core.get('middleware');

    // 添加日志中间件
    middleware.use((ctx, next) => {
      ctx.startTime = Date.now();
      next();
      ctx.duration = Date.now() - ctx.startTime;
    });

    // 添加认证中间件
    middleware.use((ctx, next) => {
      if (!ctx.user) {
        ctx.error = 'Unauthorized';
        return;
      }
      next();
    });

    // 注册路由，使用中间件
    router.get('/protected', (ctx) => {
      // 执行中间件链
      middleware.execute(ctx);

      if (ctx.error) {
        return { status: 401, error: ctx.error };
      }

      return {
        status: 200,
        data: { message: 'Protected data' }
      };
    });

    // 测试无用户访问
    const unauthorizedResponse = router.handle('GET', '/protected', {
      user: null
    });
    expect(unauthorizedResponse.status).toBe(401);

    // 测试有用户访问
    const authorizedResponse = router.handle('GET', '/protected', {
      user: { id: 1, name: 'Alice' }
    });
    expect(authorizedResponse.status).toBe(200);
  });

  it('should support route-specific middleware', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('middleware', createMiddleware, true);

    const router = core.get('router');
    const middleware = core.get('middleware');

    // 创建不同的中间件实例
    const adminMiddleware = createMiddleware();
    const publicMiddleware = createMiddleware();

    // 管理员中间件
    adminMiddleware.use((ctx, next) => {
      if (!ctx.user || ctx.user.role !== 'admin') {
        ctx.error = 'Forbidden';
        return;
      }
      next();
    });

    // 公共中间件
    publicMiddleware.use((ctx, next) => {
      ctx.accessedAt = Date.now();
      next();
    });

    // 管理员路由
    router.get('/admin/data', (ctx) => {
      adminMiddleware.execute(ctx);
      if (ctx.error) {
        return { status: 403, error: ctx.error };
      }
      return { status: 200, data: { admin: 'data' } };
    });

    // 公共路由
    router.get('/public/data', (ctx) => {
      publicMiddleware.execute(ctx);
      return { status: 200, data: { public: 'data', accessedAt: ctx.accessedAt } };
    });

    // 测试管理员路由
    const adminResponse = router.handle('GET', '/admin/data', {
      user: { role: 'admin' }
    });
    expect(adminResponse.status).toBe(200);

    const forbiddenResponse = router.handle('GET', '/admin/data', {
      user: { role: 'user' }
    });
    expect(forbiddenResponse.status).toBe(403);

    // 测试公共路由
    const publicResponse = router.handle('GET', '/public/data', {});
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.data.accessedAt).toBeGreaterThan(0);
  });

  it('should handle middleware errors in routes', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('middleware', createMiddleware, true);

    const router = core.get('router');
    const middleware = core.get('middleware');

    // 添加错误处理中间件（第一个）
    middleware.use((ctx, next) => {
      try {
        next();
      } catch (error) {
        ctx.error = error.message;
        ctx.errorCode = 500;
      }
    });

    // 添加可能抛出错误的中间件
    middleware.use((ctx, next) => {
      if (ctx.shouldFail) {
        ctx.error = 'Intentional failure';
        ctx.errorCode = 500;
        return;
      }
      next();
    });

    router.get('/test', (ctx) => {
      middleware.execute(ctx);

      if (ctx.error) {
        return { status: ctx.errorCode, error: ctx.error };
      }

      return { status: 200, data: 'success' };
    });

    // 测试正常情况
    const successResponse = router.handle('GET', '/test', {
      shouldFail: false
    });
    expect(successResponse.status).toBe(200);

    // 测试错误情况
    const errorResponse = router.handle('GET', '/test', {
      shouldFail: true
    });
    expect(errorResponse.status).toBe(500);
    expect(errorResponse.error).toBe('Intentional failure');
  });

  it('should create a middleware-aware router', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('middleware', createMiddleware, true);

    core.register('middlewareRouter', (ctx) => {
      const router = ctx.get('router');
      const middleware = ctx.get('middleware');

      return {
        addGlobalMiddleware(fn) {
          middleware.use(fn);
        },

        registerRoute(method, pattern, handler) {
          router.on(method, pattern, (ctx) => {
            middleware.execute(ctx);
            return handler(ctx);
          });
        },

        handle(method, path, context) {
          return router.handle(method, path, context);
        }
      };
    }, true);

    const mwRouter = core.get('middlewareRouter');

    // 添加全局中间件
    mwRouter.addGlobalMiddleware((ctx, next) => {
      ctx.timestamp = Date.now();
      next();
    });

    // 注册路由
    mwRouter.registerRoute('GET', '/api/data', (ctx) => {
      return {
        status: 200,
        data: { value: 'test', timestamp: ctx.timestamp }
      };
    });

    const response = mwRouter.handle('GET', '/api/data', {});
    expect(response.status).toBe(200);
    expect(response.data.timestamp).toBeGreaterThan(0);
  });

  it('should support middleware composition', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('middleware', createMiddleware, true);

    const router = core.get('router');
    const middleware = core.get('middleware');

    // 创建可组合的中间件
    const withTiming = (ctx, next) => {
      ctx.timings = [];
      ctx.timings.push({ name: 'start', time: Date.now() });
      next();
      ctx.timings.push({ name: 'end', time: Date.now() });
    };

    const withAuth = (ctx, next) => {
      if (!ctx.user) {
        ctx.error = 'Unauthorized';
        return;
      }
      next();
    };

    const withLogging = (ctx, next) => {
      ctx.logs = ctx.logs || [];
      ctx.logs.push(`Processing ${ctx.method} ${ctx.path}`);
      next();
      ctx.logs.push(`Completed ${ctx.method} ${ctx.path}`);
    };

    // 组合中间件
    middleware.use(withTiming);
    middleware.use(withAuth);
    middleware.use(withLogging);

    router.get('/api/resource', (ctx) => {
      middleware.execute(ctx);

      if (ctx.error) {
        return { status: 401, error: ctx.error };
      }

      return {
        status: 200,
        data: {
          resource: 'data',
          timings: ctx.timings,
          logs: ctx.logs
        }
      };
    });

    const response = router.handle('GET', '/api/resource', {
      user: { id: 1 },
      method: 'GET',
      path: '/api/resource'
    });

    expect(response.status).toBe(200);
    expect(response.data.timings).toHaveLength(2);
    expect(response.data.logs).toHaveLength(2);
  });
});