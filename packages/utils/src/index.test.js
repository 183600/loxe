import { describe, it, expect } from 'bun:test';
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
});
