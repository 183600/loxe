import { describe, it, expect } from 'vitest';
import { createConfig } from './index.js';

describe('Config', () => {
  it('should get and set values', () => {
    const config = createConfig();
    config.set('key', 'value');
    expect(config.get('key')).toBe('value');
  });

  it('should return default value for missing keys', () => {
    const config = createConfig();
    expect(config.get('missing', 'default')).toBe('default');
  });

  it('should check existence with has', () => {
    const config = createConfig();
    config.set('key', 'value');
    expect(config.has('key')).toBe(true);
    expect(config.has('missing')).toBe(false);
  });

  it('should support merge', () => {
    const config = createConfig({ a: 1 });
    config.merge({ b: 2, c: 3 });
    expect(config.get('a')).toBe(1);
    expect(config.get('b')).toBe(2);
  });

  it('should delete keys', () => {
    const config = createConfig({ a: 1, b: 2 });
    expect(config.has('a')).toBe(true);
    
    config.delete('a');
    expect(config.has('a')).toBe(false);
    expect(config.get('a', 'default')).toBe('default');
  });

  it('should return all config values', () => {
    const config = createConfig({ a: 1, b: 2, c: 3 });
    const all = config.all();
    
    expect(all).toEqual({ a: 1, b: 2, c: 3 });
    expect(all).not.toBe(config.all()); // 返回副本，不是引用
  });

  it('should support single object parameter initialization', () => {
    const config = createConfig({ key: 'value' });
    expect(config.get('key')).toBe('value');
  });

  it('should support empty initialization', () => {
    const config = createConfig();
    expect(config.get('missing', 'default')).toBe('default');
  });

  it('should fallback to environment variables for missing keys', () => {
    const originalEnv = process.env.TEST_VAR;
    process.env.TEST_VAR = 'env_value';
    
    const config = createConfig();
    expect(config.get('test.var')).toBe('env_value');
    
    process.env.TEST_VAR = originalEnv;
  });

  it('should prefer config values over environment variables', () => {
    const originalEnv = process.env.TEST_VAR;
    process.env.TEST_VAR = 'env_value';
    
    const config = createConfig({ 'test.var': 'config_value' });
    expect(config.get('test.var')).toBe('config_value');
    
    process.env.TEST_VAR = originalEnv;
  });

  it('should handle nested configuration keys with dot notation', () => {
    const config = createConfig();
    
    config.set('database.host', 'localhost');
    config.set('database.port', 5432);
    config.set('database.username', 'admin');
    config.set('cache.ttl', 3600);
    
    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('database.port')).toBe(5432);
    expect(config.get('database.username')).toBe('admin');
    expect(config.get('cache.ttl')).toBe(3600);
  });

  it('should fallback to environment variables for nested keys', () => {
    const originalEnv = process.env;
    process.env.DATABASE_HOST = 'env_host';
    process.env.DATABASE_PORT = '3306';
    
    const config = createConfig();
    expect(config.get('database.host')).toBe('env_host');
    expect(config.get('database.port')).toBe('3306');
    
    process.env = originalEnv;
  });

  it('should handle merge with nested objects', () => {
    const originalEnvHost = process.env.DATABASE_HOST;
    const originalEnvPort = process.env.DATABASE_PORT;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    
    try {
      const config = createConfig({
        database: {
          host: 'localhost',
          port: 5432
        }
      });
      
      config.merge({
        database: {
          port: 3306,
          username: 'admin'
        }
      });
      
      expect(config.get('database.host')).toBe('localhost');
      expect(config.get('database.port')).toBe(3306);
      expect(config.get('database.username')).toBe('admin');
    } finally {
      if (originalEnvHost) process.env.DATABASE_HOST = originalEnvHost;
      if (originalEnvPort) process.env.DATABASE_PORT = originalEnvPort;
    }
  });

  it('should handle merge with array values', () => {
    const config = createConfig({
      allowedOrigins: ['http://localhost:3000']
    });
    
    config.merge({
      allowedOrigins: ['http://localhost:8080', 'https://example.com']
    });
    
    const origins = config.get('allowedOrigins');
    expect(origins).toEqual(['http://localhost:8080', 'https://example.com']);
  });

  it('should handle delete of non-existent keys gracefully', () => {
    const config = createConfig({ key: 'value' });
    
    expect(() => config.delete('nonexistent')).not.toThrow();
    expect(config.has('key')).toBe(true);
  });

  it('should handle keys with special characters', () => {
    const config = createConfig();
    
    config.set('key:with:colons', 'value1');
    config.set('key.with.dots', 'value2');
    config.set('key-with-dashes', 'value3');
    config.set('key_with_underscores', 'value4');
    
    expect(config.get('key:with:colons')).toBe('value1');
    expect(config.get('key.with.dots')).toBe('value2');
    expect(config.get('key-with-dashes')).toBe('value3');
    expect(config.get('key_with_underscores')).toBe('value4');
  });

  it('should handle empty string keys', () => {
    const config = createConfig();
    
    config.set('', 'empty-key-value');
    expect(config.get('')).toBe('empty-key-value');
    expect(config.has('')).toBe(true);
  });

  it('should handle numeric keys', () => {
    const config = createConfig();
    
    config.set(123, 'numeric-key-value');
    expect(config.get(123)).toBe('numeric-key-value');
    expect(config.has(123)).toBe(true);
  });

  it('should return undefined for non-existent keys without default', () => {
    const config = createConfig();
    
    expect(config.get('nonexistent')).toBeUndefined();
  });

  it('should handle all() returning copy of config', () => {
    const config = createConfig({ a: 1, b: 2 });
    
    const all1 = config.all();
    const all2 = config.all();
    
    expect(all1).toEqual({ a: 1, b: 2 });
    expect(all2).toEqual({ a: 1, b: 2 });
    expect(all1).not.toBe(all2);
    
    // 修改副本不应该影响原始配置
    all1.c = 3;
    expect(config.get('c')).toBeUndefined();
  });

  it('should handle merge with empty object', () => {
    const config = createConfig({ a: 1, b: 2 });
    
    config.merge({});
    
    expect(config.get('a')).toBe(1);
    expect(config.get('b')).toBe(2);
  });

  it('should handle set overwriting existing values', () => {
    const config = createConfig({ key: 'old-value' });
    
    config.set('key', 'new-value');
    expect(config.get('key')).toBe('new-value');
  });

  it('should handle chaining set operations', () => {
    const config = createConfig();
    
    const result = config
      .set('key1', 'value1')
      .set('key2', 'value2')
      .set('key3', 'value3');
    
    expect(result).toBe(config);
    expect(config.get('key1')).toBe('value1');
    expect(config.get('key2')).toBe('value2');
    expect(config.get('key3')).toBe('value3');
  });

  it('should perform deep merge on nested objects', () => {
    const config = createConfig({
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
    });
    
    config.merge({
      database: {
        port: 3306,
        credentials: {
          password: 'new-secret'
        }
      },
      cache: {
        ttl: 7200
      },
      newFeature: {
        enabled: false
      }
    });
    
    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('database.port')).toBe(3306);
    expect(config.get('database.credentials.username')).toBe('admin');
    expect(config.get('database.credentials.password')).toBe('new-secret');
    expect(config.get('cache.enabled')).toBe(true);
    expect(config.get('cache.ttl')).toBe(7200);
    expect(config.get('newFeature.enabled')).toBe(false);
  });

  it('should handle merge with deeply nested structures', () => {
    const config = createConfig({
      level1: {
        level2: {
          level3: {
            value: 'original'
          }
        }
      }
    });
    
    config.merge({
      level1: {
        level2: {
          level3: {
            value: 'updated',
            newValue: 'added'
          },
          newLevel3: {
            value: 'new'
          }
        }
      }
    });
    
    expect(config.get('level1.level2.level3.value')).toBe('updated');
    expect(config.get('level1.level2.level3.newValue')).toBe('added');
    expect(config.get('level1.level2.newLevel3.value')).toBe('new');
  });
});
