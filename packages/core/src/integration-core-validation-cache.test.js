import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createValidation } from '../../validation/src/index.js';
import { createCache } from '../../cache/src/index.js';

describe('Integration: Core + Validation + Cache', () => {
  it('should cache validated data', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('cache', createCache, true);

    const validation = core.get('validation');
    const cache = core.get('cache');

    const userSchema = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string'],
      email: ['required', 'email']
    });

    const userData = { id: 1, name: 'Alice', email: 'alice@example.com' };
    const validationResult = userSchema(userData);

    expect(validationResult.valid).toBe(true);

    const cacheKey = `user:${userData.id}`;
    cache.set(cacheKey, userData);

    const cachedUser = cache.get(cacheKey);
    expect(cachedUser).toEqual(userData);
  });

  it('should not cache invalid data', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('cache', createCache, true);

    const validation = core.get('validation');
    const cache = core.get('cache');

    const productSchema = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string'],
      price: ['required', 'number', { min: 0 }]
    });

    const invalidProduct = { id: 1, name: 'Widget', price: -10 };
    const validationResult = productSchema(invalidProduct);

    expect(validationResult.valid).toBe(false);

    const cacheKey = `product:${invalidProduct.id}`;
    if (validationResult.valid) {
      cache.set(cacheKey, invalidProduct);
    }

    expect(cache.get(cacheKey)).toBeUndefined();
  });

  it('should create a validated cache service', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('cache', createCache, true);

    core.register('validatedCache', (ctx) => {
      const validation = ctx.get('validation');
      const cache = ctx.get('cache');

      return {
        set(key, value, schema, ttl) {
          const result = schema(value);
          if (!result.valid) {
            return { success: false, errors: result.errors };
          }
          cache.set(key, value, ttl);
          return { success: true };
        },
        get(key) {
          return cache.get(key);
        }
      };
    }, true);

    const validatedCache = core.get('validatedCache');
    const validation = core.get('validation');

    const itemSchema = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string', { minLength: 1 }]
    });

    const validItem = { id: 1, name: 'Item 1' };
    const invalidItem = { id: 2 };

    const validResult = validatedCache.set('item:1', validItem, itemSchema, 1000);
    expect(validResult.success).toBe(true);
    expect(validatedCache.get('item:1')).toEqual(validItem);

    const invalidResult = validatedCache.set('item:2', invalidItem, itemSchema, 1000);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.errors).toBeDefined();
  });

  it('should validate cached data on retrieval', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('cache', createCache, true);

    const validation = core.get('validation');
    const cache = core.get('cache');

    const userSchema = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string', { minLength: 2 }]
    });

    const userData = { id: 1, name: 'Alice' };
    cache.set('user:1', userData);

    const cachedData = cache.get('user:1');
    const validationResult = userSchema(cachedData);

    expect(validationResult.valid).toBe(true);
  });
});