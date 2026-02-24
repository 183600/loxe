import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { MemoryStorage } from '../../storage/src/index.js';
import { registerSchema, validate, clearAllSchemas } from '../../schema/src/index.js';

describe('Integration: Core + Storage + Schema', () => {
  let core;
  let storage;

  beforeEach(async () => {
    clearAllSchemas();
    core = createCore();

    // 注册存储服务
    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage.del(key)
    }), true);

    // 注册 Schema 服务
    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
    clearAllSchemas();
  });

  it('should store and validate data using schema', async () => {
    const schema = core.get('schema');
    const storageService = core.get('storage');

    // 注册用户 schema
    schema.register('user', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name']
    });

    // 验证有效数据
    const validUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    const validationResult = schema.validate('user', validUser);
    expect(validationResult.valid).toBe(true);

    // 存储验证通过的数据
    await storageService.put('user:1', validUser);
    const retrieved = await storageService.get('user:1');
    expect(retrieved).toEqual(validUser);
  });

  it('should reject invalid data before storage', async () => {
    const schema = core.get('schema');
    const storageService = core.get('storage');

    // 注册产品 schema
    schema.register('product', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        price: { type: 'number' }
      },
      required: ['id', 'name', 'price']
    });

    // 验证无效数据（缺少必需字段）
    const invalidProduct = { id: 1, name: 'Widget' };
    const validationResult = schema.validate('product', invalidProduct);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors).toContain("Required property 'price' is missing");

    // 不应该存储无效数据
    if (validationResult.valid) {
      await storageService.put('product:1', invalidProduct);
    }
    const retrieved = await storageService.get('product:1');
    expect(retrieved).toBeNull();
  });

  it('should support schema-based data migration on storage', async () => {
    const schema = core.get('schema');
    const storageService = core.get('storage');

    // 注册旧版本 schema
    schema.register('user:v1', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        firstName: { type: 'string' },
        lastName: { type: 'string' }
      },
      required: ['id', 'firstName', 'lastName']
    });

    // 注册新版本 schema
    schema.register('user:v2', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        fullName: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'fullName']
    });

    // 存储旧版本数据
    const oldUser = { id: 1, firstName: 'John', lastName: 'Doe' };
    await storageService.put('user:1', oldUser);

    // 模拟数据迁移
    const retrieved = await storageService.get('user:1');
    const migratedUser = {
      id: retrieved.id,
      fullName: `${retrieved.firstName} ${retrieved.lastName}`,
      email: 'john.doe@example.com'
    };

    // 验证迁移后的数据符合新 schema
    const validationResult = schema.validate('user:v2', migratedUser);
    expect(validationResult.valid).toBe(true);

    // 存储迁移后的数据
    await storageService.put('user:1', migratedUser);
    const finalUser = await storageService.get('user:1');
    expect(finalUser.fullName).toBe('John Doe');
  });

  it('should handle multiple schemas with shared storage', async () => {
    const schema = core.get('schema');
    const storageService = core.get('storage');

    // 注册多个 schema
    schema.register('user', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    });

    schema.register('post', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        title: { type: 'string' },
        authorId: { type: 'number' }
      },
      required: ['id', 'title', 'authorId']
    });

    // 存储不同类型的数据
    const user = { id: 1, name: 'Alice' };
    const post = { id: 1, title: 'Hello World', authorId: 1 };

    expect(schema.validate('user', user).valid).toBe(true);
    expect(schema.validate('post', post).valid).toBe(true);

    await storageService.put('user:1', user);
    await storageService.put('post:1', post);

    const retrievedUser = await storageService.get('user:1');
    const retrievedPost = await storageService.get('post:1');

    expect(retrievedUser).toEqual(user);
    expect(retrievedPost).toEqual(post);
  });
});
