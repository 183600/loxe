import { describe, it, expect } from 'vitest';
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

  it('should support event chaining with multiple emissions', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('step1', (data) => {
      results.push('step1:' + data);
      emitter.emit('step2', data.toUpperCase());
    });
    
    emitter.on('step2', (data) => {
      results.push('step2:' + data);
      emitter.emit('step3', data + '!');
    });
    
    emitter.on('step3', (data) => {
      results.push('step3:' + data);
    });
    
    emitter.emit('step1', 'hello');
    
    expect(results).toEqual([
      'step1:hello',
      'step2:HELLO',
      'step3:HELLO!'
    ]);
  });

  it('should handle errors in event listeners without affecting other listeners', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', () => {
      results.push('listener1');
    });
    
    emitter.on('test', () => {
      results.push('listener2');
      throw new Error('Listener error');
    });
    
    emitter.on('test', () => {
      results.push('listener3');
    });
    
    expect(() => emitter.emit('test')).toThrow('Listener error');
    expect(results).toEqual(['listener1', 'listener2', 'listener3']);
  });

  it('should support removing listener during event emission', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    const listener = () => {
      results.push('listener');
      emitter.off('test', listener);
    };
    
    emitter.on('test', listener);
    
    emitter.emit('test');
    expect(results).toEqual(['listener']);
    
    emitter.emit('test');
    expect(results).toEqual(['listener']);
  });

  it('should handle complex data structures in events', () => {
    const emitter = createEventEmitter();
    let receivedData = null;
    
    const complexData = {
      id: 1,
      name: 'Test',
      nested: {
        value: 42,
        items: [1, 2, 3]
      },
      timestamp: Date.now()
    };
    
    emitter.on('complex', (data) => {
      receivedData = data;
    });
    
    emitter.emit('complex', complexData);
    
    expect(receivedData).toEqual(complexData);
    expect(receivedData.nested.items).toEqual([1, 2, 3]);
  });

  it('should support event names with special characters', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('event:name', (data) => results.push('colon:' + data));
    emitter.on('event.name', (data) => results.push('dot:' + data));
    emitter.on('event-name', (data) => results.push('dash:' + data));
    emitter.on('event/name', (data) => results.push('slash:' + data));
    
    emitter.emit('event:name', 'test');
    emitter.emit('event.name', 'test');
    emitter.emit('event-name', 'test');
    emitter.emit('event/name', 'test');
    
    expect(results).toHaveLength(4);
    expect(results).toContain('colon:test');
    expect(results).toContain('dot:test');
    expect(results).toContain('dash:test');
    expect(results).toContain('slash:test');
  });

  it('should execute listeners in registration order', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', () => results.push(1));
    emitter.on('test', () => results.push(2));
    emitter.on('test', () => results.push(3));
    emitter.on('test', () => results.push(4));
    
    emitter.emit('test');
    
    expect(results).toEqual([1, 2, 3, 4]);
  });

  it('should maintain order when adding and removing listeners', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    const listener1 = () => results.push(1);
    const listener2 = () => results.push(2);
    const listener3 = () => results.push(3);
    
    emitter.on('test', listener1);
    emitter.on('test', listener2);
    emitter.on('test', listener3);
    
    emitter.emit('test');
    expect(results).toEqual([1, 2, 3]);
    
    emitter.off('test', listener2);
    results.length = 0;
    
    emitter.emit('test');
    expect(results).toEqual([1, 3]);
  });

  it('should execute once listener before regular listeners if registered first', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.once('test', () => results.push('once'));
    emitter.on('test', () => results.push('regular'));
    
    emitter.emit('test');
    expect(results).toEqual(['once', 'regular']);
    
    results.length = 0;
    emitter.emit('test');
    expect(results).toEqual(['regular']);
  });
});
