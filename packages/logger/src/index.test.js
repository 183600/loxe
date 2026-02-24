import { describe, it, expect, spyOn } from 'bun:test';
import { createLogger } from './index.js';

describe('Logger', () => {
  it('should log info messages', () => {
    const logger = createLogger(null, { level: 'debug' });
    const spy = spyOn(console, 'log');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should respect log level', () => {
    const logger = createLogger(null, { level: 'warn' });
    const spy = spyOn(console, 'log');
    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should allow changing level', () => {
    const logger = createLogger(null, { level: 'error' });
    expect(logger.getLevel()).toBe('error');
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
  });

  it('should log with prefix', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'MyApp' });
    const spy = spyOn(console, 'log');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
    spy.mockRestore();
  });

  it('should log with meta object', () => {
    const logger = createLogger(null, { level: 'info' });
    const spy = spyOn(console, 'log');
    logger.info('test message', { userId: 123, action: 'login' });
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('userId');
    expect(output).toContain('123');
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const logger = createLogger(null, { level: 'error' });
    const spy = spyOn(console, 'error');
    logger.error('error message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log warn messages', () => {
    const logger = createLogger(null, { level: 'warn' });
    const spy = spyOn(console, 'warn');
    logger.warn('warning message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should filter debug messages when level is info', () => {
    const logger = createLogger(null, { level: 'info' });
    const spy = spyOn(console, 'log');
    logger.debug('debug message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
