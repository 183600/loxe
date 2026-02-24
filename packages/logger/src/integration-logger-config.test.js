import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './index.js';
import { createConfig } from '../../config/src/index.js';

describe('Logger + Config Integration', () => {
  it('should initialize logger with config', () => {
    const config = createConfig({
      logger: {
        level: 'debug',
        prefix: 'MyApp'
      }
    });

    const logger = createLogger(null, {
      level: config.get('logger.level'),
      prefix: config.get('logger.prefix')
    });

    expect(logger.getLevel()).toBe('debug');

    const spy = vi.spyOn(console, 'log');
    logger.info('test message');
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
    spy.mockRestore();
  });

  it('should dynamically update logger level from config', () => {
    const config = createConfig({ loggerLevel: 'info' });

    const logger = createLogger(null, {
      level: config.get('loggerLevel')
    });

    expect(logger.getLevel()).toBe('info');

    const spy = vi.spyOn(console, 'log');

    logger.debug('should not appear');
    expect(spy).not.toHaveBeenCalled();

    config.set('loggerLevel', 'debug');
    logger.setLevel(config.get('loggerLevel'));

    logger.debug('should appear now');
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });

  it('should use config to control log prefixes', () => {
    const config = createConfig({
      app: {
        name: 'ProductionApp',
        env: 'prod'
      }
    });

    const prefix = `[${config.get('app.name')}][${config.get('app.env')}]`;
    const logger = createLogger(null, { level: 'info', prefix });

    const spy = vi.spyOn(console, 'log');
    logger.info('test message');
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[ProductionApp]');
    expect(output).toContain('[prod]');
    spy.mockRestore();
  });

  it('should support different log levels per module via config', () => {
    const config = createConfig({
      logLevels: {
        'auth': 'error',
        'database': 'warn',
        'api': 'info'
      }
    });

    const authLogger = createLogger(null, {
      level: config.get('logLevels.auth'),
      prefix: 'Auth'
    });

    const dbLogger = createLogger(null, {
      level: config.get('logLevels.database'),
      prefix: 'DB'
    });

    const apiLogger = createLogger(null, {
      level: config.get('logLevels.api'),
      prefix: 'API'
    });

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');

    // Auth logger - only error
    authLogger.debug('auth debug');
    authLogger.info('auth info');
    authLogger.warn('auth warn');
    authLogger.error('auth error');
    expect(spyError).toHaveBeenCalledTimes(1);
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyLog).not.toHaveBeenCalled();

    // DB logger - warn and error
    dbLogger.debug('db debug');
    dbLogger.info('db info');
    dbLogger.warn('db warn');
    dbLogger.error('db error');
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(2); // 1 from auth + 1 from db

    // API logger - info, warn, error
    apiLogger.debug('api debug');
    apiLogger.info('api info');
    apiLogger.warn('api warn');
    apiLogger.error('api error');
    expect(spyLog).toHaveBeenCalledTimes(1);
    expect(spyWarn).toHaveBeenCalledTimes(2); // 1 from db + 1 from api
    expect(spyError).toHaveBeenCalledTimes(3); // 1 from auth + 1 from db + 1 from api

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should enable/disable logging based on config flag', () => {
    const config = createConfig({ loggingEnabled: true });

    const logger = createLogger(null, {
      level: config.get('loggingEnabled') ? 'info' : 'error',
      prefix: 'App'
    });

    const spy = vi.spyOn(console, 'log');

    logger.info('enabled message');
    expect(spy).toHaveBeenCalledTimes(1);

    config.set('loggingEnabled', false);
    logger.setLevel(config.get('loggingEnabled') ? 'info' : 'error');

    logger.info('disabled message');
    expect(spy).toHaveBeenCalledTimes(1); // Still 1, not 2

    spy.mockRestore();
  });
});