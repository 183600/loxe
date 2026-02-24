import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createQueryEngine } from '../../query/src/index.js';
import { createSecurityContext } from '../../security/src/index.js';

describe('Integration: Core + Query + Security', () => {
  let core;

  beforeEach(() => {
    core = createCore();

    // 模拟存储数据
    const mockData = {
      users: [
        { id: 1, name: 'Alice', role: 'admin', department: 'engineering', salary: 80000 },
        { id: 2, name: 'Bob', role: 'user', department: 'sales', salary: 50000 },
        { id: 3, name: 'Charlie', role: 'user', department: 'engineering', salary: 60000 },
        { id: 4, name: 'Diana', role: 'manager', department: 'sales', salary: 75000 }
      ],
      documents: [
        { id: 1, title: 'Project Plan', classification: 'confidential', owner: 'Alice' },
        { id: 2, title: 'Public Report', classification: 'public', owner: 'Bob' },
        { id: 3, title: 'Budget Sheet', classification: 'confidential', owner: 'Diana' }
      ]
    };

    core.register('storage', () => ({
      getData: (sourceName) => mockData[sourceName] || []
    }), true);

    core.register('query', () => createQueryEngine(core), true);
    core.register('security', () => createSecurityContext(core), true);
  });

  it('should enforce access control on query results', () => {
    const query = core.get('query');
    const security = core.get('security');

    // 设置当前用户为普通用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'engineering'
    });

    // 添加策略：只有 admin 可以查询所有用户，普通用户只能查询本部门
    security.addPolicy({
      action: 'query',
      principalAttributes: {
        role: 'admin'
      },
      resourceAttributes: {
        type: 'users'
      }
    });

    security.addPolicy({
      action: 'query',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        type: 'users'
      }
    });

    // 添加策略：用户只能查询本部门用户
    security.addPolicy({
      action: 'query',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        type: 'users',
        department: 'engineering'
      }
    });

    // 创建安全查询服务
    core.register('secureQuery', (ctx) => {
      const queryEngine = ctx.get('query');
      const security = ctx.get('security');

      return {
        query(options) {
          const { from, where } = options;

          // 检查查询权限
          const resourceType = from;
          const hasPermission = security.can('query', { type: resourceType });

          if (!hasPermission) {
            return []; // 无权限返回空数组
          }

          // 如果有部门限制，添加到查询条件
          const principal = security.principal;
          let finalWhere = where;

          if (principal && principal.department && principal.role === 'user') {
            const deptFilter = { department: principal.department };
            if (typeof where === 'function') {
              finalWhere = (item) => where(item) && item.department === principal.department;
            } else if (typeof where === 'object') {
              finalWhere = { ...where, department: principal.department };
            } else {
              finalWhere = deptFilter;
            }
          }

          return queryEngine({ from, where: finalWhere });
        }
      };
    }, true);

    const secureQuery = core.get('secureQuery');

    // 普通用户只能查询本部门用户
    const users = secureQuery.query({ from: 'users' });
    expect(users).toHaveLength(2);
    expect(users.every(u => u.department === 'engineering')).toBe(true);
  });

  it('should filter sensitive data in query results', () => {
    const query = core.get('query');
    const security = core.get('security');

    // 设置当前用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'sales'
    });

    // 添加策略：只有 admin 可以查看 salary
    security.addPolicy({
      action: 'view_salary',
      principalAttributes: {
        role: 'admin'
      }
    });

    // 创建数据过滤查询服务
    core.register('filteredQuery', (ctx) => {
      const queryEngine = ctx.get('query');
      const security = ctx.get('security');

      return {
        query(options) {
          const results = queryEngine(options);

          // 检查是否有查看敏感数据的权限
          const canViewSalary = security.can('view_salary', {});

          if (!canViewSalary) {
            // 移除敏感字段
            return results.map(item => {
              const { salary, ...rest } = item;
              return rest;
            });
          }

          return results;
        }
      };
    }, true);

    const filteredQuery = core.get('filteredQuery');

    // 普通用户查询不应该看到 salary
    const users = filteredQuery.query({ from: 'users' });
    expect(users).toHaveLength(4);
    expect(users[0]).not.toHaveProperty('salary');
    expect(users[0]).toHaveProperty('name');
  });

  it('should combine query filters with security policies', () => {
    const query = core.get('query');
    const security = core.get('security');

    // 设置当前用户
    security.setPrincipal({
      id: 'user1',
      role: 'user',
      department: 'engineering'
    });

    // 添加策略：用户只能访问公开文档或自己拥有的文档
    security.addPolicy({
      action: 'access',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        classification: 'public'
      }
    });

    security.addPolicy({
      action: 'access',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        owner: 'user1'
      }
    });

    // 创建安全文档查询服务
    core.register('secureDocumentQuery', (ctx) => {
      const queryEngine = ctx.get('query');
      const security = ctx.get('security');

      return {
        query(options) {
          const results = queryEngine(options);
          const principal = security.principal;

          // 过滤用户无权访问的文档
          return results.filter(doc => {
            const isPublic = doc.classification === 'public';
            const isOwner = doc.owner === principal.id;
            return isPublic || isOwner;
          });
        }
      };
    }, true);

    const secureDocQuery = core.get('secureDocumentQuery');

    // 用户只能访问公开文档
    const documents = secureDocQuery.query({ from: 'documents' });
    expect(documents).toHaveLength(1);
    expect(documents[0].classification).toBe('public');
  });
});