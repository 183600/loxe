import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createValidation } from '../../validation/src/index.js';
import { createSecurityContext } from '../../security/src/index.js';

describe('Integration: Core + Validation + Security', () => {
  it('should validate data before security operations', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('security', () => createSecurityContext(core), true);

    const validation = core.get('validation');
    const security = core.get('security');

    // 定义用户数据验证规则
    const userSchema = validation.schema({
      id: ['required', 'number'],
      username: ['required', 'string', { minLength: 3 }],
      email: ['required', 'email']
    });

    // 设置安全策略
    security.addPolicy({
      action: 'encrypt_user',
      principalAttributes: {
        role: 'admin'
      }
    });

    // 验证并加密用户数据
    const userData = { id: 1, username: 'alice', email: 'alice@example.com' };
    const validationResult = userSchema(userData);

    expect(validationResult.valid).toBe(true);

    // 验证通过后加密
    const encrypted = security.encrypt(userData);
    expect(encrypted).toBeTruthy();
    expect(encrypted).not.toEqual(JSON.stringify(userData));

    // 解密并验证
    const decrypted = security.decrypt(encrypted);
    expect(decrypted).toEqual(userData);
  });

  it('should enforce security policies on validation results', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('security', () => createSecurityContext(core), true);

    const validation = core.get('validation');
    const security = core.get('security');

    // 定义敏感数据验证规则
    const sensitiveDataSchema = validation.schema({
      ssn: ['required', 'string'],
      creditCard: ['required', 'string'],
      amount: ['required', 'number', { min: 0 }]
    });

    // 设置访问控制策略
    security.setPrincipal({ id: 'user1', role: 'user' });
    security.addPolicy({
      action: 'view_sensitive',
      principalAttributes: {
        role: 'admin'
      }
    });

    const sensitiveData = {
      ssn: '123-45-6789',
      creditCard: '4111-1111-1111-1111',
      amount: 1000
    };

    // 验证数据
    const validationResult = sensitiveDataSchema(sensitiveData);
    expect(validationResult.valid).toBe(true);

    // 检查是否有权限查看敏感数据
    const canView = security.can('view_sensitive', {});
    expect(canView).toBe(false);

    // 根据权限返回部分数据
    const filteredData = canView ? sensitiveData : {
      amount: sensitiveData.amount,
      ssn: '***-**-****',
      creditCard: '****-****-****-****'
    };

    expect(filteredData.ssn).toBe('***-**-****');
    expect(filteredData.creditCard).toBe('****-****-****-****');
  });

  it('should create a secure validation service', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('security', () => createSecurityContext(core), true);

    core.register('secureValidation', (ctx) => {
      const validation = ctx.get('validation');
      const security = ctx.get('security');

      return {
        // 验证并加密数据
        validateAndEncrypt(schemaName, data) {
          const schema = validation.schema({
            id: ['required', 'number'],
            content: ['required', 'string']
          });

          const result = schema(data);

          if (!result.valid) {
            return { success: false, errors: result.errors };
          }

          const encrypted = security.encrypt(data);
          return { success: true, encrypted };
        },

        // 解密并验证数据
        decryptAndValidate(schemaName, encryptedData) {
          const decrypted = security.decrypt(encryptedData);

          const schema = validation.schema({
            id: ['required', 'number'],
            content: ['required', 'string']
          });

          const result = schema(decrypted);

          if (!result.valid) {
            return { success: false, errors: result.errors };
          }

          return { success: true, data: decrypted };
        },

        // 验证并检查权限
        validateWithPermission(schemaName, data, action, resource) {
          const schema = validation.schema({
            id: ['required', 'number'],
            type: ['required', 'string']
          });

          const result = schema(data);

          if (!result.valid) {
            return { success: false, errors: result.errors };
          }

          const hasPermission = security.can(action, resource);

          if (!hasPermission) {
            return { success: false, error: 'Permission denied' };
          }

          return { success: true, data };
        }
      };
    }, true);

    const secureValidation = core.get('secureValidation');
    const security = core.get('security');

    // 设置安全策略
    security.addPolicy({
      action: 'create',
      principalAttributes: {
        role: 'admin'
      }
    });

    security.setPrincipal({ role: 'admin' });

    // 测试验证并加密
    const data = { id: 1, content: 'Secret message' };
    const encryptResult = secureValidation.validateAndEncrypt('message', data);
    expect(encryptResult.success).toBe(true);
    expect(encryptResult.encrypted).toBeTruthy();

    // 测试解密并验证
    const decryptResult = secureValidation.decryptAndValidate('message', encryptResult.encrypted);
    expect(decryptResult.success).toBe(true);
    expect(decryptResult.data).toEqual(data);

    // 测试验证并检查权限
    const permissionResult = secureValidation.validateWithPermission(
      'resource',
      { id: 1, type: 'document' },
      'create',
      { type: 'document' }
    );
    expect(permissionResult.success).toBe(true);
  });

  it('should handle validation errors securely', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('security', () => createSecurityContext(core), true);

    const validation = core.get('validation');
    const security = core.get('security');

    // 定义验证规则
    const loginSchema = validation.schema({
      username: ['required', 'string'],
      password: ['required', 'string', { minLength: 8 }]
    });

    // 测试无效数据
    const invalidData = { username: 'user', password: 'short' };
    const result = loginSchema(invalidData);

    expect(result.valid).toBe(false);
    expect(result.errors.password).toBeDefined();

    // 安全地处理错误信息（不泄露敏感信息）
    const secureErrors = {};
    for (const [field, errors] of Object.entries(result.errors)) {
      secureErrors[field] = 'Invalid value';
    }

    expect(secureErrors.password).toBe('Invalid value');
    expect(secureErrors.password).not.toContain('minLength');
  });

  it('should support field-level security in validation', () => {
    const core = createCore();

    core.register('validation', createValidation, true);
    core.register('security', () => createSecurityContext(core), true);

    const validation = core.get('validation');
    const security = core.get('security');

    // 定义带安全级别的验证规则
    const profileSchema = validation.schema({
      id: ['required', 'number'],
      name: ['required', 'string'],
      email: ['required', 'email'],
      phone: ['string'],
      address: ['string']
    });

    // 定义字段安全级别
    const fieldSecurity = {
      id: 'public',
      name: 'public',
      email: 'protected',
      phone: 'private',
      address: 'private'
    };

    // 设置当前用户权限
    security.setPrincipal({ role: 'user' });

    const profileData = {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '555-1234',
      address: '123 Main St'
    };

    // 验证数据
    const validationResult = profileSchema(profileData);
    expect(validationResult.valid).toBe(true);

    // 根据权限过滤字段
    const userRole = security.principal.role;
    const filteredData = {};

    for (const [field, value] of Object.entries(profileData)) {
      const securityLevel = fieldSecurity[field];

      if (securityLevel === 'public') {
        filteredData[field] = value;
      } else if (securityLevel === 'protected' && userRole === 'user') {
        filteredData[field] = value;
      } else if (securityLevel === 'private' && userRole === 'admin') {
        filteredData[field] = value;
      }
    }

    expect(filteredData.id).toBe(1);
    expect(filteredData.name).toBe('John Doe');
    expect(filteredData.email).toBe('john@example.com');
    expect(filteredData.phone).toBeUndefined();
    expect(filteredData.address).toBeUndefined();
  });
});