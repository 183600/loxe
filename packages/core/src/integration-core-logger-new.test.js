import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCore } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Core + Logger', () => {
  let core;
  let consoleSpy;

  beforeEach(() => {
    core = createCore();
    core.register('logger', () => createLogger(undefined, { level: 'info' }), true);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
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
    
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledTimes(2); // info and warn use console.log
  });

  it('should respect log level filtering', () => {
    const logger = core.get('logger');
    
    logger.debug('Debug message');
    logger.info('Info message');
    
    expect(consoleSpy).toHaveBeenCalledTimes(1); // Only info should be logged
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
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should allow changing log level dynamically', () => {
    const logger = core.get('logger');
    
    expect(logger.getLevel()).toBe('info');
    
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
    
    logger.debug('Debug message after level change');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });
});