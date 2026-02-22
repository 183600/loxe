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
});
