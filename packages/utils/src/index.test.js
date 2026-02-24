import { describe, it, expect } from 'vitest';
import { createUtils } from './index.js';

describe('Utils', () => {
  it('should check types correctly', () => {
    const utils = createUtils();
    expect(utils.isString('hello')).toBe(true);
    expect(utils.isNumber(42)).toBe(true);
    expect(utils.isArray([1, 2, 3])).toBe(true);
  });

  it('should check empty values', () => {
    const utils = createUtils();
    expect(utils.isEmpty(null)).toBe(true);
    expect(utils.isEmpty('')).toBe(true);
    expect(utils.isEmpty([])).toBe(true);
    expect(utils.isEmpty({})).toBe(true);
    expect(utils.isEmpty('hello')).toBe(false);
  });

  it('should pick and omit keys', () => {
    const utils = createUtils();
    const obj = { a: 1, b: 2, c: 3 };
    expect(utils.pick(obj, ['a', 'b'])).toEqual({ a: 1, b: 2 });
    expect(utils.omit(obj, ['c'])).toEqual({ a: 1, b: 2 });
  });

  it('should check various types correctly', () => {
    const utils = createUtils();
    expect(utils.isNumber(3.14)).toBe(true);
    expect(utils.isNumber(NaN)).toBe(false);
    expect(utils.isBoolean(true)).toBe(true);
    expect(utils.isBoolean(false)).toBe(true);
    expect(utils.isFunction(() => {})).toBe(true);
    expect(utils.isFunction('not a function')).toBe(false);
    expect(utils.isNull(null)).toBe(true);
    expect(utils.isNull('')).toBe(false);
    expect(utils.isUndefined(undefined)).toBe(true);
    expect(utils.isUndefined(null)).toBe(false);
  });

  it('should check object type correctly', () => {
    const utils = createUtils();
    expect(utils.isObject({ a: 1 })).toBe(true);
    expect(utils.isObject([])).toBe(false);
    expect(utils.isObject(null)).toBe(false);
    expect(utils.isObject('string')).toBe(false);
  });

  it('should debounce function calls', () => {
    const utils = createUtils();
    vi.useFakeTimers();
    
    const fn = vi.fn();
    const debounced = utils.debounce(fn, 100);
    
    debounced();
    debounced();
    debounced();
    
    expect(fn).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    
    vi.restoreAllMocks();
  });

  it('should throttle function calls', () => {
    const utils = createUtils();
    vi.useFakeTimers();
    
    const fn = vi.fn();
    const throttled = utils.throttle(fn, 100);
    
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
    
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
    
    vi.restoreAllMocks();
  });
});