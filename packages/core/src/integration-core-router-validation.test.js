import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createRouter } from '../../router/src/index.js';
import { createValidation } from '../../validation/src/index.js';

describe('Integration: Core + Router + Validation', () => {
  it('should validate request data before routing', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('validation', createValidation, true);

    const router = core.get('router');
    const validation = core.get('validation');

    // 定义用户创建的验证规则
    const userSchema = validation.schema({
      name: ['required', 'string'],
      email: ['required', 'email'],
      age: ['number', { min: 18 }, { max: 120 }]
    });

    // 注册路由，在处理前验证数据
    router.post('/users', (ctx) => {
      const { body } = ctx;
      const result = userSchema(body);

      if (!result.valid) {
        return { status: 400, errors: result.errors };
      }

      return { status: 201, data: { id: 1, ...body } };
    });

    // 测试有效数据
    const validResponse = router.handle('POST', '/users', {
      body: { name: 'Alice', email: 'alice@example.com', age: 25 }
    });
    expect(validResponse.status).toBe(201);
    expect(validResponse.data.name).toBe('Alice');

    // 测试无效数据
    const invalidResponse = router.handle('POST', '/users', {
      body: { name: 'A', email: 'invalid', age: 15 }
    });
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.errors).toBeDefined();
  });

  it('should validate path parameters in routes', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('validation', createValidation, true);

    const router = core.get('router');
    const validation = core.get('validation');

    // 定义 ID 验证规则
    const validateId = (value) => {
      const numValue = parseInt(value, 10);
      const result = validation.validate(numValue, ['number', { min: 1 }]);
      return result.valid ? numValue : null;
    };

    router.get('/users/:id', (ctx) => {
      const { params } = ctx;
      const id = validateId(params.id);

      if (!id) {
        return { status: 400, error: 'Invalid user ID' };
      }

      return { status: 200, data: { id, name: 'User ' + id } };
    });

    // 测试有效 ID
    const validResponse = router.handle('GET', '/users/123');
    expect(validResponse.status).toBe(200);
    expect(validResponse.data.id).toBe(123);

    // 测试无效 ID（非数字）
    const invalidResponse1 = router.handle('GET', '/users/abc');
    expect(invalidResponse1.status).toBe(400);

    // 测试无效 ID（负数）
    const invalidResponse2 = router.handle('GET', '/users/-1');
    expect(invalidResponse2.status).toBe(400);
  });

  it('should support query parameter validation', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('validation', createValidation, true);

    const router = core.get('router');
    const validation = core.get('validation');

    router.get('/products', (ctx) => {
      const { query } = ctx;
      
      // 转换字符串参数为数字
      const page = query.page ? parseInt(query.page, 10) : 1;
      const limit = query.limit ? parseInt(query.limit, 10) : 10;
      
      // 验证转换后的值
      const pageResult = validation.validate(page, ['number', { min: 1 }]);
      const limitResult = validation.validate(limit, ['number', { min: 1 }, { max: 100 }]);
      
      if (!pageResult.valid || !limitResult.valid) {
        return { status: 400, errors: { page: pageResult.errors, limit: limitResult.errors } };
      }

      return {
        status: 200,
        data: { products: [], pagination: { page, limit } }
      };
    });

    // 测试有效查询参数
    const validResponse = router.handle('GET', '/products', {
      query: { page: '2', limit: '20' }
    });
    expect(validResponse.status).toBe(200);
    expect(validResponse.data.pagination.page).toBe(2);

    // 测试无效查询参数
    const invalidResponse = router.handle('GET', '/products', {
      query: { page: '-1', limit: '200' }
    });
    expect(invalidResponse.status).toBe(400);
  });

  it('should create a validated router service', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('validation', createValidation, true);

    // 先获取 validation 实例用于创建 schema
    const validation = core.get('validation');

    core.register('validatedRouter', (ctx) => {
      const router = ctx.get('router');

      return {
        registerRoute(method, path, schema, handler) {
          router.on(method, path, (ctx) => {
            const { body } = ctx;

            const result = schema(body);

            if (!result.valid) {
              return { status: 400, errors: result.errors };
            }

            return handler(ctx);
          });
        },

        handle(method, path, context) {
          return router.handle(method, path, context);
        }
      };
    }, true);

    const validatedRouter = core.get('validatedRouter');

    // 定义请求验证 schema
    const requestSchema = validation.schema({
      title: ['required', 'string'],
      content: ['required', 'string']
    });

    validatedRouter.registerRoute(
      'POST',
      '/posts',
      requestSchema,
      (ctx) => ({ status: 200, data: ctx.body })
    );

    // 测试有效请求
    const validResponse = validatedRouter.handle('POST', '/posts', {
      body: { title: 'Hello', content: 'World' }
    });
    expect(validResponse.status).toBe(200);

    // 测试无效请求
    const invalidResponse = validatedRouter.handle('POST', '/posts', {
      body: { title: 'Hello' }
    });
    expect(invalidResponse.status).toBe(400);
  });
});