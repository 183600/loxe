import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from '../../core/src/index.js';
import { registerSchema, validate as schemaValidate, clearAllSchemas } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Integration: Schema + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();
    storage = createStorage('memory');
    await storage.open();
    clearAllSchemas();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should validate data before storing', async () => {
    const userSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name', 'email']
    };

    registerSchema('user', userSchema);

    const userData = {
      id: 'user-1',
      name: 'John Doe',
      email: 'john@example.com'
    };

    // Validate before storing
    const validationResult = schemaValidate('user', userData);
    expect(validationResult.valid).toBe(true);

    // Store validated data
    await storage.put(`user:${userData.id}`, userData);
    const retrieved = await storage.get(`user:${userData.id}`);
    expect(retrieved).toEqual(userData);
  });

  it('should reject invalid data before storing', async () => {
    const userSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['id', 'name']
    };

    registerSchema('user', userSchema);

    const invalidData = {
      id: 'user-1',
      name: 'John',
      age: 'not-a-number' // Invalid type
    };

    // Validate before storing
    const validationResult = schemaValidate('user', invalidData);
    expect(validationResult.valid).toBe(false);
    expect(validationResult.errors).toContain("age: Expected type 'number', but got 'string'");

    // Should not store invalid data
    // (In real implementation, you would throw an error here)
  });

  it('should validate data retrieved from storage', async () => {
    const productSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' },
        inStock: { type: 'boolean' }
      },
      required: ['id', 'name', 'price']
    };

    registerSchema('product', productSchema);

    const productData = {
      id: 'prod-1',
      name: 'Widget',
      price: 99.99,
      inStock: true
    };

    await storage.put(`product:${productData.id}`, productData);

    // Retrieve and validate
    const retrieved = await storage.get(`product:${productData.id}`);
    const validationResult = schemaValidate('product', retrieved);
    expect(validationResult.valid).toBe(true);
  });

  it('should handle schema validation with storage transactions', async () => {
    const orderSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        userId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number' }
            },
            required: ['productId', 'quantity']
          }
        }
      },
      required: ['id', 'userId', 'items']
    };

    registerSchema('order', orderSchema);

    const orderData = {
      id: 'order-1',
      userId: 'user-1',
      items: [
        { productId: 'prod-1', quantity: 2 },
        { productId: 'prod-2', quantity: 1 }
      ]
    };

    // Validate before transaction
    const validationResult = schemaValidate('order', orderData);
    expect(validationResult.valid).toBe(true);

    // Store in transaction
    const tx = await storage.tx();
    await tx.put(`order:${orderData.id}`, orderData);
    await tx.commit();

    // Verify stored data
    const retrieved = await storage.get(`order:${orderData.id}`);
    expect(retrieved).toEqual(orderData);
  });

  it('should validate multiple items from storage scan', async () => {
    const userSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' }
      },
      required: ['id', 'name']
    };

    registerSchema('user', userSchema);

    const users = [
      { id: 'user-1', name: 'Alice' },
      { id: 'user-2', name: 'Bob' },
      { id: 'user-3', name: 'Charlie' }
    ];

    // Store all users
    for (const user of users) {
      await storage.put(`user:${user.id}`, user);
    }

    // Scan and validate
    const results = await storage.scan({ prefix: 'user:' });
    expect(results).toHaveLength(3);

    for (const { key, value } of results) {
      const validationResult = schemaValidate('user', value);
      expect(validationResult.valid).toBe(true);
    }
  });

  it('should handle schema migration with stored data', async () => {
    // Old schema version
    const userSchemaV1 = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' }
      },
      required: ['id', 'firstName', 'lastName']
    };

    registerSchema('user-v1', userSchemaV1);

    const oldUserData = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe'
    };

    // Validate and store old data
    const v1Validation = schemaValidate('user-v1', oldUserData);
    expect(v1Validation.valid).toBe(true);
    await storage.put(`user:${oldUserData.id}`, oldUserData);

    // New schema version
    const userSchemaV2 = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        fullName: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'fullName']
    };

    registerSchema('user-v2', userSchemaV2);

    // Migrate data
    const retrieved = await storage.get(`user:${oldUserData.id}`);
    const migratedData = {
      id: retrieved.id,
      fullName: `${retrieved.firstName} ${retrieved.lastName}`,
      email: null
    };

    // Validate migrated data
    const v2Validation = schemaValidate('user-v2', migratedData);
    expect(v2Validation.valid).toBe(true);
  });

  it('should validate nested objects from storage', async () => {
    const profileSchema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' }
          },
          required: ['name']
        },
        preferences: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            notifications: { type: 'boolean' }
          }
        }
      },
      required: ['id', 'user']
    };

    registerSchema('profile', profileSchema);

    const profileData = {
      id: 'profile-1',
      user: {
        name: 'Alice',
        age: 30
      },
      preferences: {
        theme: 'dark',
        notifications: true
      }
    };

    await storage.put(`profile:${profileData.id}`, profileData);

    const retrieved = await storage.get(`profile:${profileData.id}`);
    const validationResult = schemaValidate('profile', retrieved);
    expect(validationResult.valid).toBe(true);
  });
});