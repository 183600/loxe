import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createQueryEngine } from '../../query/src/index.js';
import { createRouter } from '../../router/src/index.js';

describe('Integration: Core + Query + Router', () => {
  it('should use query in route handlers', () => {
    const core = createCore();

    core.register('query', createQueryEngine, true);
    core.register('router', createRouter, true);

    const query = core.get('query');
    const router = core.get('router');

    const users = [
      { id: 1, name: 'Alice', role: 'admin' },
      { id: 2, name: 'Bob', role: 'user' },
      { id: 3, name: 'Charlie', role: 'user' }
    ];

    router.get('/users', (ctx) => {
      const { query: queryParams } = ctx;
      const where = queryParams.role ? { role: queryParams.role } : undefined;
      return query({ from: users, where });
    });

    router.get('/users/:id', (ctx) => {
      const { params } = ctx;
      const result = query({ from: users, where: { id: parseInt(params.id) } });
      return result[0] || null;
    });

    const allUsers = router.handle('GET', '/users', { query: {} });
    expect(allUsers).toHaveLength(3);

    const adminUsers = router.handle('GET', '/users', { query: { role: 'admin' } });
    expect(adminUsers).toHaveLength(1);
    expect(adminUsers[0].name).toBe('Alice');

    const user1 = router.handle('GET', '/users/1', { query: {} });
    expect(user1.name).toBe('Alice');

    const user999 = router.handle('GET', '/users/999', { query: {} });
    expect(user999).toBeNull();
  });

  it('should support complex queries in routes', () => {
    const core = createCore();

    core.register('query', createQueryEngine, true);
    core.register('router', createRouter, true);

    const query = core.get('query');
    const router = core.get('router');

    const products = [
      { id: 1, name: 'Laptop', price: 999, category: 'electronics' },
      { id: 2, name: 'Phone', price: 699, category: 'electronics' },
      { id: 3, name: 'Book', price: 20, category: 'books' },
      { id: 4, name: 'Desk', price: 299, category: 'furniture' }
    ];

    router.get('/products', (ctx) => {
      const { query: queryParams } = ctx;
      const where = {};

      if (queryParams.category) {
        where.category = queryParams.category;
      }
      if (queryParams.minPrice) {
        where.price = { ...where.price, $gte: parseInt(queryParams.minPrice) };
      }
      if (queryParams.maxPrice) {
        where.price = { ...where.price, $lte: parseInt(queryParams.maxPrice) };
      }

      return query({ from: products, where: Object.keys(where).length > 0 ? where : undefined });
    });

    const electronics = router.handle('GET', '/products', { query: { category: 'electronics' } });
    expect(electronics).toHaveLength(2);

    const expensive = router.handle('GET', '/products', { query: { minPrice: '500' } });
    expect(expensive).toHaveLength(2);

    const midRange = router.handle('GET', '/products', { query: { minPrice: '100', maxPrice: '500' } });
    expect(midRange).toHaveLength(1);
    expect(midRange[0].name).toBe('Desk');
  });

  it('should handle query errors in routes gracefully', () => {
    const core = createCore();

    core.register('query', createQueryEngine, true);
    core.register('router', createRouter, true);

    const router = core.get('router');

    router.get('/search', (ctx) => {
      const query = core.get('query');
      const { query: queryParams } = ctx;

      try {
        return query({ from: queryParams.data });
      } catch (error) {
        return { error: error.message };
      }
    });

    const result = router.handle('GET', '/search', { query: {} });
    expect(result.error).toContain('Query requires "from" parameter');
  });
});
