import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryEngine } from './index.js';

describe('Query Engine', () => {
  let mockCtx;
  let query;
  
  beforeEach(() => {
    // 模拟上下文对象
    mockCtx = {
      get: (serviceName) => {
        if (serviceName === 'storage') {
          return {
            getData: (sourceName) => {
              if (sourceName === 'users') {
                return [
                  { id: 1, name: 'Alice', age: 30, city: 'New York' },
                  { id: 2, name: 'Bob', age: 25, city: 'Los Angeles' },
                  { id: 3, name: 'Charlie', age: 35, city: 'New York' },
                  { id: 4, name: 'Diana', age: 28, city: 'Chicago' }
                ];
              }
              return [];
            }
          };
        }
        throw new Error(`Unknown service: ${serviceName}`);
      }
    };
    
    query = createQueryEngine(mockCtx);
  });
  
  describe('基本查询功能', () => {
    it('应该能够查询所有数据（无过滤条件）', () => {
      const result = query({ from: 'users' });
      expect(result).toHaveLength(4);
      expect(result[0].name).toBe('Alice');
    });
    
    it('应该支持直接传入数组数据', () => {
      const data = [
        { id: 1, name: 'Test1', active: true },
        { id: 2, name: 'Test2', active: false }
      ];
      const result = query({ from: data });
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Test1');
    });
    
    it('应该在缺少 from 参数时抛出错误', () => {
      expect(() => query({})).toThrow('Query requires "from" parameter');
    });
  });
  
  describe('where 过滤功能', () => {
    it('应该支持简单的对象相等过滤', () => {
      const result = query({ 
        from: 'users', 
        where: { city: 'New York' } 
      });
      expect(result).toHaveLength(2);
      expect(result.every(item => item.city === 'New York')).toBe(true);
    });
    
    it('应该支持多条件过滤', () => {
      const result = query({ 
        from: 'users', 
        where: { city: 'New York', age: 30 } 
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });
    
    it('应该支持函数过滤', () => {
      const result = query({ 
        from: 'users', 
        where: (user) => user.age > 30 
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charlie');
    });
  });
  
  describe('操作符支持', () => {
    it('应该支持 $eq 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { age: { $eq: 25 } } 
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });
    
    it('应该支持 $ne 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { city: { $ne: 'New York' } } 
      });
      expect(result).toHaveLength(2);
      expect(result.every(item => item.city !== 'New York')).toBe(true);
    });
    
    it('应该支持 $gt 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { age: { $gt: 30 } } 
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charlie');
    });
    
    it('应该支持 $gte 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { age: { $gte: 30 } } 
      });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(expect.arrayContaining(['Alice', 'Charlie']));
    });
    
    it('应该支持 $lt 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { age: { $lt: 30 } } 
      });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(expect.arrayContaining(['Bob', 'Diana']));
    });
    
    it('应该支持 $lte 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { age: { $lte: 25 } } 
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
    });
    
    it('应该支持 $in 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { city: { $in: ['New York', 'Chicago'] } } 
      });
      expect(result).toHaveLength(3);
    });
    
    it('应该支持 $nin 操作符', () => {
      const result = query({ 
        from: 'users', 
        where: { city: { $nin: ['New York'] } } 
      });
      expect(result).toHaveLength(2);
      expect(result.every(item => item.city !== 'New York')).toBe(true);
    });
    
    it('应该支持多个操作符组合', () => {
      const result = query({ 
        from: 'users', 
        where: { 
          age: { $gte: 25, $lt: 35 },
          city: { $ne: 'Chicago' }
        } 
      });
      expect(result).toHaveLength(2);
      expect(result.map(item => item.name)).toEqual(expect.arrayContaining(['Alice', 'Bob']));
    });
  });
  
  describe('错误处理', () => {
    it('应该在数据源不是数组时返回空数组', () => {
      mockCtx.get = () => ({
        getData: () => 'not an array'
      });
      
      const result = query({ 
        from: 'invalidSource', 
        where: { test: 'value' } 
      });
      expect(result).toEqual([]);
    });
    
    it('应该在不支持的操作符时抛出错误', () => {
      expect(() => {
        query({ 
          from: 'users', 
          where: { age: { $unsupported: 25 } } 
        });
      }).toThrow('Unsupported operator: $unsupported');
    });
  });
  
  describe('compile 方法', () => {
    it('应该返回编译后的查询函数', () => {
      const compiledQuery = query.compile({ 
        from: 'users', 
        where: { city: 'New York' } 
      });
      
      expect(typeof compiledQuery).toBe('function');
      
      // 执行编译后的查询
      const result = compiledQuery();
      expect(result).toHaveLength(2);
      expect(result.every(item => item.city === 'New York')).toBe(true);
    });
    
    it('应该在缺少 from 参数时抛出错误', () => {
      expect(() => {
        query.compile({ where: { city: 'New York' } });
      }).toThrow('Compile requires "from" parameter');
    });
    
    it('应该支持编译无过滤条件的查询', () => {
      const compiledQuery = query.compile({ from: 'users' });
      const result = compiledQuery();
      expect(result).toHaveLength(4);
    });
  });
  
  describe('ensureIndex 方法', () => {
    it('应该返回索引占位对象', () => {
      const result = query.ensureIndex('users', ['city', 'age']);
      
      expect(result).toEqual({
        dataSource: 'users',
        fields: ['city', 'age'],
        created: false,
        message: 'Index placeholder - no actual index created'
      });
    });
    
    it('应该在缺少 dataSource 参数时抛出错误', () => {
      expect(() => {
        query.ensureIndex();
      }).toThrow('ensureIndex requires "dataSource" parameter');
    });
    
    it('应该在缺少 fields 参数时抛出错误', () => {
      expect(() => {
        query.ensureIndex('users');
      }).toThrow('ensureIndex requires "fields" array parameter');
    });
    
    it('应该在 fields 不是数组时抛出错误', () => {
      expect(() => {
        query.ensureIndex('users', 'city');
      }).toThrow('ensureIndex requires "fields" array parameter');
    });
    
    it('应该在 fields 是空数组时抛出错误', () => {
      expect(() => {
        query.ensureIndex('users', []);
      }).toThrow('ensureIndex requires "fields" array parameter');
    });
    
    it('应该尝试使用索引服务（如果可用）', () => {
      // 添加模拟的索引服务
      mockCtx.get = (serviceName) => {
        if (serviceName === 'index') {
          return {
            ensureIndex: (dataSource, fields) => {
              return {
                dataSource,
                fields,
                created: true,
                message: 'Index created successfully'
              };
            }
          };
        }
        throw new Error(`Unknown service: ${serviceName}`);
      };
      
      const result = query.ensureIndex('users', ['city']);
      expect(result.created).toBe(true);
      expect(result.message).toBe('Index created successfully');
    });
  });
  
  describe('live 方法', () => {
    let mockEventService;
    
    beforeEach(() => {
      // 模拟事件服务
      mockEventService = {
        subscriptions: new Map(),
        
        subscribe: (dataSource, subscription) => {
          if (!mockEventService.subscriptions.has(dataSource)) {
            mockEventService.subscriptions.set(dataSource, []);
          }
          mockEventService.subscriptions.get(dataSource).push(subscription);
        },
        
        unsubscribe: (subscription) => {
          for (const [dataSource, subs] of mockEventService.subscriptions.entries()) {
            const index = subs.indexOf(subscription);
            if (index > -1) {
              subs.splice(index, 1);
              return true;
            }
          }
          return false;
        },
        
        // 模拟数据变化事件
        simulateDataChange: (dataSource) => {
          const subs = mockEventService.subscriptions.get(dataSource) || [];
          subs.forEach(sub => sub.update());
        }
      };
      
      // 更新上下文以包含事件服务
      mockCtx.get = (serviceName) => {
        if (serviceName === 'storage') {
          return {
            getData: (sourceName) => {
              if (sourceName === 'users') {
                return [
                  { id: 1, name: 'Alice', age: 30, city: 'New York' },
                  { id: 2, name: 'Bob', age: 25, city: 'Los Angeles' },
                  { id: 3, name: 'Charlie', age: 35, city: 'New York' },
                  { id: 4, name: 'Diana', age: 28, city: 'Chicago' }
                ];
              }
              return [];
            }
          };
        } else if (serviceName === 'events') {
          return mockEventService;
        }
        throw new Error(`Unknown service: ${serviceName}`);
      };
      
      query = createQueryEngine(mockCtx);
    });
    
    it('应该返回初始结果并创建订阅', () => {
      let callbackResult = null;
      
      const subscription = query.live(
        { from: 'users', where: { city: 'New York' } },
        (result) => {
          callbackResult = result;
        }
      );
      
      // 验证初始结果
      expect(callbackResult).toHaveLength(2);
      expect(callbackResult.every(item => item.city === 'New York')).toBe(true);
      
      // 验证订阅对象
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      expect(typeof subscription.update).toBe('function');
      expect(subscription.currentResult).toBe(callbackResult);
    });
    
    it('应该在缺少 options 参数时抛出错误', () => {
      expect(() => {
        query.live(null, () => {});
      }).toThrow('Live query requires options parameter');
    });
    
    it('应该在缺少 callback 参数时抛出错误', () => {
      expect(() => {
        query.live({ from: 'users' });
      }).toThrow('Live query requires callback function');
    });
    
    it('应该在缺少 from 参数时抛出错误', () => {
      expect(() => {
        query.live({ where: { city: 'New York' } }, () => {});
      }).toThrow('Live query requires "from" parameter');
    });
    
    it('应该支持取消订阅', () => {
      const subscription = query.live(
        { from: 'users', where: { city: 'New York' } },
        () => {}
      );
      
      // 验证订阅已添加
      expect(mockEventService.subscriptions.get('users')).toHaveLength(1);
      
      // 取消订阅
      subscription.unsubscribe();
      
      // 验证订阅已移除
      expect(mockEventService.subscriptions.get('users')).toHaveLength(0);
    });
    
    it('应该在数据变化时更新结果', () => {
      let callCount = 0;
      let lastResult = null;
      
      const subscription = query.live(
        { from: 'users', where: { city: 'New York' } },
        (result) => {
          callCount++;
          lastResult = result;
        }
      );
      
      // 验证初始调用
      expect(callCount).toBe(1);
      expect(lastResult).toHaveLength(2);
      
      // 模拟数据变化
      mockEventService.simulateDataChange('users');
      
      // 验证更新调用
      expect(callCount).toBe(2);
    });
    
    it('应该在事件服务不可用时警告但不抛出错误', () => {
      // 移除事件服务
      mockCtx.get = (serviceName) => {
        if (serviceName === 'storage') {
          return {
            getData: (sourceName) => {
              if (sourceName === 'users') {
                return [
                  { id: 1, name: 'Alice', age: 30, city: 'New York' },
                  { id: 2, name: 'Bob', age: 25, city: 'Los Angeles' }
                ];
              }
              return [];
            }
          };
        }
        throw new Error(`Unknown service: ${serviceName}`);
      };
      
      query = createQueryEngine(mockCtx);
      
      // 使用控制台警告模拟来验证警告
      const originalWarn = console.warn;
      const warnSpy = vi.fn();
      console.warn = warnSpy;
      
      const subscription = query.live(
        { from: 'users', where: { city: 'New York' } },
        () => {}
      );
      
      // 验证警告已发出
      expect(warnSpy).toHaveBeenCalledWith(
        'Event service not available, live query will not update automatically'
      );
      
      // 验证订阅仍然创建
      expect(subscription).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
      
      // 恢复原始警告函数
      console.warn = originalWarn;
    });
    
    it('应该在取消订阅时处理事件服务不可用的情况', () => {
      // 移除事件服务
      mockCtx.get = (serviceName) => {
        if (serviceName === 'storage') {
          return {
            getData: () => []
          };
        }
        throw new Error(`Unknown service: ${serviceName}`);
      };
      
      query = createQueryEngine(mockCtx);
      
      const subscription = query.live(
        { from: 'users', where: { city: 'New York' } },
        () => {}
      );
      
      // 使用控制台警告模拟来验证警告
      const originalWarn = console.warn;
      const warnSpy = vi.fn();
      console.warn = warnSpy;
      
      // 取消订阅不应该抛出错误
      expect(() => {
        subscription.unsubscribe();
      }).not.toThrow();
      
      // 验证警告已发出
      expect(warnSpy).toHaveBeenCalledWith(
        'Event service not available, unsubscribe operation is a no-op'
      );
      
      // 恢复原始警告函数
      console.warn = originalWarn;
    });

    it('应该处理空数据源', () => {
      mockCtx.get = () => ({
        getData: () => []
      });
      
      query = createQueryEngine(mockCtx);
      
      const result = query({ from: 'emptySource', where: { active: true } });
      expect(result).toEqual([]);
    });

    it('应该处理 null 和 undefined 值的比较', () => {
      const data = [
        { id: 1, name: 'Alice', email: null },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
        { id: 3, name: 'Charlie', email: undefined }
      ];
      
      const result = query({ from: data, where: { email: null } });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    it('应该支持复杂的嵌套条件查询', () => {
      const data = [
        { id: 1, name: 'Alice', age: 30, status: 'active', score: 85 },
        { id: 2, name: 'Bob', age: 25, status: 'active', score: 92 },
        { id: 3, name: 'Charlie', age: 35, status: 'inactive', score: 78 },
        { id: 4, name: 'Diana', age: 28, status: 'active', score: 88 }
      ];
      
      // 查找活跃用户中年龄在 25-30 之间且分数大于 85 的
      const result = query({
        from: data,
        where: (user) => 
          user.status === 'active' && 
          user.age >= 25 && 
          user.age <= 30 &&
          user.score > 85
      });
      
      expect(result).toHaveLength(2);
      expect(result.map(u => u.name)).toEqual(expect.arrayContaining(['Bob', 'Diana']));
    });

    it('应该支持混合使用操作符和函数过滤', () => {
      const data = [
        { id: 1, name: 'Alice', age: 30, tags: ['admin', 'user'] },
        { id: 2, name: 'Bob', age: 25, tags: ['user'] },
        { id: 3, name: 'Charlie', age: 35, tags: ['admin'] },
        { id: 4, name: 'Diana', age: 28, tags: ['user', 'moderator'] }
      ];
      
      // 使用函数过滤数组字段
      const result = query({
        from: data,
        where: (user) => user.tags.includes('admin') && user.age > 30
      });
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Charlie');
    });
  });
});