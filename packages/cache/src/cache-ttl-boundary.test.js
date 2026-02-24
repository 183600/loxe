import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCache } from './index.js';

describe('Cache TTL Boundary Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle TTL of 0 ms (immediate expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 0);
    vi.advanceTimersByTime(0);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle very small TTL (1 ms)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 1);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(5);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle TTL with negative value (treat as immediate expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', -100);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle very large TTL values', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 999999999);
    expect(cache.get('key')).toBe('value');
  });

  it('should handle TTL as floating point number', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 10.5);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(15);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle TTL with string number (coerced to number)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', '10');
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(15);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle TTL with null (treat as no expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', null);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(10);
    expect(cache.get('key')).toBe('value');
  });

  it('should handle TTL with undefined (treat as no expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', undefined);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(10);
    expect(cache.get('key')).toBe('value');
  });

  it('should handle updating TTL for existing key', () => {
    const cache = createCache();
    
    cache.set('key', 'value1', 5);
    expect(cache.get('key')).toBe('value1');
    
    vi.advanceTimersByTime(3);
    cache.set('key', 'value2', 20);
    expect(cache.get('key')).toBe('value2');
    
    vi.advanceTimersByTime(15);
    expect(cache.get('key')).toBe('value2');
  });

  it('should handle removing TTL from existing key', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 5);
    expect(cache.get('key')).toBe('value');
    
    vi.advanceTimersByTime(3);
    cache.set('key', 'value');
    vi.advanceTimersByTime(10);
    expect(cache.get('key')).toBe('value');
  });
});