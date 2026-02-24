import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createConfig } from './index.js';

describe('Config Environment Variable Tests', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should read from environment variables', () => {
    process.env.TEST_API_URL = 'https://api.example.com';
    process.env.TEST_TIMEOUT = '5000';

    const config = createConfig();

    expect(config.get('test.api.url')).toBe('https://api.example.com');
    expect(config.get('test.timeout')).toBe('5000');
  });

  it('should prioritize local config over environment variables', () => {
    process.env.TEST_VALUE = 'from-env';
    
    const config = createConfig({ testValue: 'from-local' });

    expect(config.get('testValue')).toBe('from-local');
  });

  it('should use environment variable as fallback', () => {
    process.env.FALLBACK_VALUE = 'env-value';
    
    const config = createConfig();

    expect(config.get('fallback.value')).toBe('env-value');
  });

  it('should return default value when neither config nor env var exists', () => {
    const config = createConfig();

    expect(config.get('nonexistent.key', 'default')).toBe('default');
  });

  it('should handle environment variable with underscores as nested keys', () => {
    process.env.DATABASE_HOST = 'localhost';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'mydb';

    const config = createConfig();

    expect(config.get('database.host')).toBe('localhost');
    expect(config.get('database.port')).toBe('5432');
    expect(config.get('database.name')).toBe('mydb');
  });

  it('should handle environment variable with dots in key name', () => {
    process.env.APP_CONFIG_DEBUG = 'true';
    process.env.APP_CONFIG_VERSION = '1.0.0';

    const config = createConfig();

    expect(config.get('app.config.debug')).toBe('true');
    expect(config.get('app.config.version')).toBe('1.0.0');
  });

  it('should handle empty environment variable values', () => {
    process.env.EMPTY_VAR = '';
    
    const config = createConfig();

    expect(config.get('empty.var')).toBe('');
  });

  it('should handle environment variable with special characters', () => {
    process.env.SPECIAL_VAR = 'value-with-dashes_and.dots';
    
    const config = createConfig();

    expect(config.get('special.var')).toBe('value-with-dashes_and.dots');
  });

  it('should handle numeric environment variables as strings', () => {
    process.env.NUMERIC_VAR = '12345';
    process.env.FLOAT_VAR = '3.14';

    const config = createConfig();

    expect(config.get('numeric.var')).toBe('12345');
    expect(config.get('float.var')).toBe('3.14');
  });

  it('should handle boolean-like environment variables as strings', () => {
    process.env.BOOL_TRUE = 'true';
    process.env.BOOL_FALSE = 'false';

    const config = createConfig();

    expect(config.get('bool.true')).toBe('true');
    expect(config.get('bool.false')).toBe('false');
  });

  it('should handle JSON-like environment variables as strings', (Note: JSON parsing is not implemented in createConfig) => {
    process.env.JSON_VAR = '{"key":"value"}';
    
    const config = createConfig();

    expect(config.get('json.var')).toBe('{"key":"value"}');
  });

  it('should handle environment variable with null value', () => {
    process.env.NULL_VAR = 'null';
    
    const config = createConfig();

    expect(config.get('null.var')).toBe('null');
  });

  it('should handle environment variable with undefined value', () => {
    process.env.UNDEFINED_VAR = 'undefined';
    
    const config = createConfig();

    expect(config.get('undefined.var')).toBe('undefined');
  });

  it('should handle case sensitivity in environment variable names', () => {
    process.env.MIXED_CASE = 'value';
    
    const config = createConfig();

    expect(config.get('mixed.case')).toBe('value');
  });

  it('should handle environment variable with spaces', () => {
    process.env.SPACED_VAR = 'value with spaces';
    
    const config = createConfig();

    expect(config.get('spaced.var')).toBe('value with spaces');
  });
});