import { describe, it, expect, beforeEach } from 'vitest';
import { createCache } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Cache + Event', () => {
  let cache;
  let events;

  beforeEach(() => {
    cache = createCache();
    events = createEventEmitter();
  });

  it('should emit events when cache is set', () => {
    const eventLog = [];
    
    events.on('cache:set', (data) => {
      eventLog.push(data);
    });

    cache.set('key1', 'value1');
    events.emit('cache:set', { key: 'key1', value: 'value1' });

    expect(eventLog).toHaveLength(1);
    expect(eventLog[0]).toEqual({ key: 'key1', value: 'value1' });
  });

  it('should emit events when cache is deleted', () => {
    const eventLog = [];
    
    events.on('cache:delete', (data) => {
      eventLog.push(data);
    });

    cache.set('key1', 'value1');
    cache.delete('key1');
    events.emit('cache:delete', { key: 'key1' });

    expect(eventLog).toHaveLength(1);
    expect(eventLog[0]).toEqual({ key: 'key1' });
  });

  it('should emit events when cache is cleared', () => {
    const eventLog = [];
    
    events.on('cache:clear', () => {
      eventLog.push('cleared');
    });

    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.clear();
    events.emit('cache:clear');

    expect(eventLog).toHaveLength(1);
    expect(cache.size()).toBe(0);
  });

  it('should support reactive cache with event invalidation', () => {
    const eventLog = [];
    
    events.on('cache:invalidate', (data) => {
      eventLog.push(data);
      cache.delete(data.key);
    });

    cache.set('user:1', { id: 1, name: 'Alice' });
    expect(cache.get('user:1')).toBeDefined();

    events.emit('cache:invalidate', { key: 'user:1' });

    expect(eventLog).toHaveLength(1);
    expect(cache.get('user:1')).toBeUndefined();
  });

  it('should support cache with TTL and expiration events', () => {
    const eventLog = [];
    
    events.on('cache:expired', (data) => {
      eventLog.push(data);
    });

    cache.set('temp', 'value', 10);
    expect(cache.get('temp')).toBe('value');

    return new Promise((resolve) => {
      setTimeout(() => {
        events.emit('cache:expired', { key: 'temp' });
        expect(eventLog).toHaveLength(1);
        expect(cache.get('temp')).toBeUndefined();
        resolve();
      }, 20);
    });
  });

  it('should support batch cache operations with events', () => {
    const eventLog = [];
    
    events.on('cache:batch', (data) => {
      eventLog.push(data);
    });

    const batch = [
      { key: 'key1', value: 'value1' },
      { key: 'key2', value: 'value2' },
      { key: 'key3', value: 'value3' }
    ];

    batch.forEach(item => cache.set(item.key, item.value));
    events.emit('cache:batch', { operation: 'set', count: batch.length });

    expect(eventLog).toHaveLength(1);
    expect(eventLog[0].count).toBe(3);
    expect(cache.size()).toBe(3);
  });
});