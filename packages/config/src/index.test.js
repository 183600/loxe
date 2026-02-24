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
});
