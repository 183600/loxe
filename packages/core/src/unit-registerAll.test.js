import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';

describe('Core: registerAll Method', () => {
  it('should register multiple services at once', () => {
    const core = createCore();

    const registrations = [
      ['service1', () => ({ name: 'service1' }), false],
      ['service2', () => ({ name: 'service2' }), true],
      ['service3', () => ({ name: 'service3' }), false],
      ['service4', () => ({ name: 'service4' }), true]
    ];

    core.registerAll(registrations);

    expect(core.has('service1')).toBe(true);
    expect(core.has('service2')).toBe(true);
    expect(core.has('service3')).toBe(true);
    expect(core.has('service4')).toBe(true);

    expect(core.list()).toEqual(['service1', 'service2', 'service3', 'service4']);
  });

  it('should support batch registration with mixed singleton modes', () => {
    const core = createCore();

    let factoryCount = 0;
    let singletonCount = 0;

    const registrations = [
      ['factory1', () => ({ id: ++factoryCount, type: 'factory' }), false],
      ['singleton1', () => ({ id: ++singletonCount, type: 'singleton' }), true],
      ['factory2', () => ({ id: ++factoryCount, type: 'factory' }), false],
      ['singleton2', () => ({ id: ++singletonCount, type: 'singleton' }), true]
    ];

    core.registerAll(registrations);

    // 获取工厂服务 - 每次创建新实例
    const factory1a = core.get('factory1');
    const factory1b = core.get('factory1');
    expect(factory1a.id).toBe(1);
    expect(factory1b.id).toBe(2);

    const factory2a = core.get('factory2');
    const factory2b = core.get('factory2');
    expect(factory2a.id).toBe(3);
    expect(factory2b.id).toBe(4);

    // 获取单例服务 - 返回相同实例
    const singleton1a = core.get('singleton1');
    const singleton1b = core.get('singleton1');
    expect(singleton1a.id).toBe(1);
    expect(singleton1b.id).toBe(1);
    expect(singleton1a).toBe(singleton1b);

    const singleton2a = core.get('singleton2');
    const singleton2b = core.get('singleton2');
    expect(singleton2a.id).toBe(2);
    expect(singleton2b.id).toBe(2);
    expect(singleton2a).toBe(singleton2b);
  });

  it('should support batch registration with service dependencies', () => {
    const core = createCore();

    const registrations = [
      ['config', () => ({ appName: 'TestApp', version: '1.0.0' }), true],
      ['logger', (ctx) => ({ name: 'Logger', app: ctx.get('config').appName }), true],
      ['storage', (ctx) => ({ name: 'Storage', app: ctx.get('config').appName }), true],
      ['service', (ctx) => ({
        name: 'Service',
        logger: ctx.get('logger'),
        storage: ctx.get('storage')
      }), true]
    ];

    core.registerAll(registrations);

    const service = core.get('service');
    expect(service.name).toBe('Service');
    expect(service.logger.name).toBe('Logger');
    expect(service.logger.app).toBe('TestApp');
    expect(service.storage.name).toBe('Storage');
    expect(service.storage.app).toBe('TestApp');
  });

  it('should return core instance for chaining', () => {
    const core = createCore();

    const registrations = [
      ['service1', () => ({ name: 'service1' }), false],
      ['service2', () => ({ name: 'service2' }), false]
    ];

    const result = core.registerAll(registrations);

    expect(result).toBe(core);
  });

  it('should handle empty registration array', () => {
    const core = createCore();

    const result = core.registerAll([]);

    expect(result).toBe(core);
    expect(core.list()).toEqual([]);
  });

  it('should override existing services when re-registering', () => {
    const core = createCore();

    const initialRegistrations = [
      ['service1', () => ({ version: 1 }), true],
      ['service2', () => ({ version: 1 }), true]
    ];

    core.registerAll(initialRegistrations);

    const service1v1 = core.get('service1');
    const service2v1 = core.get('service2');
    expect(service1v1.version).toBe(1);
    expect(service2v1.version).toBe(1);

    // 重新注册
    const updatedRegistrations = [
      ['service1', () => ({ version: 2 }), true],
      ['service2', () => ({ version: 2 }), true]
    ];

    core.registerAll(updatedRegistrations);

    const service1v2 = core.get('service1');
    const service2v2 = core.get('service2');
    expect(service1v2.version).toBe(2);
    expect(service2v2.version).toBe(2);
    expect(service1v1).not.toBe(service1v2);
  });

  it('should support partial registration with existing services', () => {
    const core = createCore();

    // 先注册一些服务
    core.register('existing1', () => ({ name: 'existing1' }), true);
    core.register('existing2', () => ({ name: 'existing2' }), true);

    // 批量注册新服务
    const newRegistrations = [
      ['new1', () => ({ name: 'new1' }), true],
      ['new2', () => ({ name: 'new2' }), true]
    ];

    core.registerAll(newRegistrations);

    // 所有服务都应该存在
    expect(core.has('existing1')).toBe(true);
    expect(core.has('existing2')).toBe(true);
    expect(core.has('new1')).toBe(true);
    expect(core.has('new2')).toBe(true);

    expect(core.list()).toHaveLength(4);
  });

  it('should maintain registration order', () => {
    const core = createCore();

    const registrations = [
      ['z', () => ({ name: 'z' }), false],
      ['a', () => ({ name: 'a' }), false],
      ['m', () => ({ name: 'm' }), false],
      ['b', () => ({ name: 'b' }), false]
    ];

    core.registerAll(registrations);

    expect(core.list()).toEqual(['z', 'a', 'm', 'b']);
  });

  it('should work with complex service factories', () => {
    const core = createCore();

    const registrations = [
      ['counter', () => {
        let count = 0;
        return {
          get count() { return count; },
          increment() { count++; }
        };
      }, true],

      ['calculator', (ctx) => {
        const counter = ctx.get('counter');
        return {
          add(a, b) {
            counter.increment();
            return a + b;
          },
          multiply(a, b) {
            counter.increment();
            return a * b;
          },
          get operations() { return counter.count; }
        };
      }, true]
    ];

    core.registerAll(registrations);

    const calc = core.get('calculator');
    expect(calc.add(2, 3)).toBe(5);
    expect(calc.multiply(4, 5)).toBe(20);
    expect(calc.operations).toBe(2);

    const counter = core.get('counter');
    expect(counter.count).toBe(2);
  });
});