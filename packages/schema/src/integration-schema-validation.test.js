import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from '../../core/src/index.js';
import { registerSchema, validate as schemaValidate, clearAllSchemas } from './index.js';
import { createValidation } from '../../validation/src/index.js';

describe('Integration: Schema + Validation', () => {
  let core;
  let validation;

  beforeEach(() => {
    core = createCore();
    validation = createValidation();
    clearAllSchemas();
  });

  it('should register schema and validate data using validation lib', () => {
    // Register a schema using schema lib
    const userSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' }
      },
      required: ['name', 'email']
    };

    registerSchema('user', userSchema);

    // Validate using schema lib
    const schemaResult = schemaValidate('user', {
      name: 'John',
      age: 30,
      email: 'john@example.com'
    });
    expect(schemaResult.valid).toBe(true);

    // Also validate using validation lib for email format
    const emailValidation = validation.validate('john@example.com', ['email']);
    expect(emailValidation.valid).toBe(true);
  });

  it('should combine schema validation with validation lib rules', () => {
    const productSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        price: { type: 'number' },
        quantity: { type: 'number' }
      },
      required: ['name', 'price']
    };

    registerSchema('product', productSchema);

    const productData = {
      name: 'Widget',
      price: 99.99,
      quantity: 10
    };

    // First validate structure with schema
    const schemaResult = schemaValidate('product', productData);
    expect(schemaResult.valid).toBe(true);

    // Then validate business rules with validation lib
    const priceValidation = validation.validate(productData.price, [
      { min: 0 },
      { max: 1000000 }
    ]);
    expect(priceValidation.valid).toBe(true);

    const quantityValidation = validation.validate(productData.quantity, [
      { min: 0 },
      { max: 10000 }
    ]);
    expect(quantityValidation.valid).toBe(true);
  });

  it('should detect validation errors from both schema and validation lib', () => {
    const userSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' }
      },
      required: ['name', 'email']
    };

    registerSchema('user', userSchema);

    const invalidData = {
      name: 'John',
      age: 'not-a-number', // Wrong type
      email: 'invalid-email' // Invalid format
    };

    // Schema validation catches type error
    const schemaResult = schemaValidate('user', invalidData);
    expect(schemaResult.valid).toBe(false);
    expect(schemaResult.errors).toContain("age: Expected type 'number', but got 'string'");

    // Validation lib catches email format error
    const emailValidation = validation.validate(invalidData.email, ['email']);
    expect(emailValidation.valid).toBe(false);
  });

  it('should validate nested objects with combined approach', () => {
    const addressSchema = {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
        zipCode: { type: 'string' }
      },
      required: ['city']
    };

    const userSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        address: addressSchema
      },
      required: ['name']
    };

    registerSchema('user', userSchema);

    const userData = {
      name: 'John',
      address: {
        street: '123 Main St',
        city: 'New York',
        zipCode: '10001'
      }
    };

    const schemaResult = schemaValidate('user', userData);
    expect(schemaResult.valid).toBe(true);

    // Validate zipCode format with validation lib
    const zipValidation = validation.validate(userData.address.zipCode, [
      { minLength: 5 },
      { maxLength: 10 }
    ]);
    expect(zipValidation.valid).toBe(true);
  });

  it('should validate arrays with schema and validation lib', () => {
    const numbersSchema = {
      type: 'array',
      items: { type: 'number' }
    };

    registerSchema('numbers', numbersSchema);

    const validNumbers = [1, 2, 3, 4, 5];
    const schemaResult = schemaValidate('numbers', validNumbers);
    expect(schemaResult.valid).toBe(true);

    // Validate array length with validation lib
    const lengthValidation = validation.validate(validNumbers, [
      { minLength: 1 },
      { maxLength: 10 }
    ]);
    expect(lengthValidation.valid).toBe(true);
  });

  it('should use validation lib schema for complex validation', () => {
    const userSchema = {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' }
      },
      required: ['username', 'email']
    };

    registerSchema('user', userSchema);

    // Create validation schema using validation lib
    const userValidationSchema = validation.schema({
      username: ['required', 'string', { minLength: 3 }, { maxLength: 20 }],
      email: ['required', 'email'],
      age: ['number', { min: 0 }, { max: 150 }]
    });

    const userData = {
      username: 'john_doe',
      email: 'john@example.com',
      age: 30
    };

    // Validate structure with schema lib
    const schemaResult = schemaValidate('user', userData);
    expect(schemaResult.valid).toBe(true);

    // Validate constraints with validation lib
    const validationResult = userValidationSchema(userData);
    expect(validationResult.valid).toBe(true);
  });
});
