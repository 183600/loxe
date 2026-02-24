import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createQueryEngine } from '../../query/src/index.js';

describe('Integration: Core + Event + Query', () => {
  let core;

  beforeEach(() => {
    core = createCore();

    // 模拟存储数据
    const mockData = {
      users: [
        { id: 1, name: 'Alice', status: 'active' },
        { id: 2, name: 'Bob', status: 'inactive' },
        { id: 3, name: 'Charlie', status: 'active' }
      ]
    };

    core.register('storage', () => ({
      getData: (sourceName) => mockData[sourceName] || []
    }), true);

    core.register('event', () => createEventEmitter(core), true);
    core.register('query', () => createQueryEngine(core), true);
  });

  it('should trigger query updates on data change events', () => {
    const event = core.get('event');
    const query = core.get('query');

    const queryResults = [];

    // 监听数据变化事件
    event.on('data:changed', (source) => {
      const results = query({ from: source, where: { status: 'active' } });
      queryResults.push({ source, count: results.length, results });
    });

    // 模拟数据变化
    event.emit('data:changed', 'users');

    expect(queryResults).toHaveLength(1);
    expect(queryResults[0].source).toBe('users');
    expect(queryResults[0].count).toBe(2);
    expect(queryResults[0].results).toEqual([
      { id: 1, name: 'Alice', status: 'active' },
      { id: 3, name: 'Charlie', status: 'active' }
    ]);
  });

  it('should support event-driven query subscriptions', () => {
    const event = core.get('event');
    const query = core.get('query');

    const subscriptionResults = [];

    // 创建订阅服务
    core.register('querySubscription', (ctx) => {
      const event = ctx.get('event');
      const query = ctx.get('query');

      return {
        subscribe(source, where, callback) {
          const initialResults = query({ from: source, where });
          callback(initialResults);

          const unsubscribe = event.on('data:changed', (changedSource) => {
            if (changedSource === source) {
              const newResults = query({ from: source, where });
              callback(newResults);
            }
          });

          return unsubscribe;
        }
      };
    }, true);

    const subscription = core.get('querySubscription');

    // 订阅活跃用户查询
    subscription.subscribe('users', { status: 'active' }, (results) => {
      subscriptionResults.push(results);
    });

    // 初始结果
    expect(subscriptionResults).toHaveLength(1);
    expect(subscriptionResults[0]).toHaveLength(2);

    // 模拟数据变化
    event.emit('data:changed', 'users');

    // 更新后的结果
    expect(subscriptionResults).toHaveLength(2);
  });

  it('should filter query results based on event payload', () => {
    const event = core.get('event');
    const query = core.get('query');

    const filteredResults = [];

    // 监听特定类型的数据变化
    event.on('user:status:changed', (payload) => {
      const { userId, newStatus } = payload;

      const results = query({
        from: 'users',
        where: (user) => user.id === userId && user.status === newStatus
      });

      filteredResults.push({ userId, newStatus, found: results.length > 0 });
    });
    
    // 模拟用户状态变化
    event.emit('user:status:changed', { userId: 1, newStatus: 'active' });
    event.emit('user:status:changed', { userId: 2, newStatus: 'active' });

    expect(filteredResults).toHaveLength(2);
    expect(filteredResults[0].found).toBe(true); // Alice is active
    expect(filteredResults[1].found).toBe(false); // Bob is inactive
  });

  it('should support cascading query updates', () => {
    const event = core.get('event');
    const query = core.get('query');

    const updateChain = [];

    // 设置级联更新
    event.on('user:updated', (user) => {
      updateChain.push({ step: 1, user: user.id });

      // 触发相关查询更新
      event.emit('query:refresh', 'users');
    });

    event.on('query:refresh', (source) => {
      updateChain.push({ step: 2, source });

      // 执行查询
      const results = query({ from: source });
      updateChain.push({ step: 3, count: results.length });

      // 触发缓存失效
      event.emit('cache:invalidate', source);
    });

    event.on('cache:invalidate', (source) => {
      updateChain.push({ step: 4, source });
    });

    // 触发用户更新
    event.emit('user:updated', { id: 1, name: 'Alice' });

    expect(updateChain).toHaveLength(4);
    expect(updateChain[0].step).toBe(1);
    expect(updateChain[1].step).toBe(2);
    expect(updateChain[2].step).toBe(3);
    expect(updateChain[3].step).toBe(4);
  });

  it('should handle query errors in event handlers gracefully', () => {
    const event = core.get('event');
    const query = core.get('query');

    const errorResults = [];

    // 监听查询错误
    event.on('query:error', (error) => {
      errorResults.push(error);
    });

    // 创建可能失败的查询服务
    core.register('safeQuery', (ctx) => {
      const query = ctx.get('query');
      const event = ctx.get('event');

      return {
        safeQuery(options) {
          try {
            return query(options);
          } catch (error) {
            event.emit('query:error', { message: error.message, options });
            return [];
          }
        }
      };
    }, true);

    const safeQuery = core.get('safeQuery');

    // 执行安全查询
    const results = safeQuery.safeQuery({ from: 'users' });
    expect(results).toHaveLength(3);

    // 模拟查询错误
    event.emit('query:error', { message: 'Query failed', options: {} });
    expect(errorResults).toHaveLength(1);
  });
});
