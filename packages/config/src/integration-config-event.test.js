import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConfig } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Config + Event', () => {
  let config;
  let events;
  let configChangeLog;

  beforeEach(() => {
    configChangeLog = [];
    config = createConfig({
      api: {
        baseUrl: 'https://api.example.com',
        timeout: 5000
      },
      features: {
        darkMode: false,
        notifications: true
      }
    });
    events = createEventEmitter();

    // 监听配置变更事件
    events.on('config:changed', (key, oldValue, newValue) => {
      configChangeLog.push({ key, oldValue, newValue, timestamp: Date.now() });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit events when config values change', () => {
    const originalUrl = config.get('api.baseUrl');
    const originalTimeout = config.get('api.timeout');

    // 修改配置并发出事件
    config.set('api.baseUrl', 'https://api.newdomain.com');
    events.emit('config:changed', 'api.baseUrl', originalUrl, config.get('api.baseUrl'));

    config.set('api.timeout', 10000);
    events.emit('config:changed', 'api.timeout', originalTimeout, config.get('api.timeout'));

    // 验证变更日志
    expect(configChangeLog).toHaveLength(2);
    expect(configChangeLog[0].key).toBe('api.baseUrl');
    expect(configChangeLog[0].oldValue).toBe('https://api.example.com');
    expect(configChangeLog[0].newValue).toBe('https://api.newdomain.com');
    expect(configChangeLog[1].key).toBe('api.timeout');
    expect(configChangeLog[1].oldValue).toBe(5000);
    expect(configChangeLog[1].newValue).toBe(10000);

    // 验证配置已更新
    expect(config.get('api.baseUrl')).toBe('https://api.newdomain.com');
    expect(config.get('api.timeout')).toBe(10000);
  });

  it('should support reactive feature toggles via config events', () => {
    const featureStates = [];

    // 监听功能开关变更
    events.on('feature:toggled', (featureName, enabled) => {
      featureStates.push({ featureName, enabled });
      config.set(`features.${featureName}`, enabled);
    });

    // 切换功能开关
    events.emit('feature:toggled', 'darkMode', true);
    events.emit('feature:toggled', 'notifications', false);

    // 验证功能状态
    expect(featureStates).toHaveLength(2);
    expect(featureStates[0]).toEqual({ featureName: 'darkMode', enabled: true });
    expect(featureStates[1]).toEqual({ featureName: 'notifications', enabled: false });

    // 验证配置已更新
    expect(config.get('features.darkMode')).toBe(true);
    expect(config.get('features.notifications')).toBe(false);
  });
});