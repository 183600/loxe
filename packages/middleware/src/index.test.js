import { describe, it, expect } from 'vitest';
import { createMiddleware } from './index.js';

describe('Middleware', () => {
  it('should execute middleware in order', async () => {
    const mw = createMiddleware();
    const order = [];
    
    mw.use(async (ctx, next) => {
      order.push(1);
      await next();
      order.push(3);
    });
    
    mw.use(async (ctx, next) => {
      order.push(2);
      await next();
    });
    
    await mw.execute({});
    expect(order).toEqual([1, 2, 3]);
  });

  it('should pass context through middleware', async () => {
    const mw = createMiddleware();
    
    mw.use(async (ctx, next) => {
      ctx.value = 'test';
      await next();
    });
    
    const ctx = {};
    await mw.execute(ctx);
    expect(ctx.value).toBe('test');
  });

  it('should clear all middleware', async () => {
    const mw = createMiddleware();
    const order = [];
    
    mw.use(async (ctx, next) => {
      order.push(1);
      await next();
    });
    
    mw.use(async (ctx, next) => {
      order.push(2);
      await next();
    });
    
    await mw.execute({});
    expect(order).toHaveLength(2);
    
    mw.clear();
    await mw.execute({});
    expect(order).toHaveLength(2); // 没有增加
  });

  it('should handle errors in middleware', async () => {
    const mw = createMiddleware();
    
    mw.use(async (ctx, next) => {
      ctx.step1 = true;
      await next();
      ctx.step3 = true;
    });
    
    mw.use(async (ctx, next) => {
      ctx.step2 = true;
      throw new Error('Middleware error');
    });
    
    const ctx = {};
    await expect(mw.execute(ctx)).rejects.toThrow('Middleware error');
    expect(ctx.step1).toBe(true);
    expect(ctx.step2).toBe(true);
    expect(ctx.step3).toBeUndefined();
  });

  it('should support async middleware operations', async () => {
    const mw = createMiddleware();
    const results = [];
    
    mw.use(async (ctx, next) => {
      results.push('before-async');
      await new Promise(resolve => setTimeout(resolve, 10));
      await next();
      results.push('after-async');
    });
    
    mw.use(async (ctx, next) => {
      results.push('middleware-2');
    });
    
    await mw.execute({});
    expect(results).toEqual(['before-async', 'middleware-2', 'after-async']);
  });

  it('should handle middleware without calling next', async () => {
    const mw = createMiddleware();
    const order = [];
    
    mw.use(async (ctx, next) => {
      order.push(1);
      // 不调用 next()
    });
    
    mw.use(async (ctx, next) => {
      order.push(2);
    });
    
    await mw.execute({});
    expect(order).toEqual([1]); // 第二个中间件不应该执行
  });
});
