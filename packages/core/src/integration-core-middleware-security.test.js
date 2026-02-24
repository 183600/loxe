import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createMiddleware } from '../../middleware/src/index.js';
import { createSecurityContext } from '../../security/src/index.js';

describe('Integration: Core + Middleware + Security', () => {
  it('should enforce security policies through middleware', async () => {
    const core = createCore();

    core.register('middleware', () => createMiddleware(core), true);
    core.register('security', () => createSecurityContext(core), true);

    const middleware = core.get('middleware');
    const security = core.get('security');

    // 设置当前用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'engineering'
    });

    // 添加安全策略
    security.addPolicy({
      action: 'access',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        type: 'public'
      }
    });

    // 添加安全中间件
    middleware.use(async (ctx, next) => {
      const security = ctx.security;
      const resource = ctx.resource;

      // 检查访问权限
      const hasPermission = security.can('access', resource);

      if (!hasPermission) {
        ctx.status = 403;
        ctx.error = 'Access denied';
        return;
      }

      await next();
    });

    // 测试允许的访问
    const allowedCtx = {
      security,
      resource: { type: 'public', id: 1 }
    };

    await middleware.execute(allowedCtx);

    expect(allowedCtx.status).toBeUndefined();
    expect(allowedCtx.error).toBeUndefined();

    // 测试拒绝的访问
    const deniedCtx = {
      security,
      resource: { type: 'private', id: 1 }
    };

    await middleware.execute(deniedCtx);

    expect(deniedCtx.status).toBe(403);
    expect(deniedCtx.error).toBe('Access denied');
  });

  it('should support role-based access control in middleware', async () => {
    const core = createCore();

    core.register('middleware', () => createMiddleware(core), true);
    core.register('security', () => createSecurityContext(core), true);

    const middleware = core.get('middleware');
    const security = core.get('security');

    // 添加角色策略
    security.addPolicy({
      action: 'admin',
      principalAttributes: {
        role: 'admin'
      }
    });

    security.addPolicy({
      action: 'user',
      principalAttributes: {
        role: 'user'
      }
    });

    // 创建角色检查中间件
    middleware.use(async (ctx, next) => {
      const security = ctx.security;
      const requiredRole = ctx.requiredRole;

      if (!security.can(requiredRole, {})) {
        ctx.status = 403;
        ctx.error = `Requires ${requiredRole} role`;
        return;
      }

      await next();
    });

    // 测试管理员访问
    security.setPrincipal({ id: 'admin1', role: 'admin' });
    const adminCtx = { security, requiredRole: 'admin' };
    await middleware.execute(adminCtx);
    expect(adminCtx.status).toBeUndefined();

    // 测试用户访问
    security.setPrincipal({ id: 'user1', role: 'user' });
    const userCtx = { security, requiredRole: 'user' };
    await middleware.execute(userCtx);
    expect(userCtx.status).toBeUndefined();

    // 测试无权限访问
    const deniedCtx = { security, requiredRole: 'admin' };
    await middleware.execute(deniedCtx);
    expect(deniedCtx.status).toBe(403);
  });

  it('should handle resource-level security in middleware', async () => {
    const core = createCore();

    core.register('middleware', () => createMiddleware(core), true);
    core.register('security', () => createSecurityContext(core), true);

    const middleware = core.get('middleware');
    const security = core.get('security');

    // 设置用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'engineering'
    });

    // 添加资源所有权策略
    security.addPolicy({
      action: 'modify',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        owner: 'user1'
      }
    });

    // 添加资源检查中间件
    middleware.use(async (ctx, next) => {
      const security = ctx.security;
      const resource = ctx.resource;

      if (!security.can('modify', resource)) {
        ctx.status = 403;
        ctx.error = 'Cannot modify resource owned by another user';
        return;
      }

      await next();
    });

    // 测试拥有资源的访问
    const ownedCtx = {
      security,
      resource: { id: 1, owner: 'user1', title: 'My Document' }
    };

    await middleware.execute(ownedCtx);
    expect(ownedCtx.status).toBeUndefined();

    // 测试不拥有资源的访问
    const notOwnedCtx = {
      security,
      resource: { id: 2, owner: 'user2', title: 'Other Document' }
    };

    await middleware.execute(notOwnedCtx);
    expect(notOwnedCtx.status).toBe(403);
  });

  it('should support environment-based security in middleware', async () => {
    const core = createCore();

    core.register('middleware', () => createMiddleware(core), true);
    core.register('security', () => createSecurityContext(core), true);

    const middleware = core.get('middleware');
    const security = core.get('security');

    // 设置用户
    security.setPrincipal({
      id: 'user1',
      role: 'user'
    });

    // 添加环境策略（工作时间访问）
    security.addPolicy({
      action: 'access',
      principalAttributes: {
        role: 'user'
      },
      environmentAttributes: {
        timeOfDay: 'business'
      }
    });

    // 添加环境检查中间件
    middleware.use(async (ctx, next) => {
      const security = ctx.security;
      const environment = ctx.environment;

      if (!security.can('access', {}, environment)) {
        ctx.status = 403;
        ctx.error = 'Access not allowed at this time';
        return;
      }

      await next();
    });

    // 测试工作时间访问
    const businessHoursCtx = {
      security,
      environment: { timeOfDay: 'business' }
    };

    await middleware.execute(businessHoursCtx);
    expect(businessHoursCtx.status).toBeUndefined();

    // 测试非工作时间访问
    const afterHoursCtx = {
      security,
      environment: { timeOfDay: 'after-hours' }
    };

    await middleware.execute(afterHoursCtx);
    expect(afterHoursCtx.status).toBe(403);
  });

  it('should combine multiple security checks in middleware chain', async () => {
    const core = createCore();

    core.register('middleware', () => createMiddleware(core), true);
    core.register('security', () => createSecurityContext(core), true);

    const middleware = core.get('middleware');
    const security = core.get('security');

    // 设置管理员用户
    security.setPrincipal({
      id: 'admin1',
      role: 'admin',
      department: 'IT'
    });

    // 添加多个策略
    security.addPolicy({
      action: 'admin_access',
      principalAttributes: {
        role: 'admin'
      }
    });

    security.addPolicy({
      action: 'department_access',
      principalAttributes: {
        department: 'IT'
      }
    });

    // 添加多级安全中间件
    middleware.use(async (ctx, next) => {
      const security = ctx.security;

      // 第一级：检查管理员权限
      if (!security.can('admin_access', {})) {
        ctx.status = 403;
        ctx.error = 'Admin access required';
        return;
      }

      await next();
    });

    middleware.use(async (ctx, next) => {
      const security = ctx.security;

      // 第二级：检查部门权限
      if (!security.can('department_access', {})) {
        ctx.status = 403;
        ctx.error = 'Department access required';
        return;
      }

      await next();
    });

    // 测试通过所有检查
    const validCtx = { security };
    await middleware.execute(validCtx);
    expect(validCtx.status).toBeUndefined();

    // 测试部门权限不足
    security.setPrincipal({
      id: 'user1',
      role: 'admin',
      department: 'HR'
    });

    const invalidCtx = { security };
    await middleware.execute(invalidCtx);
    expect(invalidCtx.status).toBe(403);
    expect(invalidCtx.error).toBe('Department access required');
  });
});
