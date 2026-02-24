import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  it('should store and retrieve complex objects', () => {
    const cache = createCache();
    const complexObj = {
      id: 1,
      name: 'Test',
      nested: {
        value: 42,
        items: [1, 2, 3]
      },
      timestamp: Date.now()
    };
    
    cache.set('complex', complexObj);
    const retrieved = cache.get('complex');
    
    expect(retrieved).toEqual(complexObj);
    expect(retrieved.nested.items).toEqual([1, 2, 3]);
  });

  it('should store and retrieve arrays', () => {
    const cache = createCache();
    const array = [1, 2, 3, { nested: 'value' }, [4, 5]];
    
    cache.set('array', array);
    const retrieved = cache.get('array');
    
    expect(retrieved).toEqual(array);
    expect(retrieved[3].nested).toBe('value');
  });

  it('should store and retrieve null and undefined values', () => {
    const cache = createCache();
    
    cache.set('nullValue', null);
    cache.set('undefinedValue', undefined);
    
    expect(cache.get('nullValue')).toBeNull();
    expect(cache.get('undefinedValue')).toBeUndefined();
  });

  it('should handle TTL with complex objects', () => {
    const cache = createCache();
    const complexObj = { data: [1, 2, 3], meta: { version: 1 } };
    
    cache.set('temp', complexObj, 1000);
    expect(cache.get('temp')).toEqual(complexObj);
    
    vi.advanceTimersByTime(1000);
    expect(cache.get('temp')).toBeUndefined();
  });

  it('should support batch operations', () => {
    const cache = createCache();
    
    // 批量设置
    const entries = [
      ['key1', 'value1'],
      ['key2', 'value2'],
      ['key3', 'value3'],
      ['key4', { nested: 'value' }],
      ['key5', [1, 2, 3]]
    ];
    
    entries.forEach(([key, value]) => cache.set(key, value));
    
    // 验证批量设置
    expect(cache.size()).toBe(5);
    expect(cache.get('key1')).toBe('value1');
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toEqual({ nested: 'value' });
    expect(cache.get('key5')).toEqual([1, 2, 3]);
    
    // 批量获取
    const keys = ['key1', 'key2', 'key3'];
    const values = keys.map(key => cache.get(key));
    expect(values).toEqual(['value1', 'value2', 'value3']);
    
    // 批量删除
    keys.forEach(key => cache.delete(key));
    expect(cache.size()).toBe(2);
    expect(cache.has('key1')).toBe(false);
    expect(cache.has('key2')).toBe(false);
    expect(cache.has('key3')).toBe(false);
    expect(cache.has('key4')).toBe(true);
    expect(cache.has('key5')).toBe(true);
  });

  it('should handle TTL of zero', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 0);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(0);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle very short TTL', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 1);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(1);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle very long TTL', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 999999999);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(1000);
    expect(cache.get('key')).toBe('value');
  });

  it('should handle keys with special characters', () => {
    const cache = createCache();
    
    cache.set('key:with:colons', 'value1');
    cache.set('key.with.dots', 'value2');
    cache.set('key-with-dashes', 'value3');
    cache.set('key_with_underscores', 'value4');
    cache.set('key/with/slashes', 'value5');
    cache.set('key with spaces', 'value6');
    
    expect(cache.get('key:with:colons')).toBe('value1');
    expect(cache.get('key.with.dots')).toBe('value2');
    expect(cache.get('key-with-dashes')).toBe('value3');
    expect(cache.get('key_with_underscores')).toBe('value4');
    expect(cache.get('key/with/slashes')).toBe('value5');
    expect(cache.get('key with spaces')).toBe('value6');
  });

  it('should handle empty string keys', () => {
    const cache = createCache();
    
    cache.set('', 'empty-key-value');
    expect(cache.get('')).toBe('empty-key-value');
    expect(cache.has('')).toBe(true);
  });

  it('should handle numeric keys', () => {
    const cache = createCache();
    
    cache.set(123, 'numeric-key-value');
    cache.set(456, { data: 'object' });
    
    expect(cache.get(123)).toBe('numeric-key-value');
    expect(cache.get(456)).toEqual({ data: 'object' });
  });

  it('should handle deleting non-existent keys gracefully', () => {
    const cache = createCache();
    
    cache.set('existing', 'value');
    
    // 删除不存在的键不应该抛出错误
    expect(() => cache.delete('nonexistent')).not.toThrow();
    
    // 现有键应该仍然存在
    expect(cache.has('existing')).toBe(true);
  });

  it('should handle large number of entries', () => {
    const cache = createCache();
    
    const count = 1000;
    for (let i = 0; i < count; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    
    expect(cache.size()).toBe(count);
    expect(cache.get('key0')).toBe('value0');
    expect(cache.get(`key${count - 1}`)).toBe(`value${count - 1}`);
  });

  it('should handle clearing cache with TTL timers', () => {
    const cache = createCache();
    
    cache.set('key1', 'value1', 1000);
    cache.set('key2', 'value2', 2000);
    cache.set('key3', 'value3', 3000);
    
    expect(cache.size()).toBe(3);
    
    cache.clear();
    
    expect(cache.size()).toBe(0);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBeUndefined();
    expect(cache.get('key3')).toBeUndefined();
  });

  it('should handle setting same key multiple times with different TTLs', () => {
    const cache = createCache();
    
    cache.set('key', 'value1', 1000);
    vi.advanceTimersByTime(500);
    expect(cache.get('key')).toBe('value1');
    
    cache.set('key', 'value2', 1000);
    vi.advanceTimersByTime(600);
    expect(cache.get('key')).toBe('value2');
    
    vi.advanceTimersByTime(500);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle setting same key without TTL after setting with TTL', () => {
    const cache = createCache();
    
    cache.set('key', 'value1', 1000);
    vi.advanceTimersByTime(500);
    expect(cache.get('key')).toBe('value1');
    
    cache.set('key', 'value2');
    vi.advanceTimersByTime(600);
    expect(cache.get('key')).toBe('value2');
  });

  it('should handle getting keys from empty cache', () => {
    const cache = createCache();
    
    const keys = cache.keys();
    expect(keys).toEqual([]);
  });

  it('should handle size of empty cache', () => {
    const cache = createCache();
    
    expect(cache.size()).toBe(0);
  });
});