import { describe, it, expect, vi, afterEach } from 'vitest';
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

  it('should deep clone simple objects', () => {
    const utils = createUtils();
    const obj = { a: 1, b: 'hello', c: true };
    const cloned = utils.deepClone(obj);
    
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it('should deep clone nested objects', () => {
    const utils = createUtils();
    const obj = {
      level1: {
        level2: {
          level3: { value: 42 }
        }
      }
    };
    const cloned = utils.deepClone(obj);
    
    expect(cloned).toEqual(obj);
    expect(cloned.level1).not.toBe(obj.level1);
    expect(cloned.level1.level2).not.toBe(obj.level1.level2);
  });

  it('should deep clone arrays', () => {
    const utils = createUtils();
    const arr = [1, { a: 2 }, [3, 4]];
    const cloned = utils.deepClone(arr);
    
    expect(cloned).toEqual(arr);
    expect(cloned).not.toBe(arr);
    expect(cloned[1]).not.toBe(arr[1]);
    expect(cloned[2]).not.toBe(arr[2]);
  });

  it('should deep merge nested objects', () => {
    const utils = createUtils();
    const target = {
      a: 1,
      nested: { x: 1, y: 2 }
    };
    const source = {
      b: 2,
      nested: { y: 20, z: 3 }
    };
    
    const merged = utils.deepMerge(target, source);
    
    expect(merged).toEqual({
      a: 1,
      b: 2,
      nested: { x: 1, y: 20, z: 3 }
    });
  });

  it('should not mutate original objects during deep merge', () => {
    const utils = createUtils();
    const target = { a: 1, nested: { x: 1 } };
    const source = { b: 2, nested: { y: 2 } };
    
    const merged = utils.deepMerge(target, source);
    
    expect(target).toEqual({ a: 1, nested: { x: 1 } });
    expect(source).toEqual({ b: 2, nested: { y: 2 } });
    expect(merged.nested).not.toBe(target.nested);
    expect(merged.nested).not.toBe(source.nested);
  });

  it('should pick non-existent keys gracefully', () => {
    const utils = createUtils();
    const obj = { a: 1, b: 2 };
    const result = utils.pick(obj, ['a', 'c', 'd']);
    
    expect(result).toEqual({ a: 1 });
  });

  it('should omit multiple keys', () => {
    const utils = createUtils();
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const result = utils.omit(obj, ['b', 'd']);
    
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('should handle throttle with rapid calls', () => {
    const utils = createUtils();
    vi.useFakeTimers();
    
    const fn = vi.fn();
    const throttled = utils.throttle(fn, 100);
    
    // 快速调用多次
    throttled();
    throttled();
    throttled();
    throttled();
    
    expect(fn).toHaveBeenCalledTimes(1);
    
    vi.advanceTimersByTime(100);
    throttled();
    expect(fn).toHaveBeenCalledTimes(2);
    
    vi.restoreAllMocks();
  });
});