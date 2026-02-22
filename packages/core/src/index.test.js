import { describe, it, expect } from 'bun:test';
import { createCore } from './index.js';

describe('Core', () => {
  it('should register and get services', () => {
    const core = createCore();
    core.register('test', () => ({ value: 42 }));
    const service = core.get('test');
    expect(service.value).toBe(42);
  });

  it('should support singleton services', () => {
    const core = createCore();
    let count = 0;
    core.register('counter', () => ({ id: ++count }), true);
    
    const a = core.get('counter');
    const b = core.get('counter');
    expect(a.id).toBe(b.id);
  });

  it('should create new instances for non-singleton', () => {
    const core = createCore();
    let count = 0;
    core.register('counter', () => ({ id: ++count }), false);
    
    const a = core.get('counter');
    const b = core.get('counter');
    expect(a.id).not.toBe(b.id);
  });

  it('should check service existence', () => {
    const core = createCore();
    expect(core.has('test')).toBe(false);
    core.register('test', () => ({}));
    expect(core.has('test')).toBe(true);
  });
});
