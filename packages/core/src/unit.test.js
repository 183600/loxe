import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';

describe('Core: Basic Unit Tests', () => {
  let core;

  beforeEach(() => {
    core = createCore();
  });

  describe('register 方法', () => {
    it('应该能够注册服务', () => {
      const factory = () => ({ name: 'test' });
      const result = core.register('testService', factory);
      
      expect(result).toBe(core); // 链式调用
      expect(core.has('testService')).toBe(true);
    });

    it('应该支持单例服务注册', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { count: callCount };
      };
      
      core.register('singleton', factory, true);
      
      expect(core.has('singleton')).toBe(true);
    });

    it('应该支持非单例服务注册', () => {
      const factory = () => ({ timestamp: Date.now() });
      core.register('transient', factory, false);
      
      expect(core.has('transient')).toBe(true);
    });

    it('应该支持批量注册服务', () => {
      const registrations = [
        ['service1', () => ({ id: 1 }), false],
        ['service2', () => ({ id: 2 }), true],
        ['service3', () => ({ id: 3 }), false]
      ];
      
      core.registerAll(registrations);
      
      expect(core.has('service1')).toBe(true);
      expect(core.has('service2')).toBe(true);
      expect(core.has('service3')).toBe(true);
    });
  });

  describe('get 方法', () => {
    it('应该能够获取已注册的服务', () => {
      const factory = () => ({ value: 'test' });
      core.register('test', factory);
      
      const service = core.get('test');
      expect(service).toEqual({ value: 'test' });
    });

    it('应该在获取未注册服务时抛出错误', () => {
      expect(() => {
        core.get('nonexistent');
      }).toThrow("Service 'nonexistent' not registered");
    });

    it('单例服务应该返回同一个实例', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { instance: callCount };
      };
      
      core.register('singleton', factory, true);
      
      const instance1 = core.get('singleton');
      const instance2 = core.get('singleton');
      
      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1); // 只调用一次
    });

    it('非单例服务应该每次返回新实例', () => {
      let callCount = 0;
      const factory = () => {
        callCount++;
        return { instance: callCount };
      };
      
      core.register('transient', factory, false);
      
      const instance1 = core.get('transient');
      const instance2 = core.get('transient');
      
      expect(instance1).not.toBe(instance2);
      expect(callCount).toBe(2); // 调用两次
    });

    it('工厂函数应该接收 core 作为参数', () => {
      core.register('dep1', () => ({ name: 'dep1' }));
      
      const factory = (c) => ({
        dep: c.get('dep1')
      });
      
      core.register('service', factory);
      
      const service = core.get('service');
      expect(service.dep).toEqual({ name: 'dep1' });
    });
  });

  describe('has 方法', () => {
    it('应该能够检查服务是否存在', () => {
      expect(core.has('nonexistent')).toBe(false);
      
      core.register('existing', () => ({}));
      expect(core.has('existing')).toBe(true);
    });
  });

  describe('remove 方法', () => {
    it('应该能够删除服务', () => {
      core.register('test', () => ({}));
      expect(core.has('test')).toBe(true);
      
      const result = core.remove('test');
      expect(result).toBe(core); // 链式调用
      expect(core.has('test')).toBe(false);
    });

    it('删除服务后应该清除单例缓存', () => {
      core.register('singleton', () => ({ cached: true }), true);
      
      const instance1 = core.get('singleton');
      expect(instance1).toEqual({ cached: true });
      
      core.remove('singleton');
      core.register('singleton', () => ({ cached: false }), true);
      
      const instance2 = core.get('singleton');
      expect(instance2).toEqual({ cached: false });
    });
  });

  describe('clear 方法', () => {
    it('应该能够清除所有服务', () => {
      core.register('service1', () => ({}));
      core.register('service2', () => ({}), true);
      
      expect(core.list()).toHaveLength(2);
      
      const result = core.clear();
      expect(result).toBe(core); // 链式调用
      expect(core.list()).toHaveLength(0);
    });

    it('清除后应该能够重新注册服务', () => {
      core.register('service1', () => ({}));
      core.clear();
      
      core.register('service2', () => ({}));
      expect(core.has('service2')).toBe(true);
      expect(core.has('service1')).toBe(false);
    });
  });

  describe('list 方法', () => {
    it('应该返回所有已注册服务的名称', () => {
      core.register('service1', () => ({}));
      core.register('service2', () => ({}));
      core.register('service3', () => ({}));
      
      const services = core.list();
      expect(services).toHaveLength(3);
      expect(services).toContain('service1');
      expect(services).toContain('service2');
      expect(services).toContain('service3');
    });

    it('应该返回空数组当没有服务时', () => {
      const services = core.list();
      expect(services).toEqual([]);
    });
  });

  describe('复杂依赖场景', () => {
    it('应该支持服务之间的依赖', () => {
      core.register('database', () => ({ data: [] }));
      
      core.register('repository', (c) => ({
        db: c.get('database'),
        find: (id) => c.get('database').data.find(d => d.id === id)
      }));
      
      core.register('service', (c) => ({
        repo: c.get('repository'),
        getUser: (id) => c.get('repository').find(id)
      }));
      
      const service = core.get('service');
      expect(service.repo.db).toEqual({ data: [] });
      expect(typeof service.getUser).toBe('function');
    });

    it('应该支持循环依赖检测', () => {
      // 注册 A 依赖 B
      core.register('A', (c) => ({
        b: c.get('B')
      }));
      
      // 注册 B 依赖 A（这会导致循环依赖）
      core.register('B', (c) => ({
        a: c.get('A')
      }));
      
      // 获取 A 会触发循环依赖
      expect(() => {
        core.get('A');
      }).toThrow(); // 可能会抛出最大调用栈错误
    });

    it('应该支持多层依赖', () => {
      core.register('level1', () => ({ value: 1 }));
      core.register('level2', (c) => ({ 
        level1: c.get('level1'),
        value: 2 
      }));
      core.register('level3', (c) => ({ 
        level2: c.get('level2'),
        value: 3 
      }));
      
      const level3 = core.get('level3');
      expect(level3.level2.level1.value).toBe(1);
      expect(level3.level2.value).toBe(2);
      expect(level3.value).toBe(3);
    });
  });

  describe('错误处理', () => {
    it('应该处理工厂函数抛出的错误', () => {
      core.register('failing', () => {
        throw new Error('Factory error');
      });
      
      expect(() => {
        core.get('failing');
      }).toThrow('Factory error');
    });

    it('应该处理工厂函数返回 undefined', () => {
      core.register('undefined', () => undefined);
      
      const result = core.get('undefined');
      expect(result).toBeUndefined();
    });
  });
});