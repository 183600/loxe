import { describe, it, expect } from 'bun:test';
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
});
