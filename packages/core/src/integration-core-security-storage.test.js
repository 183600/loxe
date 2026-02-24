import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { MemoryStorage } from '../../storage/src/index.js';
import { createSecurityContext } from '../../security/src/index.js';

describe('Integration: Core + Security + Storage', () => {
  let core;
  let storage;

  beforeEach(async () => {
    core = createCore();

    // 注册存储服务
    storage = new MemoryStorage();
    await storage.open();
    core.register('storage', () => ({
      put: async (key, value) => storage.put(key, value),
      get: async (key) => storage.get(key),
      del: async (key) => storage.del(key)
    }), true);

    // 注册 Security 服务
    core.register('security', () => createSecurityContext(core), true);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should encrypt data before storage', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    const sensitiveData = {
      id: 1,
      name: 'John Doe',
      ssn: '123-45-6789',
      creditCard: '4111-1111-1111-1111'
    };

    // 加密数据
    const encrypted = security.encrypt(sensitiveData);
    expect(encrypted).not.toEqual(JSON.stringify(sensitiveData));

    // 存储加密后的数据
    await storageService.put('user:1', encrypted);

    // 从存储中获取加密数据
    const retrievedEncrypted = await storageService.get('user:1');
    expect(retrievedEncrypted).toBe(encrypted);

    // 解密数据
    const decrypted = security.decrypt(retrievedEncrypted);
    expect(decrypted).toEqual(sensitiveData);
  });

  it('should enforce access control before storage operations', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 设置当前用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'sales'
    });

    // 添加策略：只有 admin 可以写入敏感数据
    security.addPolicy({
      action: 'write',
      principalAttributes: {
        role: 'admin'
      }
    });

    // 添加策略：所有用户可以读取公开数据
    security.addPolicy({
      action: 'read',
      resourceAttributes: {
        visibility: 'public'
      }
    });

    const sensitiveData = { id: 1, content: 'Secret information' };
    const publicData = { id: 2, content: 'Public information', visibility: 'public' };

    // 用户不应该有写入权限
    expect(security.can('write', sensitiveData)).toBe(false);

    // 用户应该有读取公开数据的权限
    expect(security.can('read', publicData)).toBe(true);

    // 存储公开数据
    await storageService.put('data:2', publicData);
    const retrieved = await storageService.get('data:2');
    expect(retrieved).toEqual(publicData);
  });

  it('should sign data for integrity verification', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    const data = {
      id: 1,
      amount: 100,
      currency: 'USD',
      timestamp: Date.now()
    };

    // 签名数据
    const signature = security.sign(data);
    expect(signature).toBeTruthy();

    // 存储数据和签名
    const storedData = {
      data: data,
      signature: signature
    };
    await storageService.put('transaction:1', storedData);

    // 从存储中获取
    const retrieved = await storageService.get('transaction:1');
    expect(retrieved.data).toEqual(data);

    // 验证签名
    const isValid = security.verify(retrieved.data, retrieved.signature);
    expect(isValid).toBe(true);

    // 修改数据后验证应该失败
    const tamperedData = { ...retrieved.data, amount: 200 };
    const isTampered = security.verify(tamperedData, retrieved.signature);
    expect(isTampered).toBe(false);
  });

  it('should support role-based data encryption', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 设置管理员
    security.setPrincipal({
      id: 'admin1',
      role: 'admin'
    });

    // 添加策略：admin 可以加密所有数据
    security.addPolicy({
      action: 'encrypt',
      principalAttributes: {
        role: 'admin'
      }
    });

    const adminData = {
      id: 1,
      type: 'admin-config',
      settings: { debug: true, maintenance: false }
    };

    // 检查权限
    expect(security.can('encrypt', adminData)).toBe(true);

    // 加密并存储
    const encrypted = security.encrypt(adminData);
    await storageService.put('config:admin', encrypted);

    // 获取并解密
    const retrieved = await storageService.get('config:admin');
    const decrypted = security.decrypt(retrieved);
    expect(decrypted).toEqual(adminData);
  });

  it('should handle department-based access control', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    // 设置财务部门用户
    security.setPrincipal({
      id: 'user1',
      role: 'accountant',
      department: 'finance'
    });

    // 添加策略：财务部门可以访问财务数据
    security.addPolicy({
      action: 'access',
      principalAttributes: {
        department: 'finance'
      },
      resourceAttributes: {
        type: 'financial'
      }
    });

    const financialData = {
      id: 1,
      type: 'financial',
      amount: 50000,
      category: 'salary'
    };

    const hrData = {
      id: 2,
      type: 'hr',
      employee: 'John Doe',
      salary: 50000
    };

    // 应该可以访问财务数据
    expect(security.can('access', financialData)).toBe(true);

    // 不应该可以访问 HR 数据
    expect(security.can('access', hrData)).toBe(false);

    // 存储有权限的数据
    await storageService.put('data:1', financialData);
    const retrieved = await storageService.get('data:1');
    expect(retrieved).toEqual(financialData);
  });

  it('should support secure data storage with metadata', async () => {
    const security = core.get('security');
    const storageService = core.get('storage');

    const data = {
      id: 1,
      content: 'Sensitive information'
    };

    const metadata = {
      createdBy: 'user1',
      createdAt: Date.now(),
      classification: 'confidential'
    };

    // 加密数据内容
    const encryptedContent = security.encrypt(data.content);
    const signature = security.sign(data);

    // 存储加密数据和元数据
    const storedRecord = {
      id: data.id,
      encryptedContent: encryptedContent,
      signature: signature,
      metadata: metadata
    };

    await storageService.put('secure:1', storedRecord);

    // 检索并验证
    const retrieved = await storageService.get('secure:1');
    expect(retrieved.metadata).toEqual(metadata);

    // 解密内容
    const decryptedContent = security.decrypt(retrieved.encryptedContent);
    expect(decryptedContent).toBe(data.content);

    // 验证签名
    const isValid = security.verify(data, retrieved.signature);
    expect(isValid).toBe(true);
  });
});
