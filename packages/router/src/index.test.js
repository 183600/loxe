import { describe, it, expect } from 'vitest';
import { createRouter } from './index.js';

describe('Router', () => {
  it('should match GET routes', () => {
    const router = createRouter();
    router.get('/users', () => 'users list');
    const result = router.handle('GET', '/users');
    expect(result).toBe('users list');
  });

  it('should parse route parameters', () => {
    const router = createRouter();
    router.get('/users/:id', (ctx) => ctx.params.id);
    const result = router.handle('GET', '/users/123');
    expect(result).toBe('123');
  });

  it('should return null for unmatched routes', () => {
    const router = createRouter();
    router.get('/users', () => 'users');
    const result = router.handle('POST', '/users');
    expect(result).toBeNull();
  });

  it('should handle POST routes', () => {
    const router = createRouter();
    router.post('/users', (ctx) => 'user created');
    const result = router.handle('POST', '/users');
    expect(result).toBe('user created');
  });

  it('should handle PUT routes', () => {
    const router = createRouter();
    router.put('/users/:id', (ctx) => `user ${ctx.params.id} updated`);
    const result = router.handle('PUT', '/users/456');
    expect(result).toBe('user 456 updated');
  });

  it('should handle DELETE routes', () => {
    const router = createRouter();
    router.delete('/users/:id', (ctx) => `user ${ctx.params.id} deleted`);
    const result = router.handle('DELETE', '/users/789');
    expect(result).toBe('user 789 deleted');
  });

  it('should parse multiple route parameters', () => {
    const router = createRouter();
    router.get('/users/:userId/posts/:postId', (ctx) => ({
      userId: ctx.params.userId,
      postId: ctx.params.postId
    }));
    const result = router.handle('GET', '/users/123/posts/456');
    expect(result).toEqual({ userId: '123', postId: '456' });
  });

  it('should match routes with same path but different methods', () => {
    const router = createRouter();
    router.get('/users', () => 'GET users');
    router.post('/users', () => 'POST users');
    router.put('/users', () => 'PUT users');

    expect(router.handle('GET', '/users')).toBe('GET users');
    expect(router.handle('POST', '/users')).toBe('POST users');
    expect(router.handle('PUT', '/users')).toBe('PUT users');
  });

  it('should pass context to route handlers', () => {
    const router = createRouter();
    router.get('/test', (ctx) => {
      return { params: ctx.params, path: ctx.path, method: ctx.method };
    });
    const result = router.handle('GET', '/test', { extra: 'data' });
    expect(result).toEqual({
      params: {},
      path: '/test',
      method: 'GET'
    });
  });

  it('should return list of registered routes', () => {
    const router = createRouter();
    router.get('/users', () => 'users');
    router.post('/users', () => 'create user');
    router.get('/posts', () => 'posts');
    router.delete('/users/:id', () => 'delete user');

    const routes = router.routes();
    expect(routes).toHaveLength(4);
    expect(routes[0]).toEqual({ method: 'GET', pattern: '/users', handler: expect.any(Function) });
    expect(routes[1]).toEqual({ method: 'POST', pattern: '/users', handler: expect.any(Function) });
    expect(routes[2]).toEqual({ method: 'GET', pattern: '/posts', handler: expect.any(Function) });
    expect(routes[3]).toEqual({ method: 'DELETE', pattern: '/users/:id', handler: expect.any(Function) });
  });

  it('should handle case-insensitive HTTP methods', () => {
    const router = createRouter();
    router.get('/test', () => 'GET');
    router.post('/test', () => 'POST');

    expect(router.handle('get', '/test')).toBe('GET');
    expect(router.handle('GET', '/test')).toBe('GET');
    expect(router.handle('post', '/test')).toBe('POST');
    expect(router.handle('POST', '/test')).toBe('POST');
  });

  it('should handle routes with trailing slashes', () => {
    const router = createRouter();
    router.get('/users/', () => 'users with slash');
    const result = router.handle('GET', '/users/');
    expect(result).toBe('users with slash');
  });

  it('should not match routes with different segment counts', () => {
    const router = createRouter();
    router.get('/users/:id', () => 'user');
    const result = router.handle('GET', '/users/123/posts');
    expect(result).toBeNull();
  });

  it('should handle parameter at the end of path', () => {
    const router = createRouter();
    router.get('/api/v1/data/:id', (ctx) => ctx.params.id);
    const result = router.handle('GET', '/api/v1/data/999');
    expect(result).toBe('999');
  });

  it('should handle routes with multiple consecutive parameters', () => {
    const router = createRouter();
    router.get('/:category/:id', (ctx) => ({
      category: ctx.params.category,
      id: ctx.params.id
    }));
    const result = router.handle('GET', '/products/123');
    expect(result).toEqual({ category: 'products', id: '123' });
  });
});
