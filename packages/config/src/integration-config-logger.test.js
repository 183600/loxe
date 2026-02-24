import { describe, it, expect, vi } from 'vitest';
import { createConfig } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Config + Logger Integration', () => {
  it('should integrate config with logger', () => {
    const config = createConfig({ logLevel: 'info', appName: 'MyApp' });
    const logger = createLogger(null, { 
      level: config.get('logLevel'),
      prefix: config.get('appName')
    });
    
    expect(logger.getLevel()).toBe('info');
    
    const spy = vi.spyOn(console, 'log');
    logger.info('Test message');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
    spy.mockRestore();
  });

  it('should allow logger configuration via config object', () => {
    const config = createConfig({
      logger: {
        level: 'debug',
        prefix: '[DEBUG]',
        enableTimestamp: true
      }
    });
    
    const loggerConfig = config.get('logger');
    const logger = createLogger(null, {
      level: loggerConfig.level,
      prefix: loggerConfig.prefix
    });
    
    expect(logger.getLevel()).toBe('debug');
    
    const spy = vi.spyOn(console, 'log');
    logger.debug('Debug message');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[DEBUG]');
    spy.mockRestore();
  });

  it('should support dynamic log level changes through config', () => {
    const config = createConfig({ logLevel: 'error' });
    const logger = createLogger(null, { level: config.get('logLevel') });
    
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');
    
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledTimes(1);
    
    // 通过配置更新日志级别
    config.set('logLevel', 'debug');
    logger.setLevel('debug');
    
    logger.debug('debug 2');
    logger.info('info 2');
    
    expect(spyLog).toHaveBeenCalledTimes(2);
    expect(spyError).toHaveBeenCalledTimes(1);
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should create a configurable logging utility', () => {
    const config = createConfig({
      'logging.enabled': true,
      'logging.level': 'info',
      'logging.prefix': '[APP]'
    });
    
    const logger = createLogger(null, { level: 'info' });
    
    const createConfigurableLogger = (config, logger) => {
      return {
        log(level, message, meta) {
          const enabled = config.get('logging.enabled');
          if (!enabled) return;
          
          const prefix = config.get('logging.prefix') || '';
          const prefixedMessage = prefix ? `${prefix} ${message}` : message;
          
          switch (level) {
            case 'debug': logger.debug(prefixedMessage, meta); break;
            case 'info': logger.info(prefixedMessage, meta); break;
            case 'warn': logger.warn(prefixedMessage, meta); break;
            case 'error': logger.error(prefixedMessage, meta); break;
          }
        },
        setEnabled(enabled) {
          config.set('logging.enabled', enabled);
        }
      };
    };
    
    const configurableLogger = createConfigurableLogger(config, logger);
    const spy = vi.spyOn(console, 'log');
    
    configurableLogger.log('info', 'Test message');
    expect(spy).toHaveBeenCalled();
    
    spy.mockRestore();
    
    // 重新设置 spy
    const spy2 = vi.spyOn(console, 'log');
    configurableLogger.setEnabled(false);
    configurableLogger.log('info', 'Should not appear');
    expect(spy2).not.toHaveBeenCalled();
    
    spy2.mockRestore();
  });

  it('should support multiple loggers with different configs', () => {
    const config = createConfig({
      'loggers.app.level': 'info',
      'loggers.app.prefix': '[APP]',
      'loggers.db.level': 'debug',
      'loggers.db.prefix': '[DB]',
      'loggers.api.level': 'warn',
      'loggers.api.prefix': '[API]'
    });
    
    const appLogger = createLogger(null, { 
      level: config.get('loggers.app.level'),
      prefix: config.get('loggers.app.prefix')
    });
    const dbLogger = createLogger(null, { 
      level: config.get('loggers.db.level'),
      prefix: config.get('loggers.db.prefix')
    });
    const apiLogger = createLogger(null, { 
      level: config.get('loggers.api.level'),
      prefix: config.get('loggers.api.prefix')
    });
    
    expect(appLogger.getLevel()).toBe('info');
    expect(dbLogger.getLevel()).toBe('debug');
    expect(apiLogger.getLevel()).toBe('warn');
    
    const spy = vi.spyOn(console, 'log');
    
    appLogger.info('App message');
    dbLogger.debug('DB message');
    apiLogger.warn('API message');
    
    expect(spy).toHaveBeenCalledTimes(2); // app.info and db.debug
    
    spy.mockRestore();
  });
});