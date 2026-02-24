import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';

describe('Core: Singleton Behavior', () => {
  it('should return the same instance for singleton services', () => {
    const core = createCore();

    let instanceCount = 0;

    // 注册单例服务
    core.register('singleton', () => {
      instanceCount++;
      return { id: instanceCount, data: 'singleton-data' };
    }, true);

    // 多次获取应该返回同一个实例
    const instance1 = core.get('singleton');
    const instance2 = core.get('singleton');
    const instance3 = core.get('singleton');

    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
    expect(instanceCount).toBe(1);
  });

  it('should create new instances for non-singleton services', () => {
    const core = createCore();

    let instanceCount = 0;

    // 注册非单例服务
    core.register('factory', () => {
      instanceCount++;
      return { id: instanceCount, data: 'factory-data' };
    }, false);

    // 每次获取应该创建新实例
    const instance1 = core.get('factory');
    const instance2 = core.get('factory');
    const instance3 = core.get('factory');

    expect(instance1).not.toBe(instance2);
    expect(instance2).not.toBe(instance3);
    expect(instanceCount).toBe(3);
  });

  it('should reset singleton cache when service is re-registered', () => {
    const core = createCore();

    let instanceCount = 0;

    // 注册单例服务
    core.register('service', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance1 = core.get('service');
    expect(instance1.id).toBe(1);

    // 重新注册服务
    core.register('service', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance2 = core.get('service');
    expect(instance2.id).toBe(2);
    expect(instance1).not.toBe(instance2);
  });

  it('should clear singleton cache when service is removed', () => {
    const core = createCore();

    let instanceCount = 0;

    core.register('service', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance1 = core.get('service');
    expect(instance1.id).toBe(1);

    // 移除服务
    core.remove('service');

    // 重新注册
    core.register('service', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance2 = core.get('service');
    expect(instance2.id).toBe(2);
  });

  it('should clear all singleton caches when core is cleared', () => {
    const core = createCore();

    let instanceCount = 0;

    core.register('service1', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    core.register('service2', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance1a = core.get('service1');
    const instance2a = core.get('service2');
    expect(instanceCount).toBe(2);

    // 清空 core
    core.clear();

    // 重新注册
    core.register('service1', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    core.register('service2', () => {
      instanceCount++;
      return { id: instanceCount };
    }, true);

    const instance1b = core.get('service1');
    const instance2b = core.get('service2');

    expect(instance1b.id).toBe(3);
    expect(instance2b.id).toBe(4);
    expect(instance1a).not.toBe(instance1b);
    expect(instance2a).not.toBe(instance2b);
  });

  it('should support singleton services with dependencies', () => {
    const core = createCore();

    // 注册依赖服务
    core.register('dependency', () => {
      return { value: 'dependency-value' };
    }, true);

    // 注册依赖单例的服务
    core.register('dependent', (ctx) => {
      const dep = ctx.get('dependency');
      return { dependency: dep.value, computed: 'computed-value' };
    }, true);

    const instance1 = core.get('dependent');
    const instance2 = core.get('dependent');

    expect(instance1).toBe(instance2);
    expect(instance1.dependency).toBe('dependency-value');
  });

  it('should handle singleton services with circular dependencies gracefully', () => {
    const core = createCore();

    // 注册服务 A
    (core.register('serviceA', (ctx) => {
      return {
        name: 'A',
        getB: () => ctx.get('serviceB')
      };
    }, true));

    // 注册服务 B
    (core.register('serviceB', (ctx) => {
      return {
        name: 'B',
        getA: () => ctx.get('serviceA')
      };
    }, true));

    const serviceA = core.get('serviceA');
    const serviceB = core.get('serviceB');

    expect(serviceA.name).toBe('A');
    expect(serviceB.name).toBe('B');
    expect(serviceA.getB()).toBe(serviceB);
    expect(serviceB.getA()).toBe(serviceA);
  });

  it('should maintain singleton state across multiple gets', () => {
    const core = createCore();

    core.register('counter', () => {
      return { count: 0, increment: function() { this.count++; } };
    }, true);

    const counter1 = core.get('counter');
    counter1.increment();
    expect(counter1.count).toBe(1);

    const counter2 = core.get('counter');
    expect(counter2.count).toBe(1);
    counter2.increment();
    expect(counter2.count).toBe(2);

    const counter3 = core.get('counter');
    expect(counter3.count).toBe(2);
  });
});