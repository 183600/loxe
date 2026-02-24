import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createMiddleware } from '../../middleware/src/index.js';
import { createRouter } from '../../router/src/index.js';

describe('Integration: Core + Middleware + Router', () => {
  it('should apply middleware to route handlers', () => {
    const core = createCore();

    core.register('middleware', createMiddleware, true);
    core.register('router', createRouter, true);

    const middleware = core.get('middleware');
    const router = core.get('router');

    const logs = [];

    middleware.use(async (ctx, next) => {
      ctx.startTime = Date.now();
      logs.push('middleware: before');
      await next();
      ctx.duration = Date.now() - ctx.startTime;
      logs.push('middleware: after');
    });

    core.register('middlewareRouter', (ctx) => {
      const router = ctx.get('router');
      const middleware = ctx.get('middleware');

      return {
        get(pattern, handler) {
          router.get(pattern, async (ctx) => {
            const mwCtx = { ...ctx, operation: 'route' };
            await middleware.execute(mwCtx);
            return handler(ctx);
          });
        },
        handle(method, path, context) {
          const result = router.handle(method, path, context);
          // 如果结果是 Promise，需要等待
          return result && typeof result.then === 'function' ? result : result;
        }
      };
    }, true);

    const mwRouter = core.get('middlewareRouter');

    mwRouter.get('/test', (ctx) => {
      return { message: 'Hello' };
    });

    const result = mwRouter.handle('GET', '/test');
    expect(result.message).toBe('Hello');
    expect(logs).toEqual(['middleware: before', 'middleware: after']);
  });

  it('should handle middleware errors in routes', () => {
    const core = createCore();

    core.register('middleware', createMiddleware, true);
    core.register('router', createRouter, true);

    const middleware = core.get('middleware');
    const router = core.get('router');

    middleware.use(async (ctx, next) => {
      if (ctx.path === '/error') {
        throw new Error('Middleware error');
      }
      await next();
    });

    core.register('errorHandlingRouter', (ctx) => {
      const router = ctx.get('router');
      const middleware = ctx.get('middleware');

      return {
        get(pattern, handler) {
          router.get(pattern, async (ctx) => {
            try {
              const mwCtx = { ...ctx, path: ctx.path };
              await middleware.execute(mwCtx);
              return handler(ctx);
            } catch (error) {
              return { error: error.message };
            }
          });
        },
        handle(method, path, context) {
          const result = router.handle(method, path, context);
          return result && typeof result.then === 'function' ? result : result;
        }
      };
    }, true);

    const errorRouter = core.get('errorHandlingRouter');

    errorRouter.get('/error', (ctx) => ({ success: true }));
    errorRouter.get('/ok', (ctx) => ({ success: true }));

    const errorResult = errorRouter.handle('GET', '/error');
    expect(errorResult.error).toBe('Middleware error');

    const okResult = errorRouter.handle('GET', '/ok');
    expect(okResult.success).toBe(true);
  });

  it('should support multiple middleware in routes', () => {
    const core = createCore();

    core.register('middleware', createMiddleware, true);
    core.register('router', createRouter, true);

    const middleware = core.get('middleware');
    const router = core.get('router');

    const executionOrder = [];

    middleware.use(async (ctx, next) => {
      executionOrder.push('mw1: before');
      ctx.mw1 = true;
      await next();
      executionOrder.push('mw1: after');
    });

    middleware.use(async (ctx, next) => {
      executionOrder.push('mw2: before');
      ctx.mw2 = true;
      await next();
      executionOrder.push('mw2: after');
    });

    core.register('multiMiddlewareRouter', (ctx) => {
      const router = ctx.get('router');
      const middleware = ctx.get('middleware');

      return {
        get(pattern, handler) {
          router.get(pattern, async (ctx) => {
            const mwCtx = { ...ctx };
            await middleware.execute(mwCtx);
            return handler({ ...ctx, mw1: mwCtx.mw1, mw2: mwCtx.mw2 });
          });
        },
        handle(method, path, context) {
          const result = router.handle(method, path, context);
          return result && typeof result.then === 'function' ? result : result;
        }
      };
    }, true);

    const multiRouter = core.get('multiMiddlewareRouter');

    multiRouter.get('/test', (ctx) => {
      return {
        success: true,
        mw1: ctx.mw1,
        mw2: ctx.mw2
      };
    });

    const result = multiRouter.handle('GET', '/test');
    expect(result.success).toBe(true);
    expect(result.mw1).toBe(true);
    expect(result.mw2).toBe(true);
    expect(executionOrder).toEqual([
      'mw1: before',
      'mw2: before',
      'mw2: after',
      'mw1: after'
    ]);
  });

  it('should support authentication middleware in routes', () => {
    const core = createCore();

    core.register('middleware', createMiddleware, true);
    core.register('router', createRouter, true);

    const middleware = core.get('middleware');
    const router = core.get('router');

    middleware.use(async (ctx, next) => {
      const token = ctx.headers?.authorization;
      if (!token) {
        ctx.unauthorized = true;
        return;
      }
      ctx.user = { id: 1, name: 'Alice' };
      await next();
    });

    core.register('authRouter', (ctx) => {
      const router = ctx.get('router');
      const middleware = ctx.get('middleware');

      return {
        get(pattern, handler) {
          router.get(pattern, async (ctx) => {
            const mwCtx = { ...ctx, headers: ctx.headers };
            await middleware.execute(mwCtx);
            if (mwCtx.unauthorized) {
              return { status: 401, error: 'Unauthorized' };
            }
            return handler({ ...ctx, user: mwCtx.user });
          });
        },
        handle(method, path) {
          const result = router.handle(method, path);
          return result && typeof result.then === 'function' ? result : result;
        }
      };
    }, true);

    const authRouter = core.get('authRouter');

    authRouter.get('/protected', (ctx) => {
      return { status: 200, user: ctx.user };
    });

    const unauthorizedResult = authRouter.handle('GET', '/protected');
    expect(unauthorizedResult.status).toBe(401);

    const authorizedResult = authRouter.handle('GET', '/protected', {
      headers: { authorization: 'Bearer token123' }
    });
    expect(authorizedResult.status).toBe(200);
    expect(authorizedResult.user.name).toBe('Alice');
  });
});