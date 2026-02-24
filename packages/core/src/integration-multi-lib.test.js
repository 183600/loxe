import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';

// 模拟其他库的导入
describe('Core Integration Tests', () => {
  let core;

  beforeEach(() => {
    core = createCore();
  });

  afterEach(() => {
    core.clear();
  });

  it('should integrate with cache service', () => {
    // 注册模拟的 cache 服务
    const mockCache = {
      data: new Map(),
      get(key) { return this.data.get(key); },
      set(key, value) { this.data.set(key, value); return this; },
      has(key) { return this.data.has(key); }
    };

    core.register('cache', () => mockCache, true);
    core.register('userService', (ctx) => {
      const cache = ctx.get('cache');
      return {
        getUser(id) {
          const cached = cache.get(`user:${id}`);
          if (cached) return cached;
          const user = { id, name: `User${id}` };
          cache.set(`user:${id}`, user);
          return user;
        }
      };
    }, true);

    const userService = core.get('userService');
    const user1 = userService.getUser(1);
    expect(user1.name).toBe('User1');

    // 第二次获取应该从缓存中获取
    const user2 = userService.getUser(1);
    expect(user2).toBe(user1);
  });

  it('should integrate with event emitter and logger', () => {
    const mockLogger = {
      logs: [],
      info(msg, meta) { this.logs.push({ level: 'info', msg, meta }); }
    };

    const mockEvent = {
      listeners: new Map(),
      on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
      },
      emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        cbs.forEach(cb => cb(data));
      }
    };

    core.register('logger', () => mockLogger, true);
    core.register('event', () => mockEvent, true);
    core.register('app', (ctx) => {
      const logger = ctx.get('logger');
      const event = ctx.get('event');
      
      event.on('user:login', (user) => {
        logger.info('User logged in', { userId: user.id });
      });
      
      return {
        login(user) {
          event.emit('user:login', user);
        }
      };
    }, true);

    const app = core.get('app');
    app.login({ id: 1, name: 'Alice' });

    expect(mockLogger.logs).toHaveLength(1);
    expect(mockLogger.logs[0].msg).toBe('User logged in');
    expect(mockLogger.logs[0].meta.userId).toBe(1);
  });

  it('should integrate with config and validation', () => {
    const mockConfig = {
      data: { maxRetries: 3, timeout: 5000 },
      get(key) { return this.data[key]; }
    };

    const mockValidation = {
      validate(value, rules) {
        for (const rule of rules) {
          if (rule === 'number' && typeof value !== 'number') return false;
          if (typeof rule === 'object' && rule.min && value < rule.min) return false;
          if (typeof rule === 'object' && rule.max && value > rule.max) return false;
        }
        return true;
      }
    };

    core.register('config', () => mockConfig, true);
    core.register('validation', () => mockValidation, true);
    core.register('apiClient', (ctx) => {
      const config = ctx.get('config');
      const validation = ctx.get('validation');
      
      return {
        setTimeout(timeout) {
          if (!validation.validate(timeout, ['number', { min: 1000 }, { max: 30000 }])) {
            throw new Error('Invalid timeout');
          }
          config.data.timeout = timeout;
        },
        getTimeout() { return config.data.timeout; }
      };
    }, true);

    const client = core.get('apiClient');
    expect(() => client.setTimeout(500)).toThrow('Invalid timeout');
    
    client.setTimeout(10000);
    expect(client.getTimeout()).toBe(10000);
  });

  it('should integrate with storage and cache for data layer', async () => {
    const mockStorage = {
      data: new Map(),
      async get(key) { return this.data.get(key) || null; },
      async put(key, value) { this.data.set(key, value); }
    };

    const mockCache = {
      data: new Map(),
      get(key) { return this.data.get(key); },
      set(key, value) { this.data.set(key, value); }
    };

    core.register('storage', () => mockStorage, true);
    core.register('cache', () => mockCache, true);
    core.register('dataService', (ctx) => {
      const storage = ctx.get('storage');
      const cache = ctx.get('cache');
      
      return {
        async getProduct(id) {
          const cached = cache.get(`product:${id}`);
          if (cached) return cached;
          
          const product = await storage.get(`product:${id}`);
          if (product) {
            cache.set(`product:${id}`, product);
          }
          return product;
        },
        
        async saveProduct(product) {
          await storage.put(`product:${product.id}`, product);
          cache.set(`product:${product.id}`, product);
        }
      };
    }, true);

    const dataService = core.get('dataService');
    
    // 初始从 storage 获取
    mockStorage.data.set('product:1', { id: 1, name: 'Product 1' });
    const product1 = await dataService.getProduct(1);
    expect(product1.name).toBe('Product 1');
    expect(mockCache.data.has('product:1')).toBe(true);
    
    // 第二次从 cache 获取
    const product2 = await dataService.getProduct(1);
    expect(product2).toBe(product1);
  });

  it('should handle service lifecycle with event notifications', () => {
    const mockEvent = {
      listeners: new Map(),
      on(event, callback) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(callback);
      },
      emit(event, data) {
        const cbs = this.listeners.get(event) || [];
        cbs.forEach(cb => cb(data));
      }
    };

    const lifecycleEvents = [];

    core.register('event', () => mockEvent, true);
    core.register('serviceA', (ctx) => {
      const event = ctx.get('event');
      lifecycleEvents.push('A:created');
      event.emit('service:created', { name: 'serviceA' });
      return { name: 'A' };
    }, true);

    core.register('serviceB', (ctx) => {
      const event = ctx.get('event');
      event.on('service:created', ({ name }) => {
        lifecycleEvents.push(`B:detected:${name}`);
      });
      return { name: 'B' };
    }, true);

    core.get('serviceB');
    core.get('serviceA');

    expect(lifecycleEvents).toContain('A:created');
    expect(lifecycleEvents).toContain('B:detected:serviceA');
  });
});