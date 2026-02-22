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
});
