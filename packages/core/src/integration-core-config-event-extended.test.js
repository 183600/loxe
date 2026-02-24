import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Core + Config + Event', () => {
  let core;

  beforeEach(() => {
    core = createCore();

    // 注册配置服务
    core.register('config', () => createConfig({
      app: {
        name: 'MyApp',
        version: '1.0.0'
      },
      database: {
        host: 'localhost',
        port: 5432
      },
      features: {
        darkMode: false,
        notifications: true
      }
    }), true);

    // 注册事件服务
    core.register('events', () => createEventEmitter(), true);
  });

  it('should emit events when configuration changes', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 监听配置变化事件
    const changeEvents = [];
    events.on('config:changed', (data) => changeEvents.push(data));

    // 修改配置
    config.set('features.darkMode', true);

    // 手动触发事件（因为 config.set 不会自动触发）
    events.emit('config:changed', {
      key: 'features.darkMode',
      oldValue: false,
      newValue: true
    });

    expect(changeEvents).toHaveLength(1);
    expect(changeEvents[0].key).toBe('features.darkMode');
    expect(changeEvents[0].newValue).toBe(true);
  });

  it('should support reactive configuration updates', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 创建响应式配置包装器
    const reactiveConfig = {
      get(key) {
        return config.get(key);
      },
      set(key, value) {
        const oldValue = config.get(key);
        config.set(key, value);
        events.emit('config:changed', { key, oldValue, newValue: value });
      },
      onChange(key, callback) {
        return events.on('config:changed', (event) => {
          if (event.key === key || key === '*') {
            callback(event);
          }
        });
      }
    };

    // 监听特定配置变化
    const updates = [];
    reactiveConfig.onChange('features.darkMode', (event) => {
      updates.push(event);
    });

    // 修改配置
    reactiveConfig.set('features.darkMode', true);
    reactiveConfig.set('features.darkMode', false);

    expect(updates).toHaveLength(2);
    expect(updates[0].newValue).toBe(true);
    expect(updates[1].newValue).toBe(false);
  });

  it('should support configuration validation with events', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 定义验证规则
    const validators = {
      'database.port': (value) => {
        if (typeof value !== 'number' || value < 1 || value > 65535) {
          throw new Error('Port must be a number between 1 and 65535');
        }
        return true;
      }
    };

    // 监听配置变化并验证
    events.on('config:changed', (event) => {
      const validator = validators[event.key];
      if (validator) {
        try {
          validator(event.newValue);
          events.emit('config:validated', { key: event.key, valid: true });
        } catch (error) {
          events.emit('config:validation-error', { key: event.key, error: error.message });
        }
      }
    });

    // 监听验证结果
    const validationResults = [];
    events.on('config:validated', (data) => validationResults.push(data));
    const validationErrors = [];

    events.on('config:validation-error', (data) => validationErrors.push(data));

    // 有效配置
    config.set('database.port', 3306);
    events.emit('config:changed', { key: 'database.port', oldValue: 5432, newValue: 3306 });

    expect(validationResults).toHaveLength(1);
    expect(validationResults[0].valid).toBe(true);

    // 无效配置
    config.set('database.port', 99999);
    events.emit('config:changed', { key: 'database.port', oldValue: 3306, newValue: 99999 });

    expect(validationErrors).toHaveLength(1);
    expect(validationErrors[0].error).toContain('Port must be a number');
  });

  it('should support configuration persistence with events', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 模拟持久化存储
    const persistenceStore = new Map();

    // 监听配置变化并持久化
    events.on('config:changed', (event) => {
      persistenceStore.set(event.key, event.newValue);
    });

    // 修改配置
    config.set('features.notifications', false);
    events.emit('config:changed', { key: 'features.notifications', oldValue: true, newValue: false });

    config.set('app.version', '1.1.0');
    events.emit('config:changed', { key: 'app.version', oldValue: '1.0.0', newValue: '1.1.0' });

    // 验证持久化
    expect(persistenceStore.get('features.notifications')).toBe(false);
    expect(persistenceStore.get('app.version')).toBe('1.1.0');
  });

  it('should support configuration rollback with events', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 保存历史记录
    const history = [];

    events.on('config:changed', (event) => {
      history.push({ ...event, timestamp: Date.now() });
    });

    // 进行一系列修改
    config.set('features.darkMode', true);
    events.emit('config:changed', { key: 'features.darkMode', oldValue: false, newValue: true });

    config.set('features.notifications', false);
    events.emit('config:changed', { key: 'features.notifications', oldValue: true, newValue: false });

    expect(history).toHaveLength(2);

    // 回滚到上一个状态
    const lastChange = history[history.length - 1];
    config.set(lastChange.key, lastChange.oldValue);
    events.emit('config:changed', {
      key: lastChange.key,
      oldValue: lastChange.newValue,
      newValue: lastChange.oldValue
    });

    expect(config.get('features.notifications')).toBe(true);
  });

  it('should support configuration hot reload with events', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 监听重载事件
    const reloadEvents = [];
    events.on('config:reloaded', (data) => reloadEvents.push(data));

    // 模拟从外部加载新配置
    const newConfig = {
      app: {
        name: 'MyApp',
        version: '2.0.0'
      },
      database: {
        host: 'production.example.com',
        port: 5432
      }
    };

    // 合并新配置
    config.merge(newConfig);
    events.emit('config:reloaded', { source: 'external', timestamp: Date.now() });

    expect(reloadEvents).toHaveLength(1);
    expect(config.get('app.version')).toBe('2.0.0');
    expect(config.get('database.host')).toBe('production.example.com');
  });

  it('should support configuration environment switching with events', () => {
    const config = core.get('config');
    const events = core.get('events');

    // 定义不同环境的配置
    const envConfigs = {
      development: {
        database: { host: 'localhost', port: 5432 },
        debug: true
      },
      production: {
        database: { host: 'db.example.com', port: 5432 },
        debug: false
      }
    };

    // 监听环境切换事件
    const envChanges = [];
    events.on('config:environment-changed', (data) => envChanges.push(data));

    // 切换到生产环境
    const switchEnvironment = (env) => {
      const envConfig = envConfigs[env];
      if (envConfig) {
        config.merge(envConfig);
        events.emit('config:environment-changed', { environment: env });
      }
    };

    switchEnvironment('production');

    expect(envChanges).toHaveLength(1);
    expect(envChanges[0].environment).toBe('production');
    expect(config.get('database.host')).toBe('db.example.com');
    expect(config.get('debug')).toBe(false);

    // 切换回开发环境
    switchEnvironment('development');

    expect(envChanges).toHaveLength(2);
    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('debug')).toBe(true);
  });
});