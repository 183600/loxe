import { describe, it, expect } from 'bun:test';
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
});
