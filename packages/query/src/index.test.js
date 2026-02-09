import { describe, it, expect, beforeEach } from 'vitest';
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
});