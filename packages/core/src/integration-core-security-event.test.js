import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCore } from './index.js';
import { createSecurityContext } from '../../security/src/index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Core + Security + Event', () => {
  let core;
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    core = createCore();

    // 注册事件服务
    core.register('events', () => createEventEmitter(), true);

    // 注册安全服务
    core.register('security', () => createSecurityContext(core), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit security events on permission changes', () => {
    const events = core.get('events');
    const security = core.get('security');

    let permissionChanged = false;
    events.on('security:permission:changed', (data) => {
      permissionChanged = true;
      expect(data.action).toBe('grant');
      expect(data.resource).toBe('admin-panel');
    });

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'admin' });

    // 添加策略
    security.addPolicy({
      action: 'access',
      principalAttributes: { role: 'admin' },
      resourceAttributes: { type: 'admin-panel' }
    });

    // 检查权限（会触发事件）
    const canAccess = security.can('access', { type: 'admin-panel' });
    expect(canAccess).toBe(true);
  });

  it('should log security events for audit purposes', () => {
    const events = core.get('events');
    const security = core.get('security');

    let auditLog = null;
    events.on('security:audit', (data) => {
      auditLog = data;
    });

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'user' });

    // 尝试访问受保护资源
    const resource = { type: 'sensitive-data', classification: 'confidential' };
    const canAccess = security.can('access', resource);

    // 发布审计事件
    events.emit('security:audit', {
      principal: { id: 'user1', role: 'user' },
      action: 'access',
      resource: resource,
      allowed: canAccess,
      timestamp: Date.now()
    });

    expect(auditLog).toBeDefined();
    expect(auditLog.principal.id).toBe('user1');
    expect(auditLog.action).toBe('access');
  });

  it('should notify on authentication events', () => {
    const events = core.get('events');
    const security = core.get('security');

    let authEvent = null;
    events.on('security:auth', (data) => {
      authEvent = data;
    });

    // 模拟登录
    events.emit('security:auth', {
      type: 'login',
      principal: { id: 'user1', role: 'admin' },
      timestamp: Date.now(),
      success: true
    });

    expect(authEvent).toBeDefined();
    expect(authEvent.type).toBe('login');
    expect(authEvent.success).toBe(true);

    // 设置当前用户
    security.setPrincipal(authEvent.principal);
    expect(security.principal.id).toBe('user1');
  });

  it('should handle authorization failure events', () => {
    const events = core.get('events');
    const security = core.get('security');

    let failureEvent = null;
    events.on('security:authz:failed', (data) => {
      failureEvent = data;
    });

    // 设置普通用户
    security.setPrincipal({ id: 'user1', role: 'user' });

    // 添加管理员策略
    security.addPolicy({
      action: 'delete',
      principalAttributes: { role: 'admin' }
    });

    // 尝试删除操作
    const canDelete = security.can('delete', { type: 'user' });

    if (!canDelete) {
      events.emit('security:authz:failed', {
        principal: security.principal,
        action: 'delete',
        resource: { type: 'user' },
        reason: 'Insufficient permissions'
      });
    }

    expect(failureEvent).toBeDefined();
    expect(failureEvent.action).toBe('delete');
    expect(failureEvent.reason).toBe('Insufficient permissions');
  });

  it('should support role-based security events', () => {
    const events = core.get('events');
    const security = core.get('security');

    let roleEvent = null;
    events.on('security:role:changed', (data) => {
      roleEvent = data;
    });

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'user' });

    // 模拟角色变更
    events.emit('security:role:changed', {
      principalId: 'user1',
      oldRole: 'user',
      newRole: 'admin',
      timestamp: Date.now()
    });

    expect(roleEvent).toBeDefined();
    expect(roleEvent.oldRole).toBe('user');
    expect(roleEvent.newRole).toBe('admin');

    // 更新用户角色
    security.setPrincipal({ id: 'user1', role: 'admin' });
  });

  it('should emit events for data encryption/decryption', () => {
    const events = core.get('events');
    const security = core.get('security');

    let cryptoEvent = null;
    events.on('security:crypto', (data) => {
      cryptoEvent = data;
    });

    const data = { id: 1, content: 'Sensitive information' };

    // 加密数据
    const encrypted = security.encrypt(data);

    // 发布加密事件
    events.emit('security:crypto', {
      operation: 'encrypt',
      dataType: 'object',
      success: true,
      timestamp: Date.now()
    });

    expect(cryptoEvent).toBeDefined();
    expect(cryptoEvent.operation).toBe('encrypt');
    expect(cryptoEvent.success).toBe(true);

    // 解密数据
    const decrypted = security.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('should support security event aggregation', () => {
    const events = core.get('events');
    const security = core.get('security');

    const securityEvents = [];

    // 收集所有安全相关事件
    events.on('security:*', (event, data) => {
      securityEvents.push({ event, data });
    });

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'admin' });

    // 添加策略
    security.addPolicy({
      action: 'access',
      principalAttributes: { role: 'admin' }
    });

    // 检查权限
    security.can('access', { type: 'admin-panel' });

    // 发布多个安全事件
    events.emit('security:audit', { type: 'access', resource: 'admin-panel' });
    events.emit('security:auth', { type: 'login', success: true });

    expect(securityEvents.length).toBeGreaterThan(0);
    expect(securityEvents.some(e => e.event === 'security:audit')).toBe(true);
    expect(securityEvents.some(e => e.event === 'security:auth')).toBe(true);
  });

  it('should handle security context lifecycle events', () => {
    const events = core.get('events');
    const security = core.get('security');

    let lifecycleEvent = null;
    events.on('security:lifecycle', (data) => {
      lifecycleEvent = data;
    });

    // 发布安全上下文初始化事件
    events.emit('security:lifecycle', {
      phase: 'initialized',
      timestamp: Date.now()
    });

    expect(lifecycleEvent).toBeDefined();
    expect(lifecycleEvent.phase).toBe('initialized');

    // 设置用户
    security.setPrincipal({ id: 'user1', role: 'user' });

    // 发布用户会话开始事件
    events.emit('security:lifecycle', {
      phase: 'session:started',
      principal: security.principal,
      timestamp: Date.now()
    });

    expect(lifecycleEvent.phase).toBe('session:started');
  });
});
