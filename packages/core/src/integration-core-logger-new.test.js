import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCore } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Core + Logger', () => {
  let core;
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    core = createCore();
    core.register('logger', () => createLogger(undefined, { level: 'info' }), true);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide logger service through core', () => {
    const logger = core.get('logger');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should return same logger instance for singleton', () => {
    const logger1 = core.get('logger');
    const logger2 = core.get('logger');
    expect(logger1).toBe(logger2);
  });

  it('should log messages at different levels', () => {
    const logger = core.get('logger');
    
    logger.info('Test info message');
    logger.warn('Test warn message');
    logger.error('Test error message');
    
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should respect log level filtering', () => {
    const logger = core.get('logger');
    
    logger.debug('Debug message');
    logger.info('Info message');
    
    expect(logSpy).toHaveBeenCalledTimes(1); // Only info should be logged
  });

  it('should support service with logger dependency', () => {
    core.register('dataService', (ctx) => {
      const logger = ctx.get('logger');
      return {
        processData: (data) => {
          logger.info('Processing data', { count: data.length });
          return data.map(x => x * 2);
        }
      };
    }, true);

    const dataService = core.get('dataService');
    const result = dataService.processData([1, 2, 3]);
    
    expect(result).toEqual([2, 4, 6]);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should allow changing log level dynamically', () => {
    const logger = core.get('logger');
    
    expect(logger.getLevel()).toBe('info');
    
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
    
    logger.debug('Debug message after level change');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});