import { describe, it, expect } from 'vitest';
import { createRouter } from './index.js';

describe('Router - Additional Tests', () => {
  it('should handle multiple route parameters', () => {
    const router = createRouter();
    router.get('/users/:userId/posts/:postId', (ctx) => ({
      userId: ctx.params.userId,
      postId: ctx.params.postId
    }));
    
    const result = router.handle('GET', '/users/123/posts/456');
    expect(result).toEqual({ userId: '123', postId: '456' });
  });

  it('should match routes with same prefix but different parameters', () => {
    const router = createRouter();
    router.get('/users/:id', (ctx) => `user:${ctx.params.id}`);
    router.get('/users/:id/posts', (ctx) => `posts:${ctx.params.id}`);
    
    const userResult = router.handle('GET', '/users/123');
    const postsResult = router.handle('GET', '/users/123/posts');
    
    expect(userResult).toBe('user:123');
    expect(postsResult).toBe('posts:123');
  });

  it('should support all HTTP methods', () => {
    const router = createRouter();
    const results = [];
    
    router.get('/resource', () => { results.push('GET'); return 'GET'; });
    router.post('/resource', () => { results.push('POST'); return 'POST'; });
    router.put('/resource', () => { results.push('PUT'); return 'PUT'; });
    router.delete('/resource', () => { results.push('DELETE'); return 'DELETE'; });
    
    router.handle('GET', '/resource');
    router.handle('POST', '/resource');
    router.handle('PUT', '/resource');
    router.handle('DELETE', '/resource');
    
    expect(results).toEqual(['GET', 'POST', 'PUT', 'DELETE']);
  });

  it('should pass context to handlers', () => {
    const router = createRouter();
    router.get('/test', (ctx) => ({
      params: ctx.params,
      path: ctx.path,
      method: ctx.method,
      customData: ctx.customData
    }));
    
    const result = router.handle('GET', '/test', { customData: 'test-value' });
    
    expect(result.path).toBe('/test');
    expect(result.method).toBe('GET');
    expect(result.customData).toBe('test-value');
  });

  it('should return all registered routes', () => {
    const router = createRouter();
    router.get('/users', () => {});
    router.post('/users', () => {});
    router.get('/users/:id', () => {});
    
    const routes = router.routes();
    expect(routes).toHaveLength(3);
    expect(routes[0]).toEqual({ method: 'GET', pattern: '/users', handler: expect.any(Function) });
    expect(routes[1]).toEqual({ method: 'POST', pattern: '/users', handler: expect.any(Function) });
    expect(routes[2]).toEqual({ method: 'GET', pattern: '/users/:id', handler: expect.any(Function) });
  });
});
