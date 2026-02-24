import { describe, it, expect, vi } from 'vitest';
import { createMiddleware } from './index.js';

describe('Middleware - Additional Tests', () => {
  it('should detect multiple next() calls', async () => {
    const mw = createMiddleware();
    
    mw.use(async (ctx, next) => {
      await next();
      await next(); // 第二次调用应该抛出错误
    });
    
    await expect(mw.execute({})).rejects.toThrow('next() called multiple times');
  });

  it('should support middleware that modifies context before and after next', async () => {
    const mw = createMiddleware();
    const results = [];
    
    mw.use(async (ctx, next) => {
      ctx.before = 'value1';
      results.push('before-1');
      await next();
      ctx.after = 'value2';
      results.push('after-1');
    });
    
    mw.use(async (ctx, next) => {
      results.push('before-2');
      ctx.middle = 'value3';
    });
    
    const ctx = {};
    await mw.execute(ctx);
    
    expect(ctx.before).toBe('value1');
    expect(ctx.after).toBe('value2');
    expect(ctx.middle).toBe('value3');
    expect(results).toEqual(['before-1', 'before-2', 'after-1']);
  });

  it('should handle empty middleware stack', async () => {
    const mw = createMiddleware();
    const ctx = { test: 'value' };
    
    await mw.execute(ctx);
    expect(ctx.test).toBe('value');
  });

  it('should support middleware with conditional next() calls', async () => {
    const mw = createMiddleware();
    const results = [];
    
    mw.use(async (ctx, next) => {
      results.push('mw1-start');
      if (ctx.shouldContinue) {
        await next();
      }
      results.push('mw1-end');
    });
    
    mw.use(async (ctx, next) => {
      results.push('mw2');
    });
    
    // 测试继续执行的情况
    const ctx1 = { shouldContinue: true };
    await mw.execute(ctx1);
    expect(results).toEqual(['mw1-start', 'mw2', 'mw1-end']);
    
    // 测试不继续执行的情况
    results.length = 0;
    const ctx2 = { shouldContinue: false };
    await mw.execute(ctx2);
    expect(results).toEqual(['mw1-start', 'mw1-end']);
  });

  it('should handle middleware that throws synchronously', async () => {
    const mw = createMiddleware();
    const results = [];
    
    mw.use(async (ctx, next) => {
      results.push('before-error');
      await next();
      results.push('after-error');
    });
    
    mw.use(async (ctx, next) => {
      throw new Error('Synchronous error');
    });
    
    const ctx = {};
    await expect(mw.execute(ctx)).rejects.toThrow('Synchronous error');
    expect(results).toEqual(['before-error']);
  });
});
