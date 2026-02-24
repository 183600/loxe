import { describe, it, expect } from 'vitest';
import { createCache } from './index.js';

describe('Cache TTL Boundary Tests', () => {
  it('should handle TTL of 0 ms (immediate expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 0);
    expect(cache.get('key')).toBeUndefined();
  });

  it('should handle very small TTL (1 ms)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 1);
    expect(cache.get('key')).toBe('value');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('key')).toBeUndefined();
        resolve();
      }, 5);
    });
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
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('key')).toBeUndefined();
        resolve();
      }, 15);
    });
  });

  it('should handle TTL with string number (coerced to number)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', '10');
    expect(cache.get('key')).toBe('value');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('key')).toBeUndefined();
        resolve();
      }, 15);
    });
  });

  it('should handle TTL with null (treat as no expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', null);
    expect(cache.get('key')).toBe('value');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('key')).toBe('value');
        resolve();
      }, 10);
    });
  });

  it('should handle TTL with undefined (treat as no expiration)', () => {
    const cache = createCache();
    
    cache.set('key', 'value', undefined);
    expect(cache.get('key')).toBe('value');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(cache.get('key')).toBe('value');
        resolve();
      }, 10);
    });
  });

  it('should handle updating TTL for existing key', () => {
    const cache = createCache();
    
    cache.set('key', 'value1', 5);
    expect(cache.get('key')).toBe('value1');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        cache.set('key', 'value2', 20);
        expect(cache.get('key')).toBe('value2');
        
        setTimeout(() => {
          expect(cache.get('key')).toBe('value2');
          resolve();
        }, 15);
      }, 3);
    });
  });

  it('should handle removing TTL from existing key', () => {
    const cache = createCache();
    
    cache.set('key', 'value', 5);
    expect(cache.get('key')).toBe('value');
    
    return new Promise((resolve) => {
      setTimeout(() => {
        cache.set('key', 'value');
        setTimeout(() => {
          expect(cache.get('key')).toBe('value');
          resolve();
        }, 10);
      }, 3);
    });
  });
});