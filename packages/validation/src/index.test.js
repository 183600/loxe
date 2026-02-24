import { describe, it, expect } from 'vitest';
import { createValidation } from './index.js';

describe('Validation', () => {
  it('should validate strings', () => {
    const { validate } = createValidation();
    expect(validate('hello', ['string']).valid).toBe(true);
    expect(validate(123, ['string']).valid).toBe(false);
  });

  it('should validate numbers', () => {
    const { validate } = createValidation();
    expect(validate(42, ['number']).valid).toBe(true);
    expect(validate('42', ['number']).valid).toBe(false);
  });

  it('should validate with schema', () => {
    const { schema } = createValidation();
    const userSchema = schema({
      name: ['required', 'string'],
      age: ['required', 'number']
    });
    
    const result = userSchema({ name: 'John', age: 30 });
    expect(result.valid).toBe(true);
    
    const invalid = userSchema({ name: 123 });
    expect(invalid.valid).toBe(false);
  });

  it('should validate email format', () => {
    const { validate } = createValidation();
    expect(validate('test@example.com', ['email']).valid).toBe(true);
    expect(validate('invalid-email', ['email']).valid).toBe(false);
    expect(validate('test@', ['email']).valid).toBe(false);
  });

  it('should validate min and max constraints', () => {
    const { validate } = createValidation();
    expect(validate(5, [{ min: 0 }, { max: 10 }]).valid).toBe(true);
    expect(validate(-1, [{ min: 0 }]).valid).toBe(false);
    expect(validate(11, [{ max: 10 }]).valid).toBe(false);
  });

  it('should validate minLength and maxLength constraints', () => {
    const { validate } = createValidation();
    expect(validate('hello', [{ minLength: 3 }, { maxLength: 10 }]).valid).toBe(true);
    expect(validate('hi', [{ minLength: 3 }]).valid).toBe(false);
    expect(validate('this is too long', [{ maxLength: 10 }]).valid).toBe(false);
  });

  it('should support custom validation functions', () => {
    const { validate } = createValidation();
    const customValidator = (value) => {
      return value % 2 === 0 ? true : 'Must be even number';
    };
    
    expect(validate(4, [customValidator]).valid).toBe(true);
    expect(validate(5, [customValidator]).valid).toBe(false);
    expect(validate(5, [customValidator]).errors).toContain('Must be even number');
  });

  it('should validate required fields', () => {
    const { validate } = createValidation();
    expect(validate('value', ['required']).valid).toBe(true);
    expect(validate(null, ['required']).valid).toBe(false);
    expect(validate(undefined, ['required']).valid).toBe(false);
  });

  it('should return all validation errors', () => {
    const { validate } = createValidation();
    const result = validate('invalid', ['email', { minLength: 10 }]);
    
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain('Validation failed: email');
    expect(result.errors).toContain('Validation failed: minLength');
  });
});