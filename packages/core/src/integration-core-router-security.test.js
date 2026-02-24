import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createRouter } from '../../router/src/index.js';
import { createSecurityContext } from '../../security/src/index.js';

describe('Integration: Core + Router + Security', () => {
  it('should enforce authentication on protected routes', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('security', () => createSecurityContext(core), true);

    const router = core.get('router');
    const security = core.get('security');

    // 设置认证策略
    security.addPolicy({
      action: 'access',
      principalAttributes: {
        authenticated: true
      }
    });

    // 注册受保护的路由
    router.get('/admin/dashboard', (ctx) => {
      const { user } = ctx;

      if (!user || !user.authenticated) {
        return { status: 401, error: 'Unauthorized' };
      }

      return { status: 200, data: { dashboard: 'Admin Dashboard' } };
    });

    // 测试未认证访问
    const unauthorizedResponse = router.handle('GET', '/admin/dashboard', {
      user: null
    });
    expect(unauthorizedResponse.status).toBe(401);

    // 测试已认证访问
    const authorizedResponse = router.handle('GET', '/admin/dashboard', {
      user: { authenticated: true, role: 'admin' }
    });
    expect(authorizedResponse.status).toBe(200);
  });

  it('should enforce role-based access control on routes', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('security', () => createSecurityContext(core), true);

    const router = core.get('router');
    const security = core.get('security');

    // 设置角色策略
    security.addPolicy({
      action: 'admin_access',
      principalAttributes: {
        role: 'admin'
      }
    });

    security.addPolicy({
      action: 'user_access',
      principalAttributes: {
        role: 'user'
      }
    });

    // 注册管理员路由
    router.get('/admin/users', (ctx) => {
      const { user } = ctx;

      // 设置当前 principal
      security.setPrincipal(user);

      if (!security.can('admin_access', {})) {
        return { status: 403, error: 'Forbidden' };
      }

      return { status: 200, data: { users: [] } };
    });

    // 测试普通用户访问管理员路由
    const userResponse = router.handle('GET', '/admin/users', {
      user: { role: 'user' }
    });
    expect(userResponse.status).toBe(403);

    // 测试管理员访问管理员路由
    const adminResponse = router.handle('GET', '/admin/users', {
      user: { role: 'admin' }
    });
    expect(adminResponse.status).toBe(200);
  });

  it('should protect sensitive data in route responses', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('security', () => createSecurityContext(core), true);

    const router = core.get('router');
    const security = core.get('security');

    // 设置数据访问策略
    security.addPolicy({
      action: 'view_sensitive',
      principalAttributes: {
        role: 'admin'
      }
    });

    router.get('/users/:id', (ctx) => {
      const { user, params } = ctx;
      
      // 设置当前 principal
      security.setPrincipal(user);
      
      const canViewSensitive = security.can('view_sensitive', {});

      const userData = {
        id: params.id,
        name: 'John Doe',
        email: 'john@example.com',
        ssn: canViewSensitive ? '123-45-6789' : undefined,
        salary: canViewSensitive ? 80000 : undefined
      };

      return { status: 200, data: userData };
    });

    // 测试普通用户获取数据
    const userResponse = router.handle('GET', '/users/1', {
      user: { role: 'user' }
    });
    expect(userResponse.status).toBe(200);
    expect(userResponse.data.ssn).toBeUndefined();
    expect(userResponse.data.salary).toBeUndefined();

    // 测试管理员获取数据
    const adminResponse = router.handle('GET', '/users/1', {
      user: { role: 'admin' }
    });
    expect(adminResponse.status).toBe(200);
    expect(adminResponse.data.ssn).toBe('123-45-6789');
    expect(adminResponse.data.salary).toBe(80000);
  });

  it('should create a secure router service', () => {
    const core = createCore();

    core.register('router', createRouter, true);
    core.register('security', () => createSecurityContext(core), true);

    core.register('secureRouter', (ctx) => {
      const router = ctx.get('router');
      const security = ctx.get('security');

      return {
        secureGet(pattern, requiredRole, handler) {
          router.get(pattern, (ctx) => {
            const { user } = ctx;

            if (!user) {
              return { status: 401, error: 'Unauthorized' };
            }

            if (requiredRole && user.role !== requiredRole) {
              return { status: 403, error: 'Forbidden' };
            }

            return handler(ctx);
          });
        },

        handle(method, path, context) {
          return router.handle(method, path, context);
        }
      };
    }, true);

    const secureRouter = core.get('secureRouter');

    // 注册安全路由
    secureRouter.secureGet('/api/config', 'admin', (ctx) => {
      return { status: 200, data: { config: 'admin-config' } };
    });

    // 测试无用户访问
    const noUserResponse = secureRouter.handle('GET', '/api/config', {
      user: null
    });
    expect(noUserResponse.status).toBe(401);

    // 测试普通用户访问
    const userResponse = secureRouter.handle('GET', '/api/config', {
      user: { role: 'user' }
    });
    expect(userResponse.status).toBe(403);

    // 测试管理员访问
    const adminResponse = secureRouter.handle('GET', '/api/config', {
      user: { role: 'admin' }
    });
    expect(adminResponse.status).toBe(200);
  });
});