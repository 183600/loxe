import { describe, it, expect, vi } from 'vitest';
import { createConfig } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Config + Storage Integration', () => {
  let config;
  let storage;

  beforeEach(async () => {
    config = createConfig();
    storage = createStorage('memory');
    await storage.open();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should load config from storage', async () => {
    // 预先存储配置
    await storage.put('config:app.name', 'MyApp');
    await storage.put('config:app.version', '1.0.0');
    await storage.put('config:database.host', 'localhost');
    await storage.put('config:database.port', '5432');

    // 从存储加载配置
    const appName = await storage.get('config:app.name');
    const version = await storage.get('config:app.version');
    const dbHost = await storage.get('config:database.host');
    const dbPort = await storage.get('config:database.port');

    config.set('app.name', appName);
    config.set('app.version', version);
    config.set('database.host', dbHost);
    config.set('database.port', parseInt(dbPort));

    expect(config.get('app.name')).toBe('MyApp');
    expect(config.get('app.version')).toBe('1.0.0');
    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('database.port')).toBe(5432);
  });

  it('should persist config changes to storage', async () => {
    // 初始配置
    config.set('theme', 'dark');
    config.set('language', 'en');
    config.set('notifications', true);

    // 保存到存储
    await storage.put('config:theme', config.get('theme'));
    await storage.put('config:language', config.get('language'));
    await storage.put('config:notifications', config.get('notifications'));

    // 验证存储
    expect(await storage.get('config:theme')).toBe('dark');
    expect(await storage.get('config:language')).toBe('en');
    expect(await storage.get('config:notifications')).toBe(true);

    // 修改配置并保存
    config.set('theme', 'light');
    await storage.put('config:theme', config.get('theme'));

    expect(await storage.get('config:theme')).toBe('light');
  });

  it('should create a persistent config service', async () => {
    const persistentConfig = {
      async load() {
        const results = await storage.scan({ prefix: 'config:' });
        for (const { key, value } of results) {
          const configKey = key.replace('config:', '');
          config.set(configKey, value);
        }
      },
      async save(key) {
        const value = config.get(key);
        if (value !== undefined) {
          await storage.put(`config:${key}`, value);
        }
      },
      async saveAll() {
        const allConfig = config.all();
        for (const [key, value] of Object.entries(allConfig)) {
          await storage.put(`config:${key}`, value);
        }
      },
      get: config.get.bind(config),
      set: config.set.bind(config)
    };

    // 设置配置
    persistentConfig.set('api.endpoint', 'https://api.example.com');
    persistentConfig.set('api.timeout', 5000);
    persistentConfig.set('features.analytics', true);

    // 保存所有配置
    await persistentConfig.saveAll();

    // 清空配置
    config.delete('api.endpoint');
    config.delete('api.timeout');
    config.delete('features.analytics');

    // 从存储重新加载
    await persistentConfig.load();

    // 验证配置已恢复
    expect(persistentConfig.get('api.endpoint')).toBe('https://api.example.com');
    expect(persistentConfig.get('api.timeout')).toBe(5000);
    expect(persistentConfig.get('features.analytics')).toBe(true);
  });

  it('should handle nested config with storage', async () => {
    const nestedConfig = {
      database: {
        host: 'localhost',
        port: 5432,
        credentials: {
          username: 'admin',
          password: 'secret'
        }
      },
      cache: {
        enabled: true,
        ttl: 3600
      }
    };

    // 保存嵌套配置
    for (const [key, value] of Object.entries(nestedConfig)) {
      await storage.put(`config:${key}`, value);
    }

    // 加载配置
    const dbConfig = await storage.get('config:database');
    const cacheConfig = await storage.get('config:cache');

    config.set('database', dbConfig);
    config.set('cache', cacheConfig);

    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('database.port')).toBe(5432);
    expect(config.get('database.credentials.username')).toBe('admin');
    expect(config.get('cache.enabled')).toBe(true);
    expect(config.get('cache.ttl')).toBe(3600);
  });

  it('should merge config from storage', async () => {
    // 初始配置
    config.merge({
      app: {
        name: 'MyApp',
        version: '1.0.0'
      }
    });

    // 从存储加载额外配置
    await storage.put('config:app.debug', true);
    await storage.put('config:app.env', 'production');

    const debug = await storage.get('config:app.debug');
    const env = await storage.get('config:app.env');

    config.merge({
      app: {
        debug,
        env
      }
    });

    expect(config.get('app.name')).toBe('MyApp');
    expect(config.get('app.version')).toBe('1.0.0');
    expect(config.get('app.debug')).toBe(true);
    expect(config.get('app.env')).toBe('production');
  });

  it('should handle config deletion with storage sync', async () => {
    // 设置配置
    config.set('temp.value', 'temporary');
    await storage.put('config:temp.value', 'temporary');

    expect(config.has('temp.value')).toBe(true);
    expect(await storage.get('config:temp.value')).toBe('temporary');

    // 删除配置
    config.delete('temp.value');
    await storage.del('config:temp.value');

    expect(config.has('temp.value')).toBe(false);
    expect(await storage.get('config:temp.value')).toBeNull();
  });
});