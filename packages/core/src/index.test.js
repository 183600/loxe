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
});
