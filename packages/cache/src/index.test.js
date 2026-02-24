import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCache } from './index.js';

describe('Cache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('should expire entries after TTL', () => {
    const cache = createCache();
    cache.set('key', 'value', 1000);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(1000);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should update TTL when setting same key again', () => {
    const cache = createCache();
    cache.set('key', 'value1', 1000);
    vi.advanceTimersByTime(500);
    expect(cache.get('key')).toBe('value1');
    
    cache.set('key', 'value2', 1000);
    vi.advanceTimersByTime(600);
    expect(cache.get('key')).toBe('value2');
    
    vi.advanceTimersByTime(400);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should return all keys', () => {
    const cache = createCache();
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    const keys = cache.keys();
    expect(keys).toHaveLength(3);
    expect(keys).toContain('key1');
    expect(keys).toContain('key2');
    expect(keys).toContain('key3');
  });
});