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
    
    // 获取环境变量值，如果没有则使用默认值
    const logLevel = envConfig.get('LOG_LEVEL', 'info');
    const appName = envConfig.get('APP_NAME', 'DefaultApp');
    
    // 确保默认值正确应用
    const finalLogLevel = logLevel || 'info';
    const finalAppName = appName || 'DefaultApp';
    
    const logger3 = createLogger(undefined, { 
      level: finalLogLevel,
      prefix: finalAppName
    });
    
    // 验证日志级别
    expect(logger3.getLevel()).toBe(finalLogLevel);
    
    // 根据日志级别调用相应的方法
    if (finalLogLevel === 'debug' || finalLogLevel === 'info') {
      logger3.info('Environment-based log');
      expect(logSpy).toHaveBeenCalled();
    } else if (finalLogLevel === 'warn') {
      logger3.warn('Environment-based log');
      expect(warnSpy).toHaveBeenCalled();
    } else if (finalLogLevel === 'error') {
      logger3.error('Environment-based log');
      expect(errorSpy).toHaveBeenCalled();
    }
  });
});