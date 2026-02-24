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
});
