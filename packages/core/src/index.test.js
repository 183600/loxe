import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';

describe('Core', () => {
  it('should register and get services', () => {
    const core = createCore();
    core.register('test', () => ({ value: 42 }));
    const service = core.get('test');
    expect(service.value).toBe(42);
  });

  it('should support singleton services', () => {
    const core = createCore();
    let count = 0;
    core.register('counter', () => ({ id: ++count }), true);
    
    const a = core.get('counter');
    const b = core.get('counter');
    expect(a.id).toBe(b.id);
  });

  it('should create new instances for non-singleton', () => {
    const core = createCore();
    let count = 0;
    core.register('counter', () => ({ id: ++count }), false);
    
    const a = core.get('counter');
    const b = core.get('counter');
    expect(a.id).not.toBe(b.id);
  });

  it('should check service existence', () => {
    const core = createCore();
    expect(core.has('test')).toBe(false);
    core.register('test', () => ({}));
    expect(core.has('test')).toBe(true);
  });

  it('should remove services', () => {
    const core = createCore();
    core.register('test', () => ({ value: 42 }));
    expect(core.has('test')).toBe(true);
    
    core.remove('test');
    expect(core.has('test')).toBe(false);
    expect(() => core.get('test')).toThrow('Service \'test\' not registered');
  });

  it('should clear all services', () => {
    const core = createCore();
    core.register('test1', () => ({ value: 1 }));
    core.register('test2', () => ({ value: 2 }));
    core.register('test3', () => ({ value: 3 }));
    
    expect(core.list()).toHaveLength(3);
    
    core.clear();
    expect(core.list()).toHaveLength(0);
    expect(core.has('test1')).toBe(false);
    expect(core.has('test2')).toBe(false);
    expect(core.has('test3')).toBe(false);
  });

  it('should list all registered services', () => {
    const core = createCore();
    core.register('service1', () => ({}));
    core.register('service2', () => ({}));
    core.register('service3', () => ({}));
    
    const services = core.list();
    expect(services).toHaveLength(3);
    expect(services).toContain('service1');
    expect(services).toContain('service2');
    expect(services).toContain('service3');
  });

  it('should register multiple services at once', () => {
    const core = createCore();
    core.registerAll([
      ['service1', () => ({ id: 1 }), true],
      ['service2', () => ({ id: 2 }), false],
      ['service3', () => ({ id: 3 }), true]
    ]);
    
    expect(core.list()).toHaveLength(3);
    expect(core.get('service1').id).toBe(1);
    expect(core.get('service2').id).toBe(2);
    expect(core.get('service3').id).toBe(3);
  });

  it('should return same instance for singleton services registered via registerAll', () => {
    const core = createCore();
    core.registerAll([
      ['singleton', () => ({ id: Math.random() }), true]
    ]);
    
    const a = core.get('singleton');
    const b = core.get('singleton');
    expect(a.id).toBe(b.id);
  });

  it('should handle factory function throwing errors', () => {
    const core = createCore();
    core.register('errorService', () => {
      throw new Error('Factory error');
    });
    
    expect(() => core.get('errorService')).toThrow('Factory error');
  });

  it('should not cache singleton instance when factory throws', () => {
    const core = createCore();
    let callCount = 0;
    core.register('flakyService', () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('First attempt failed');
      }
      return { success: true };
    }, true);
    
    expect(() => core.get('flakyService')).toThrow('First attempt failed');
    expect(callCount).toBe(1);
    
    const result = core.get('flakyService');
    expect(result.success).toBe(true);
    expect(callCount).toBe(2);
  });

  it('should handle factory function returning null', () => {
    const core = createCore();
    core.register('nullService', () => null);
    
    const result = core.get('nullService');
    expect(result).toBeNull();
  });

  it('should handle factory function returning undefined', () => {
    const core = createCore();
    core.register('undefinedService', () => undefined);
    
    const result = core.get('undefinedService');
    expect(result).toBeUndefined();
  });

  it('should support service dependency injection', () => {
    const core = createCore();
    
    // 注册基础服务
    core.register('config', () => ({ apiUrl: 'https://api.example.com', timeout: 5000 }), true);
    
    // 注册依赖其他服务的服务
    core.register('httpClient', (ctx) => {
      const config = ctx.get('config');
      return {
        baseUrl: config.apiUrl,
        timeout: config.timeout,
        request: (path) => `${config.apiUrl}${path}`
      };
    }, true);
    
    const client = core.get('httpClient');
    expect(client.baseUrl).toBe('https://api.example.com');
    expect(client.timeout).toBe(5000);
    expect(client.request('/users')).toBe('https://api.example.com/users');
  });

  it('should support circular dependency detection through factory', () => {
    const core = createCore();
    
    core.register('serviceA', (ctx) => {
      return { name: 'A', ref: () => ctx.get('serviceB') };
    }, true);
    
    core.register('serviceB', (ctx) => {
      return { name: 'B', ref: () => ctx.get('serviceA') };
    }, true);
    
    const a = core.get('serviceA');
    const b = a.ref();
    expect(b.name).toBe('B');
  });

  it('should handle service with multiple dependencies', () => {
    const core = createCore();
    
    core.register('logger', () => ({ log: (msg) => console.log(msg) }), true);
    core.register('storage', () => ({ data: new Map() }), true);
    core.register('cache', () => ({ items: new Map() }), true);
    
    core.register('dataService', (ctx) => {
      const logger = ctx.get('logger');
      const storage = ctx.get('storage');
      const cache = ctx.get('cache');
      
      return {
        logger,
        storage,
        cache,
        get: (key) => storage.data.get(key),
        set: (key, value) => storage.data.set(key, value)
      };
    }, true);
    
    const service = core.get('dataService');
    expect(service.logger).toBeDefined();
    expect(service.storage).toBeDefined();
    expect(service.cache).toBeDefined();
  });

  it('should allow re-registering services', () => {
    const core = createCore();
    
    core.register('service', () => ({ version: 1 }), true);
    const v1 = core.get('service');
    expect(v1.version).toBe(1);
    
    // 重新注册
    core.register('service', () => ({ version: 2 }), true);
    const v2 = core.get('service');
    expect(v2.version).toBe(2);
  });

  it('should handle service factory returning falsy values', () => {
    const core = createCore();
    
    core.register('falseService', () => false);
    core.register('zeroService', () => 0);
    core.register('emptyStringService', () => '');
    
    expect(core.get('falseService')).toBe(false);
    expect(core.get('zeroService')).toBe(0);
    expect(core.get('emptyStringService')).toBe('');
  });

  it('should throw error when getting unregistered service', () => {
    const core = createCore();
    
    expect(() => core.get('nonexistent')).toThrow('Service \'nonexistent\' not registered');
  });

  it('should handle service with multiple get calls in sequence', () => {
    const core = createCore();
    const calls = [];
    
    core.register('service', () => {
      calls.push(Date.now());
      return { id: calls.length };
    }, true);
    
    const a = core.get('service');
    const b = core.get('service');
    const c = core.get('service');
    
    expect(a.id).toBe(1);
    expect(b.id).toBe(1);
    expect(c.id).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('should support method chaining for register operations', () => {
    const core = createCore();
    
    const result = core
      .register('service1', () => ({ id: 1 }), true)
      .register('service2', () => ({ id: 2 }), false)
      .register('service3', () => ({ id: 3 }), true);
    
    expect(result).toBe(core);
    expect(core.list()).toHaveLength(3);
    expect(core.get('service1').id).toBe(1);
    expect(core.get('service2').id).toBe(2);
    expect(core.get('service3').id).toBe(3);
  });

  it('should pass context to factory functions correctly', () => {
    const core = createCore();
    
    core.register('base', () => ({ value: 10 }), true);
    core.register('dependent', (ctx) => {
      const base = ctx.get('base');
      return { value: base.value * 2 };
    }, true);
    
    const dependent = core.get('dependent');
    expect(dependent.value).toBe(20);
  });

  it('should handle deep dependency chains', () => {
    const core = createCore();
    
    core.register('serviceA', () => ({ data: 'A' }), true);
    core.register('serviceB', (ctx) => {
      const a = ctx.get('serviceA');
      return { data: a.data + '-B' };
    }, true);
    core.register('serviceC', (ctx) => {
      const b = ctx.get('serviceB');
      return { data: b.data + '-C' };
    }, true);
    core.register('serviceD', (ctx) => {
      const c = ctx.get('serviceC');
      return { data: c.data + '-D' };
    }, true);
    
    const d = core.get('serviceD');
    expect(d.data).toBe('A-B-C-D');
  });

  it('should maintain service registration order in list', () => {
    const core = createCore();
    
    core.register('zebra', () => ({}));
    core.register('apple', () => ({}));
    core.register('banana', () => ({}));
    core.register('mango', () => ({}));
    
    const services = core.list();
    expect(services).toEqual(['zebra', 'apple', 'banana', 'mango']);
  });

  it('should handle service names with special characters', () => {
    const core = createCore();
    
    core.register('service:with:colons', () => ({ id: 1 }), true);
    core.register('service.with.dots', () => ({ id: 2 }), true);
    core.register('service-with-dashes', () => ({ id: 3 }), true);
    core.register('service_with_underscores', () => ({ id: 4 }), true);
    
    expect(core.get('service:with:colons').id).toBe(1);
    expect(core.get('service.with.dots').id).toBe(2);
    expect(core.get('service-with-dashes').id).toBe(3);
    expect(core.get('service_with_underscores').id).toBe(4);
  });

  it('should handle removing non-existent service gracefully', () => {
    const core = createCore();
    
    core.register('existing', () => ({ id: 1 }), true);
    
    // 移除不存在的服务不应该抛出错误
    expect(() => core.remove('nonexistent')).not.toThrow();
    
    // 现有服务应该仍然存在
    expect(core.has('existing')).toBe(true);
  });

  it('should handle getting service with circular dependency safely', () => {
    const core = createCore();
    
    core.register('serviceA', (ctx) => {
      return {
        name: 'A',
        getB: () => ctx.get('serviceB')
      };
    }, true);
    
    core.register('serviceB', (ctx) => {
      return {
        name: 'B',
        getA: () => ctx.get('serviceA')
      };
    }, true);
    
    const a = core.get('serviceA');
    const b = a.getB();
    const a2 = b.getA();
    
    expect(a.name).toBe('A');
    expect(b.name).toBe('B');
    expect(a2.name).toBe('A');
    expect(a2).toBe(a);
  });

  it('should handle service factory returning same instance for singleton', () => {
    const core = createCore();
    
    const instance = { id: 42 };
    core.register('singleton', () => instance, true);
    
    const a = core.get('singleton');
    const b = core.get('singleton');
    
    expect(a).toBe(instance);
    expect(b).toBe(instance);
    expect(a).toBe(b);
  });

  it('should handle service names with numeric strings', () => {
    const core = createCore();
    
    core.register('123', () => ({ id: 123 }), true);
    core.register('456', () => ({ id: 456 }), true);
    
    expect(core.get('123').id).toBe(123);
    expect(core.get('456').id).toBe(456);
    expect(core.has('123')).toBe(true);
    expect(core.has('456')).toBe(true);
  });

  it('should handle service factory returning function', () => {
    const core = createCore();
    
    const factoryFunc = () => 'result';
    core.register('service', () => factoryFunc, true);
    
    const retrieved = core.get('service');
    expect(typeof retrieved).toBe('function');
    expect(retrieved()).toBe('result');
  });

  it('should resolve dependencies in correct order', () => {
    const core = createCore();
    const initOrder = [];
    
    core.register('serviceA', (ctx) => {
      initOrder.push('A');
      ctx.get('serviceB');
      return { name: 'A' };
    }, true);
    
    core.register('serviceB', (ctx) => {
      initOrder.push('B');
      ctx.get('serviceC');
      return { name: 'B' };
    }, true);
    
    core.register('serviceC', () => {
      initOrder.push('C');
      return { name: 'C' };
    }, true);
    
    // 获取 serviceA 应该按 A -> B -> C 的顺序初始化
    core.get('serviceA');
    expect(initOrder).toEqual(['A', 'B', 'C']);
  });

  it('should handle circular dependency with lazy resolution', () => {
    const core = createCore();
    
    core.register('parent', (ctx) => {
      return {
        name: 'parent',
        getChild: () => ctx.get('child')
      };
    }, true);
    
    core.register('child', (ctx) => {
      return {
        name: 'child',
        getParent: () => ctx.get('parent')
      };
    }, true);
    
    const parent = core.get('parent');
    const child = parent.getChild();
    expect(child.name).toBe('child');
    
    const parentAgain = child.getParent();
    expect(parentAgain).toBe(parent);
  });

  it('should maintain singleton state across multiple dependency chains', () => {
    const core = createCore();
    
    core.register('shared', () => ({ id: Math.random() }), true);
    
    core.register('service1', (ctx) => {
      const shared = ctx.get('shared');
      return { sharedId: shared.id };
    }, true);
    
    core.register('service2', (ctx) => {
      const shared = ctx.get('shared');
      return { sharedId: shared.id };
    }, true);
    
    const s1 = core.get('service1');
    const s2 = core.get('service2');
    
    expect(s1.sharedId).toBe(s2.sharedId);
  });
});
