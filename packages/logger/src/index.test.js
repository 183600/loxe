import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './index.js';

describe('Logger', () => {
  it('should log info messages', () => {
    const logger = createLogger(null, { level: 'debug' });
    const spy = vi.spyOn(console, 'log');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should respect log level', () => {
    const logger = createLogger(null, { level: 'warn' });
    const spy = vi.spyOn(console, 'log');
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
    const spy = vi.spyOn(console, 'log');
    logger.info('test message');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
    spy.mockRestore();
  });

  it('should log with meta object', () => {
    const logger = createLogger(null, { level: 'info' });
    const spy = vi.spyOn(console, 'log');
    logger.info('test message', { userId: 123, action: 'login' });
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('userId');
    expect(output).toContain('123');
    spy.mockRestore();
  });

  it('should log error messages', () => {
    const logger = createLogger(null, { level: 'error' });
    const spy = vi.spyOn(console, 'error');
    logger.error('error message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log warn messages', () => {
    const logger = createLogger(null, { level: 'warn' });
    const spy = vi.spyOn(console, 'warn');
    logger.warn('warning message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should filter debug messages when level is info', () => {
    const logger = createLogger(null, { level: 'info' });
    const spy = vi.spyOn(console, 'log');
    logger.debug('debug message');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should filter info and debug messages when level is warn', () => {
    const logger = createLogger(null, { level: 'warn' });
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledTimes(1);
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
  });

  it('should only log error messages when level is error', () => {
    const logger = createLogger(null, { level: 'error' });
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledTimes(1);
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should log all messages when level is debug', () => {
    const logger = createLogger(null, { level: 'debug' });
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(spyLog).toHaveBeenCalledTimes(2); // debug and info
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(1);
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should dynamically change log level at runtime', () => {
    const logger = createLogger(null, { level: 'error' });
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    
    // 初始只有 error 级别
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledTimes(1);
    
    // 切换到 debug 级别
    logger.setLevel('debug');
    
    logger.debug('debug message 2');
    logger.info('info message 2');
    logger.warn('warn message 2');
    logger.error('error message 2');
    
    expect(spyLog).toHaveBeenCalledTimes(2); // debug and info
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(2); // 1 before + 1 after
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });
});
