import { describe, it, expect } from 'bun:test';
import { createEventEmitter } from './index.js';

describe('EventEmitter', () => {
  it('should emit and receive events', () => {
    const emitter = createEventEmitter();
    let received = null;
    emitter.on('test', (data) => { received = data; });
    emitter.emit('test', 'hello');
    expect(received).toBe('hello');
  });

  it('should support once', () => {
    const emitter = createEventEmitter();
    let count = 0;
    emitter.once('test', () => { count++; });
    emitter.emit('test');
    emitter.emit('test');
    expect(count).toBe(1);
  });

  it('should support off', () => {
    const emitter = createEventEmitter();
    let count = 0;
    const fn = () => { count++; };
    emitter.on('test', fn);
    emitter.emit('test');
    emitter.off('test', fn);
    emitter.emit('test');
    expect(count).toBe(1);
  });

  it('should support multiple listeners for same event', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', (data) => { results.push('listener1:' + data); });
    emitter.on('test', (data) => { results.push('listener2:' + data); });
    emitter.on('test', (data) => { results.push('listener3:' + data); });
    
    emitter.emit('test', 'hello');
    
    expect(results).toHaveLength(3);
    expect(results).toContain('listener1:hello');
    expect(results).toContain('listener2:hello');
    expect(results).toContain('listener3:hello');
  });

  it('should remove all listeners for specific event', () => {
    const emitter = createEventEmitter();
    let count = 0;
    
    emitter.on('test', () => { count++; });
    emitter.on('test', () => { count++; });
    emitter.on('test', () => { count++; });
    
    emitter.emit('test');
    expect(count).toBe(3);
    
    emitter.removeAllListeners('test');
    emitter.emit('test');
    expect(count).toBe(3);
  });

  it('should remove all listeners for all events', () => {
    const emitter = createEventEmitter();
    let count1 = 0;
    let count2 = 0;
    
    emitter.on('event1', () => { count1++; });
    emitter.on('event1', () => { count1++; });
    emitter.on('event2', () => { count2++; });
    
    emitter.emit('event1');
    emitter.emit('event2');
    expect(count1).toBe(2);
    expect(count2).toBe(1);
    
    emitter.removeAllListeners();
    emitter.emit('event1');
    emitter.emit('event2');
    expect(count1).toBe(2);
    expect(count2).toBe(1);
  });

  it('should return unsubscribe function from on', () => {
    const emitter = createEventEmitter();
    let count = 0;
    
    const unsubscribe = emitter.on('test', () => { count++; });
    emitter.emit('test');
    expect(count).toBe(1);
    
    unsubscribe();
    emitter.emit('test');
    expect(count).toBe(1);
  });

  it('should handle events with no listeners', () => {
    const emitter = createEventEmitter();
    expect(() => { emitter.emit('nonexistent', 'data'); }).not.toThrow();
  });
});
