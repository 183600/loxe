import { describe, it, expect } from 'bun:test';
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
});
