import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createSecurityContext } from '../../security/src/index.js';
import { MemoryStorage } from '../../storage/src/index.js';

describe('Integration: Core + Security + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();
    storage = new MemoryStorage();
    await storage.open();

    // 注册存储服务
    core.register('storage', () => ({
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage
        .del(key)
    }), true);

    // 注册安全服务
    core.register('security', (ctx) => createSecurityContext(ctx), true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should encrypt data before storage', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 设置安全上下文
    security.setPrincipal({ id: 'user1', role: 'admin' });

    // 加密敏感数据
    const sensitiveData = { password: 'secret123', apiKey: 'abc123xyz' };
    const encrypted = security.encrypt(sensitiveData);

    // 存储加密后的数据
    await storageService.put('credentials:user1', encrypted);

    // 从存储中获取并解密
    const retrieved = await storageService.get('credentials:user1');
    const decrypted = security.decrypt(retrieved);

    expect(decrypted).toEqual(sensitiveData);
    expect(retrieved).not.toEqual(JSON.stringify(sensitiveData));
  });

  it('should enforce access control on storage operations', async () => {
    const security = core.get('security');

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'user', department: 'sales' });

    // 添加策略：用户只能读取自己部门的文档
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        department: 'sales'
      }
    });

    // 添加策略：管理员可以读取所有文档
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'admin'
      }
    });

    // 用户可以读取销售部门的文档
    expect(security.can('read', { type: 'document', department: 'sales' })).toBe(true);

    // 用户不能读取其他部门的文档
    expect(security.can('read', { type: 'document', department: 'engineering' })).toBe(false);

    // 切换到管理员
    security.setPrincipal({ id: 'admin1', role: 'admin' });

    // 管理员可以读取所有文档
    expect(security.can('read', { type: 'document', department: 'sales' })).toBe(true);
    expect(security.can('read', { type: 'document', department: 'engineering' })).toBe(true);
  });

  it('should sign and verify stored data integrity', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 存储原始数据
    const originalData = { id: 1, name: 'Alice', balance: 1000 };
    await storageService.put('accounts:1', originalData);

    // 对数据签名
    const signature = security.sign(originalData);
    await storageService.put('signatures:accounts:1', signature);

    // 验证数据完整性
    const retrievedData = await storageService.get('accounts:1');
    const retrievedSignature = await storageService.get('signatures:accounts:1');

    const isValid = security.verify(retrievedData, retrievedSignature);
    expect(isValid).toBe(true);

    // 修改数据后签名应该失效
    const tamperedData = { ...retrievedData, balance: 999999 };
    const isTampered = security.verify(tamperedData, retrievedSignature);
    expect(isTampered).toBe(false);
  });

  it('should handle environment-based access control', async () => {
    const security = core.get('security');

    security.setPrincipal({ id: 'user1', role: 'user' });

    // 添加策略：只允许在工作时间访问
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      },
      environmentAttributes: {
        timeOfDay: 'business'
      }
    });

    // 工作时间可以访问
    expect(security.can('read', { type: 'document' }, { timeOfDay: 'business' })).toBe(true);

    // 非工作时间不能访问
    expect(security.can('read', { type: 'document' }, { timeOfDay: 'after-hours' })).toBe(false);
  });

  it('should support encrypted storage with access control', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 设置管理员
    security.setPrincipal({ id: 'admin1', role: 'admin' });

    // 添加管理员策略
    security.addPolicy({
      action: 'write',
      principalAttributes: {
        role: 'admin'
      }
    });

    // 检查权限
    expect(security.can('write', { type: 'config' })).toBe(true);

    // 加密并存储配置
    const config = { apiKey: 'sk-1234567890', secret: 'xyz789' };
    const encrypted = security.encrypt(config);
    await storageService.put('config:production', encrypted);

    // 切换到普通用户
    security.setPrincipal({ id: 'user1', role: 'user' });

    // 用户没有写入权限
    expect(security.can('write', { type: 'config' })).toBe(false);

    // 但可以读取（如果添加了读取策略）
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      }
    });

    expect(security.can('read', { type: 'config' })).toBe(true);
  });
});
