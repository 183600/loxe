import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createValidation } from '../../validation/src/index.js';
import { registerSchema, validate, clearAllSchemas } from '../../schema/src/index.js';

describe('Integration: Core + Validation + Schema', () => {
  beforeEach(() => {
    clearAllSchemas();
  });

  afterEach(() => {
    clearAllSchemas();
  });

  it('should integrate validation with schema definitions', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    const validation = core.get('validation');
    const schema = core.get('schema');

    // 使用 schema 模块注册 schema
    schema.register('product', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        price: { type: 'number' }
      },
      required: ['id', 'name', 'price']
    });

    // 使用 validation 模块创建验证器
    const productValidator = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string'],
      price: ['required', 'number', { min: 0 }]
    });

    const validProduct = { id: 1, name: 'Widget', price: 19.99 };

    // 两种验证方式都应该通过
    const schemaResult = schema.validate('product', validProduct);
    const validationResult = productValidator(validProduct);

    expect(schemaResult.valid).toBe(true);
    expect(validationResult.valid).toBe(true);
  });

  it('should create a unified validation service', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('unifiedValidation', (ctx) => {
      const validation = ctx.get('validation');
      const schema = ctx.get('schema');

      return {
        // 使用 schema 模块注册
        registerSchema(name, definition) {
          schema.register(name, definition);
        },

        // 使用 validation 模块验证
        validateWithRules(value, rules) {
          return validation.validate(value, rules);
        },

        // 使用 schema 模块验证
        validateWithSchema(name, data) {
          return schema.validate(name, data);
        },

        // 创建组合验证器
        createCombinedValidator(schemaName, additionalRules) {
          return (data) => {
            const schemaResult = schema.validate(schemaName, data);
            if (!schemaResult.valid) {
              return schemaResult;
            }

            const errors = {};
            for (const [field, rules] of Object.entries(additionalRules)) {
              const result = validation.validate(data[field], rules);
              if (!result.valid) {
                errors[field] = result.errors;
              }
            }

            return { valid: Object.keys(errors).length === 0, errors };
          };
        }
      };
    }, true);

    const unifiedValidation = core.get('unifiedValidation');

    // 注册基础 schema
    unifiedValidation.registerSchema('user', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      required: ['id', 'name', 'email']
    });

    // 创建组合验证器（schema + 额外规则）
    const userValidator = unifiedValidation.createCombinedValidator('user', {
      email: ['email'],
      name: [{ minLength: 2 }]
    });

    // 测试有效数据
    const validUser = { id: 1, name: 'Alice', email: 'alice@example.com' };
    const validResult = userValidator(validUser);
    expect(validResult.valid).toBe(true);

    // 测试无效数据
    const invalidUser = { id: 1, name: 'A', email: 'invalid-email' };
    const invalidResult = userValidator(invalidUser);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.email).toBeDefined();
    expect(invalidResult.errors.name).toBeDefined();
  });

  it('should support schema-based validation rules', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('schemaValidation', (ctx) => {
      const validation = ctx.get('validation');
      const schema = ctx.get('schema');

      // 将 schema 转换为 validation 规则
      const schemaToRules = (schemaName) => {
        const registeredSchema = schema.register(schemaName, {
          type: 'object',
          properties: {},
          required: []
        });

        return (data) => {
          const result = schema.validate(schemaName, data);
          return { valid: result.valid, errors: result.errors || [] };
        };
      };

      return {
        registerSchema: schema.register.bind(schema),
        validate: schema.validate.bind(schema),
        schemaToRules
      };
    }, true);

    const schemaValidation = core.get('schemaValidation');

    // 注册 schema
    schemaValidation.registerSchema('order', {
      type: 'object',
      properties: {
        id: { type: 'number' },
        items: { type: 'array' },
        total: { type: 'number' }
      },
      required: ['id', 'items', 'total']
    });

    // 使用 schema 验证
    const validOrder = { id: 1, items: [{ id: 1, qty: 2 }], total: 39.98 };
    const result = schemaValidation.validate('order', validOrder);
    expect(result.valid).toBe(true);
  });

  it('should handle cross-field validation', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('crossFieldValidation', (ctx) => {
      const validation = ctx.get('validation');
      const schema = ctx.get('schema');

      return {
        validatePasswordMatch(data) {
          const errors = {};

          // 基础验证
          const passwordResult = validation.validate(data.password, ['required', { minLength: 8 }]);
          if (!passwordResult.valid) {
            errors.password = passwordResult.errors;
          }

          // 跨字段验证：密码确认
          if (data.password !== data.confirmPassword) {
            errors.confirmPassword = ['Passwords do not match'];
          }

          return { valid: Object.keys(errors).length === 0, errors };
        },

        validateDateRange(data) {
          const errors = {};

          // 跨字段验证：开始日期不能晚于结束日期
          if (data.startDate && data.endDate) {
            if (new Date(data.startDate) > new Date(data.endDate)) {
              errors.dateRange = ['Start date must be before end date'];
            }
          }

          return { valid: Object.keys(errors).length === 0, errors };
        }
      };
    }, true);

    const crossFieldValidation = core.get('crossFieldValidation');

    // 测试密码匹配
    const validPassword = { password: 'secure123', confirmPassword: 'secure123' };
    const passwordResult = crossFieldValidation.validatePasswordMatch(validPassword);
    expect(passwordResult.valid).toBe(true);

    const invalidPassword = { password: 'secure123', confirmPassword: 'different' };
    const invalidPasswordResult = crossFieldValidation.validatePasswordMatch(invalidPassword);
    expect(invalidPasswordResult.valid).toBe(false);

    // 测试日期范围
    const validDates = { startDate: '2024-01-01', endDate: '2024-12-31' };
    const dateResult = crossFieldValidation.validateDateRange(validDates);
    expect(dateResult.valid).toBe(true);

    const invalidDates = { startDate: '2024-12-31', endDate: '2024-01-01' };
    const invalidDateResult = crossFieldValidation.validateDateRange(invalidDates);
    expect(invalidDateResult.valid).toBe(false);
  });
});