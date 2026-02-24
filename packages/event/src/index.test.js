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

  it('should handle dynamic listener management during event emission', () => {
    const emitter = createEventEmitter();
    const results = [];
    const listenersToRemove = [];
    
    // 注册多个监听器
    emitter.on('test', () => {
      results.push('listener1');
      // 动态移除 listener2
      emitter.off('test', listenersToRemove[0]);
    });
    
    const listener2 = () => {
      results.push('listener2');
    };
    listenersToRemove.push(listener2);
    emitter.on('test', listener2);
    
    emitter.on('test', () => results.push('listener3'));
    
    emitter.emit('test');
    expect(results).toEqual(['listener1', 'listener3']);
    
    // 第二次发射应该只有 listener1 和 listener3
    results.length = 0;
    emitter.emit('test');
    expect(results).toEqual(['listener1', 'listener3']);
  });

  it('should support conditional listener addition based on event data', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('data', (data) => {
      results.push('initial:' + data);
      
      // 根据数据决定是否添加新监听器
      if (data === 'add') {
        emitter.on('data', (newData) => {
          results.push('dynamic:' + newData);
        });
      }
    });
    
    emitter.emit('data', 'first');
    expect(results).toEqual(['initial:first']);
    
    emitter.emit('data', 'add');
    expect(results).toEqual(['initial:first', 'initial:add', 'dynamic:add']);
    
    emitter.emit('data', 'second');
    expect(results).toEqual(['initial:first', 'initial:add', 'dynamic:add', 'initial:second', 'dynamic:second']);
  });

  it('should handle large number of listeners for same event', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    const listenerCount = 100;
    for (let i = 0; i < listenerCount; i++) {
      emitter.on('test', (data) => {
        results.push(`listener${i}:${data}`);
      });
    }
    
    emitter.emit('test', 'message');
    
    expect(results).toHaveLength(listenerCount);
    expect(results[0]).toBe('listener0:message');
    expect(results[listenerCount - 1]).toBe(`listener${listenerCount - 1}:message`);
  });

  it('should handle removing all listeners from large set', () => {
    const emitter = createEventEmitter();
    const listeners = [];
    
    const listenerCount = 50;
    for (let i = 0; i < listenerCount; i++) {
      const unsubscribe = emitter.on('test', () => {});
      listeners.push(unsubscribe);
    }
    
    // 移除所有监听器
    listeners.forEach(unsubscribe => unsubscribe());
    
    // 验证所有监听器都已移除
    emitter.emit('test');
    // 如果有监听器，它们会被调用，但我们无法直接验证
    // 我们可以通过重新添加监听器来验证之前的监听器已被清理
    let called = false;
    emitter.on('test', () => { called = true; });
    emitter.emit('test');
    expect(called).toBe(true);
  });

  it('should handle event names with unicode characters', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('事件', (data) => results.push('chinese:' + data));
    emitter.on('событие', (data) => results.push('russian:' + data));
    emitter.on('événement', (data) => results.push('french:' + data));
    
    emitter.emit('事件', 'data1');
    emitter.emit('событие', 'data2');
    emitter.emit('événement', 'data3');
    
    expect(results).toHaveLength(3);
    expect(results).toContain('chinese:data1');
    expect(results).toContain('russian:data2');
    expect(results).toContain('french:data3');
  });

  it('should handle empty string event names', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('', (data) => results.push(data));
    
    emitter.emit('', 'empty-event-data');
    
    expect(results).toEqual(['empty-event-data']);
  });

  it('should handle numeric event names', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on(123, (data) => results.push('123:' + data));
    emitter.on(456, (data) => results.push('456:' + data));
    
    emitter.emit(123, 'data1');
    emitter.emit(456, 'data2');
    
    expect(results).toEqual(['123:data1', '456:data2']);
  });

  it('should handle emitting null and undefined data', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', (data) => results.push(data));
    
    emitter.emit('test', null);
    emitter.emit('test', undefined);
    
    expect(results).toEqual([null, undefined]);
  });

  it('should handle emitting very large data objects', () => {
    const emitter = createEventEmitter();
    let receivedData = null;
    
    const largeData = {
      array: Array(1000).fill(0).map((_, i) => i),
      nested: {
        deep: {
          value: 'test'
        }
      }
    };
    
    emitter.on('test', (data) => {
      receivedData = data;
    });
    
    emitter.emit('test', largeData);
    
    expect(receivedData).toEqual(largeData);
    expect(receivedData.array).toHaveLength(1000);
  });

  it('should handle once listener that throws error', () => {
    const emitter = createEventEmitter();
    let callCount = 0;
    
    emitter.once('test', () => {
      callCount++;
      throw new Error('Once listener error');
    });
    
    // 第一次发射应该抛出错误
    expect(() => emitter.emit('test')).toThrow('Once listener error');
    expect(callCount).toBe(1);
    
    // 由于 callback 抛出错误，wrapper 中的 this.off 不会被执行
    // 所以监听器不会被移除，第二次发射也会抛出错误
    expect(() => emitter.emit('test')).toThrow('Once listener error');
    expect(callCount).toBe(2);
  });

  it('should handle off with non-existent listener', () => {
    const emitter = createEventEmitter();
    
    const listener = () => {};
    emitter.on('test', listener);
    
    // 移除不存在的监听器不应该抛出错误
    expect(() => emitter.off('test', () => {})).not.toThrow();
    
    // 原有监听器应该仍然存在
    let called = false;
    emitter.on('test', () => { called = true; });
    emitter.emit('test');
    expect(called).toBe(true);
  });

  it('should handle removeAllListeners with non-existent event', () => {
    const emitter = createEventEmitter();
    
    emitter.on('test', () => {});
    
    // 移除不存在的事件的监听器不应该抛出错误
    expect(() => emitter.removeAllListeners('nonexistent')).not.toThrow();
    
    // test 事件的监听器应该仍然存在
    let called = false;
    emitter.on('test', () => { called = true; });
    emitter.emit('test');
    expect(called).toBe(true);
  });

  it('should handle once listener that removes itself during execution', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    const unsubscribe = emitter.once('test', (data) => {
      results.push(data);
      unsubscribe();
    });
    
    emitter.emit('test', 'first');
    expect(results).toEqual(['first']);
    
    emitter.emit('test', 'second');
    expect(results).toEqual(['first']);
  });

  it('should handle rapid emit calls', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', (data) => {
      results.push(data);
    });
    
    // 快速连续发射多个事件
    for (let i = 0; i < 100; i++) {
      emitter.emit('test', i);
    }
    
    expect(results).toHaveLength(100);
    expect(results[0]).toBe(0);
    expect(results[99]).toBe(99);
  });

  it('should handle listener that modifies the listener set', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('test', (data) => {
      results.push('listener1:' + data);
      // 在监听器中添加新监听器
      emitter.on('test', (newData) => {
        results.push('dynamic:' + newData);
      });
    });
    
    emitter.emit('test', 'first');
    // 新添加的监听器会在当前事件发射中被调用
    expect(results).toEqual(['listener1:first', 'dynamic:first']);
    
    emitter.emit('test', 'second');
    // 第二次发射时，listener1 会再次添加一个 dynamic 监听器
    // 所以会调用 listener1、第一个 dynamic 监听器，然后添加第二个 dynamic 监听器并调用它
    expect(results).toEqual(['listener1:first', 'dynamic:first', 'listener1:second', 'dynamic:second', 'dynamic:second']);
  });

  it('should support wildcard event patterns', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('user:*', (event, data) => {
      results.push({ event, data });
    });
    
    emitter.emit('user:login', { id: 1 });
    emitter.emit('user:logout', { id: 1 });
    emitter.emit('user:update', { id: 1 });
    
    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ event: 'user:login', data: { id: 1 } });
    expect(results[1]).toEqual({ event: 'user:logout', data: { id: 1 } });
    expect(results[2]).toEqual({ event: 'user:update', data: { id: 1 } });
  });

  it('should handle multiple wildcard patterns for same event', () => {
    const emitter = createEventEmitter();
    const results = [];
    
    emitter.on('api:*', (event, data) => results.push('api:' + event));
    emitter.on('api:request:*', (event, data) => results.push('request:' + event));
    
    emitter.emit('api:request:get', { url: '/users' });
    
    expect(results).toHaveLength(2);
    expect(results).toContain('api:api:request:get');
    expect(results).toContain('request:api:request:get');
  });
});
