import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createConfig } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Config + Logger', () => {
  let config;
  let logger;
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    config = createConfig({ logLevel: 'info', appName: 'TestApp' });
    logger = createLogger(undefined, { level: config.get('logLevel'), prefix: config.get('appName') });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use config values to initialize logger', () => {
    expect(logger.getLevel()).toBe('info');
    logger.info('Test message');
    expect(logSpy).toHaveBeenCalled();
  });

  it('should support dynamic log level changes from config', () => {
    config.set('logLevel', 'debug');
    logger.setLevel(config.get('logLevel'));
    
    expect(logger.getLevel()).toBe('debug');
    logger.debug('Debug message');
    expect(logSpy).toHaveBeenCalled();
  });

  it('should support config-based logger prefix', () => {
      const prefix = config.get('appName');
      expect(prefix).toBe('TestApp');
  
      logger.info('Test message');
      expect(logSpy).toHaveBeenCalled();
    });
  it('should support nested config values for logger', () => {
      const nestedConfig = createConfig({
        logging: {
          level: 'warn',
          prefix: 'App',
          timestamp: true
        }
      });
      
      const logger2 = createLogger(undefined, {
        level: nestedConfig.get('logging.level'),
        prefix: nestedConfig.get('logging.prefix')
      });
      
      expect(logger2.getLevel()).toBe('warn');
      logger2.warn('Warning message');
      expect(warnSpy).toHaveBeenCalled();
    });
  it('should support config merging for logger settings', () => {
    config.merge({ logLevel: 'error', appName: 'UpdatedApp' });
    
    logger.setLevel(config.get('logLevel'));
    expect(logger.getLevel()).toBe('error');
    
    logger.error('Error message');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should support config with environment variables for logger', () => {
    const envConfig = createConfig();
    
    const logger3 = createLogger(undefined, { 
      level: envConfig.get('LOG_LEVEL', 'info') || 'info',
      prefix: envConfig.get('APP_NAME', 'DefaultApp') || 'DefaultApp'
    });
    
    expect(logger3.getLevel()).toBe('info');
    logger3.info('Environment-based log');
    expect(logSpy).toHaveBeenCalled();
  });
});