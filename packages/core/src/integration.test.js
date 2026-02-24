import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';

// 模拟其他库的实现
function createConfig(ctx, initialConfig = {}) {
  const config = { ...initialConfig };
  return {
    get(key, defaultValue = undefined) {
      if (key in config) return config[key];
      return defaultValue;
    },
    set(key, value) {
      config[key] = value;
      return this;
    },
    has(key) {
      return key in config;
    },
    delete(key) {
      delete config[key];
      return this;
    },
    all() {
      return { ...config };
    },
    merge(obj) {
      Object.assign(config, obj);
      return this;
    }
  };
}

function createLogger(ctx, options = {}) {
  const { level = 'info', prefix = '' } = options;
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  let currentLevel = level;

  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    setLevel: (newLevel) => { currentLevel = newLevel; },
    getLevel: () => currentLevel
  };
}

function createEventEmitter(ctx) {
  const listeners = new Map();
  return {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return () => this.off(event, callback);
    },
    off(event, callback) {
      if (listeners.has(event)) {
        listeners.get(event).delete(callback);
      }
    },
    emit(event, data) {
      if (listeners.has(event)) {
        for (const callback of listeners.get(event)) {
          callback(data);
        }
      }
    },
    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },
    removeAllListeners(event) {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    }
  };
}

function createStorage(ctx) {
  class MemoryStorage {
    constructor() {
      this.data = new Map();
      this.isOpen = false;
    }

    async open() {
      this.isOpen = true;
    }

    async close() {
      this.isOpen = false;
    }

    async get(key) {
      return this.data.get(key) || null;
    }

    async put(key, value) {
      // 如果值是数组，追加到现有数组
      const existing = this.data.get(key);
      if (Array.isArray(value) && Array.isArray(existing)) {
        this.data.set(key, [...existing, ...value]);
      } else {
        this.data.set(key, value);
      }
    }

    async del(key) {
      return this.data.delete(key);
    }

    async scan(options = {}) {
      const { prefix = '', limit } = options;
      const results = [];
      for (const [key, value] of this.data.entries()) {
        if (key.startsWith(prefix)) {
          results.push({ key, value });
          if (limit && results.length >= limit) break;
        }
      }
      return results;
    }
  }

  const storage = new MemoryStorage();
  storage.open();
  return storage;
}

function createQueryEngine(ctx) {
  const query = function query(options) {
    const { from, where } = options;
    const storage = ctx.get('storage');
    let dataSource = storage.data.get(from) || [];

    if (!where) return dataSource;

    return dataSource.filter(item => {
      for (const [key, value] of Object.entries(where)) {
        if (typeof value === 'object' && value !== null) {
          for (const [operator, operand] of Object.entries(value)) {
            switch (operator) {
              case '$gte':
                if (item[key] < operand) return false;
                break;
              case '$gt':
                if (item[key] <= operand) return false;
                break;
              case '$lte':
                if (item[key] > operand) return false;
                break;
              case '$lt':
                if (item[key] >= operand) return false;
                break;
              case '$eq':
                if (item[key] !== operand) return false;
                break;
              case '$ne':
                if (item[key] === operand) return false;
                break;
            }
          }
        } else if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  };
  return query;
}

describe('库间交互测试', () => {
  let core;
  let config;
  let logger;
  let emitter;
  let storage;
  let query;

  beforeEach(async () => {
    // 创建核心容器
    core = createCore();

    // 注册服务
    core.register('config', (ctx) => createConfig(ctx, { appId: 'test-app', debug: true }), true);
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const level = config.get('debug') ? 'debug' : 'info';
      return createLogger(ctx, { level, prefix: 'TestApp' });
    }, true);
    core.register('events', (ctx) => createEventEmitter(ctx), true);
    core.register('storage', (ctx) => {
      return createStorage(ctx);
    }, true);
    core.register('query', (ctx) => createQueryEngine(ctx), true);

    // 获取服务实例
    config = core.get('config');
    logger = core.get('logger');
    emitter = core.get('events');
    storage = core.get('storage');
    query = core.get('query');
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('应该通过 Core 获取所有服务', () => {
    expect(core.has('config')).toBe(true);
    expect(core.has('logger')).toBe(true);
    expect(core.has('events')).toBe(true);
    expect(core.has('storage')).toBe(true);
    expect(core.has('query')).toBe(true);
  });

  it('应该返回相同的服务实例（单例）', () => {
    const config1 = core.get('config');
    const config2 = core.get('config');
    expect(config1).toBe(config2);

    const logger1 = core.get('logger');
    const logger2 = core.get('logger');
    expect(logger1).toBe(logger2);
  });

  it('应该通过 Config 配置 Logger', () => {
    const logLevel = logger.getLevel();
    expect(logLevel).toBe('debug'); // 因为 config.debug = true
  });

  it('应该通过 Event 发送和接收事件', () => {
    let receivedData = null;
    emitter.on('test-event', (data) => {
      receivedData = data;
    });

    emitter.emit('test-event', { message: 'hello' });
    expect(receivedData).toEqual({ message: 'hello' });
  });

  it('应该通过 Storage 存储数据并通过 Query 查询', async () => {
    // 存储一些测试数据
    await storage.put('users', [{ id: 1, name: 'Alice', age: 30 }]);
    await storage.put('users', [{ id: 2, name: 'Bob', age: 25 }]);
    await storage.put('users', [{ id: 3, name: 'Charlie', age: 35 }]);

    // 通过 Query 查询数据
    const result = query({ from: 'users', where: { age: { $gte: 30 } } });
    expect(result).toHaveLength(2);
    expect(result.every(user => user.age >= 30)).toBe(true);
  });

  it('应该结合 Event 和 Storage 实现数据变更通知', async () => {
    let notified = false;
    emitter.on('data-changed', () => {
      notified = true;
    });

    // 存储数据并触发事件
    await storage.put('test-key', { value: 'test' });
    emitter.emit('data-changed', { key: 'test-key' });

    expect(notified).toBe(true);
  });

  it('应该结合 Logger 和 Event 记录事件', () => {
    const originalInfo = logger.info;
    let loggedMessage = null;
    logger.info = (msg, meta) => {
      loggedMessage = msg;
      originalInfo.call(logger, msg, meta);
    };

    emitter.on('important-event', (data) => {
      logger.info('Important event occurred', data);
    });

    emitter.emit('important-event', { id: 123 });
    expect(loggedMessage).toBe('Important event occurred');

    // 恢复原始方法
    logger.info = originalInfo;
  });

  it('应该通过 Config 获取配置并在 Logger 中使用', () => {
    config.set('customPrefix', 'MyApp');
    const prefix = config.get('customPrefix');
    expect(prefix).toBe('MyApp');
  });

  it('应该支持通过 Core 注册和获取多个服务', () => {
    core.register('custom-service', () => ({ value: 'custom' }), true);
    expect(core.has('custom-service')).toBe(true);

    const customService = core.get('custom-service');
    expect(customService.value).toBe('custom');
  });

  it('应该正确处理服务间的依赖关系', () => {
    // Query 依赖 Storage
    const queryResult = query({ from: 'users' });
    expect(Array.isArray(queryResult)).toBe(true);

    // Logger 依赖 Config
    const logLevel = logger.getLevel();
    expect(['debug', 'info', 'warn', 'error']).toContain(logLevel);
  });
});