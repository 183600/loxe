import { describe, it, expect } from 'bun:test';
import { createCache } from './index.js';

describe('Cache', () => {
  it('should set and get values', () => {
    const cache = createCache();
    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');
  });

  it('should check existence with has', () => {
    const cache = createCache();
    expect(cache.has('key')).toBe(false);
    cache.set('key', 'value');
    expect(cache.has('key')).toBe(true);
  });

  it('should delete values', () => {
    const cache = createCache();
    cache.set('key', 'value');
    cache.delete('key');
    expect(cache.has('key')).toBe(false);
  });

  it('should support clear', () => {
    const cache = createCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});
