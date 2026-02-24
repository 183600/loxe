import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createQueryEngine } from '../../query/src/index.js';

describe('Integration: Core + Event + Query', () => {
  let core;

  beforeEach(() => {
    core = createCore();

    // 注册事件服务
    core.register('events', () => createEventEmitter(), true);

    // 注册查询服务
    core.register('query', (ctx) => {
      const query = createQueryEngine(ctx);
      
      // 扩展查询引擎，添加事件触发功能
      query.executeWithEvent = function(options, eventName) {
        const result = query(options);
        const eventService = ctx.get('events');
        eventService.emit(eventName, { query: options, result });
        return result;
      };
      
      return query;
    }, true);

    // 注册数据服务（模拟存储）
    core.register('data', (ctx) => {
      const dataStore = new Map();
      
      // 获取事件服务并监听数据变化事件
      try {
        const events = ctx.get('events');
        events.on('data:changed', (event) => {
          const { source, action, item } = event;
          const currentData = dataStore.get(source) || [];
          
          if (action === 'add') {
            currentData.push(item);
            dataStore.set(source, currentData);
          } else if (action === 'update') {
            const index = currentData.findIndex(i => i.id === item.id);
            if (index !== -1) {
              currentData[index] = item;
              dataStore.set(source, currentData);
            }
          }
        });
      } catch (e) {
        // 如果事件服务不存在，忽略
      }
      
      return {
        setData(sourceName, data) {
          dataStore.set(sourceName, data);
        },
        getData(sourceName) {
          return dataStore.get(sourceName) || [];
        }
      };
    }, true);
  });

  it('should emit events when queries are executed', () => {
    const query = core.get('query');
    const events = core.get('events');
    const data = core.get('data');

    // 设置测试数据
    data.setData('users', [
      { id: 1, name: 'Alice', status: 'active' },
      { id: 2, name: 'Bob', status: 'inactive' },
      { id: 3, name: 'Charlie', status: 'active' }
    ]);

    // 监听查询事件
    const queryEvents = [];
    events.on('query:executed', (data) => queryEvents.push(data));

    // 执行带事件的查询
    const result = query.executeWithEvent(
      { from: 'users', where: { status: 'active' } },
      'query:executed'
    );

    expect(result).toHaveLength(2);
    expect(queryEvents).toHaveLength(1);
    expect(queryEvents[0].result).toHaveLength(2);
  });

  it('should support reactive queries with event subscriptions', () => {
    const query = core.get('query');
    const events = core.get('events');
    const data = core.get('data');

    // 设置初始数据
    data.setData('products', [
      { id: 1, name: 'Laptop', price: 999, stock: 10 },
      { id: 2, name: 'Mouse', price: 29, stock: 50 }
    ]);

    // 初始查询
    let result = query({ from: 'products', where: { stock: { $gte: 10 } } });
    expect(result).toHaveLength(2);

    // 添加新产品（data 服务会自动监听 data:changed 事件并更新）
    events.emit('data:changed', {
      source: 'products',
      action: 'add',
      item: { id: 3, name: 'Keyboard', price: 79, stock: 25 }
    });

    // 再次查询，应该包含新产品
    result = query({ from: 'products', where: { stock: { $gte: 10 } } });
    expect(result).toHaveLength(3);
  });

  it('should handle query error events', () => {
    const query = core.get('query');
    const events = core.get('events');

    // 监听错误事件
    const errorEvents = [];
    events.on('query:error', (error) => errorEvents.push(error));

    // 执行无效查询（缺少 from 参数）
    expect(() => {
      query({ where: { status: 'active' } });
    }).toThrow();

    // 检查是否触发了错误事件
    // 注意：由于 query 本身会抛出错误，我们需要在包装函数中捕获并发出事件
    const safeQuery = (options) => {
      try {
        return query(options);
      } catch (error) {
        events.emit('query:error', { error, options });
        throw error;
      }
    };

    expect(() => {
      safeQuery({ where: { status: 'active' } });
    }).toThrow();

    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0].error).toBeDefined();
  });

  it('should support query caching with invalidation events', () => {
    const query = core.get('query');
    const events = core.get('events');
    const data = core.get('data');

    // 设置数据
    data.setData('orders', [
      { id: 1, total: 100, status: 'pending' },
      { id: 2, total: 200, status: 'completed' }
    ]);

    // 简单缓存实现
    const cache = new Map();
    const cachedQuery = (options) => {
      const cacheKey = JSON.stringify(options);
      
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
      }
      
      const result = query(options);
      cache.set(cacheKey, result);
      
      // 监听数据变化事件以使缓存失效
      events.on('data:changed', (event) => {
        if (event.source === options.from) {
          cache.delete(cacheKey);
        }
      });
      
      return result;
    };

    // 第一次查询
    const result1 = cachedQuery({ from: 'orders', where: { status: 'pending' } });
    expect(result1).toHaveLength(1);

    // 第二次查询应该从缓存获取
    const result2 = cachedQuery({ from: 'orders', where: { status: 'pending' } });
    expect(result2).toHaveLength(1);
    expect(result1).toBe(result2);

    // 触发数据变化事件
    events.emit('data:changed', {
      source: 'orders',
      action: 'add',
      item: { id: 3, total: 150, status: 'pending' }
    });

    // 缓存应该已失效，重新查询
    const result3 = cachedQuery({ from: 'orders', where: { status: 'pending' } });
    expect(result3).toHaveLength(2);
    expect(result3).not.toBe(result1);
  });

  it('should support query performance monitoring with events', () => {
    const query = core.get('query');
    const events = core.get('events');
    const data = core.get('data');

    // 设置大量测试数据
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      value: Math.random() * 100,
      category: i % 5
    }));
    data.setData('items', largeDataset);

    // 监听性能事件
    const perfEvents = [];
    events.on('query:performance', (data) => perfEvents.push(data));

    // 包装查询以测量性能
    const measuredQuery = (options) => {
      const startTime = Date.now();
      const result = query(options);
      const endTime = Date.now();
      
      events.emit('query:performance', {
        query: options,
        resultCount: result.length,
        duration: endTime - startTime
      });
      
      return result;
    };

    // 执行查询
    const result = measuredQuery({
      from: 'items',
      where: { category: 0 }
    });

    expect(result.length).toBeGreaterThan(0);
    expect(perfEvents).toHaveLength(1);
    expect(perfEvents[0].duration).toBeGreaterThanOrEqual(0);
    expect(perfEvents[0].resultCount).toBe(result.length);
  });
});