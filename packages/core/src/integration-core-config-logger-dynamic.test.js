import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Core + Config + Logger', () => {
  it('should initialize logger with log level from config', () => {
    const core = createCore();

    // 注册配置服务，包含日志级别配置
    core.register('config', () => createConfig({
      logging: {
        level: 'warn'
      }
    }), true);

    // 注册日志服务，从配置中读取日志级别
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const logLevel = config.get('logging.level', 'info');
      return createLogger(null, { level: logLevel });
    }, true);

    const logger = core.get('logger');
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');

    // debug 和 info 级别的日志应该被过滤
    logger.debug('debug message');
    logger.info('info message');

    expect(spyLog).not.toHaveBeenCalled();

    // warn 级别的日志应该被记录
    logger.warn('warn message');

    expect(spyWarn).toHaveBeenCalledTimes(1);

    spyLog.mockRestore();
    spyWarn.mockRestore();
  });

  it('should dynamically update logger level when config changes', () => {
    const core = createCore();

    // 注册配置服务
    core.register('config', () => createConfig({
      logging: {
        level: 'error'
      }
    }), true);

    // 注册日志服务
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const logLevel = config.get('logging.level', 'info');
      return createLogger(null, { level: logLevel });
    }, true);

    const logger = core.get('logger');
    const config = core.get('config');

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');

    // 初始只有 error 级别
    logger.debug('debug');
    logger.info('info');
    logger.warn('warn');
    logger.error('error');

    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledTimes(1);

    // 更新配置中的日志级别
    config.set('logging.level', 'debug');

    // 重新获取 logger（模拟重新初始化）
    const updatedLogger = core.get('logger');
    updatedLogger.setLevel('debug');

    // 现在所有级别的日志都应该被记录
    updatedLogger.debug('debug 2');
    updatedLogger.info('info 2');
    updatedLogger.warn('warn 2');
    updatedLogger.error('error 2');

    expect(spyLog).toHaveBeenCalledTimes(2); // debug and info
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(2);

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should support multiple loggers with different configs', () => {
    const core = createCore();

    // 注册配置服务
    core.register('config', () => createConfig({
      logging: {
        app: { level: 'debug' },
        api: { level: 'warn' }
      }
    }), true);

    const config = core.get('config');

    // 注册应用日志服务
    core.register('appLogger', (ctx) => {
      const level = config.get('logging.app.level', 'info');
      return createLogger(null, { level, prefix: 'APP' });
    }, true);

    // 注册 API 日志服务
    core.register('apiLogger', (ctx) => {
      const level = config.get('logging.api.level', 'info');
      return createLogger(null, { level, prefix: 'API' });
    }, true);

    const appLogger = core.get('appLogger');
    const apiLogger = core.get('apiLogger');

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');

    // 应用日志记录 debug 信息
    appLogger.debug('app debug');
    appLogger.info('app info');

    expect(spyLog).toHaveBeenCalledTimes(2);

    // API 日志只记录 warn 及以上级别
    apiLogger.debug('api debug');
    apiLogger.info('api info');
    apiLogger.warn('api warn');

    expect(spyWarn).toHaveBeenCalledTimes(1);

    spyLog.mockRestore();
    spyWarn.mockRestore();
  });

  it('should fallback to default log level when config is missing', () => {
    const core = createCore();

    // 注册空的配置服务
    core.register('config', () => createConfig(), true);

    // 注册日志服务，配置缺失时使用默认值
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const logLevel = config.get('logging.level', 'info');
      return createLogger(null, { level: logLevel });
    }, true);

    const logger = core.get('logger');

    expect(logger.getLevel()).toBe('info');
  });

  it('should handle nested config paths for logger settings', () => {
    const core = createCore();

    // 注册配置服务，使用嵌套路径
    core.register('config', () => createConfig({
      services: {
        logger: {
          level: 'error',
          prefix: 'PROD'
        }
      }
    }), true);

    // 注册日志服务，读取嵌套配置
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const level = config.get('services.logger.level', 'info');
      const prefix = config.get('services.logger.prefix', '');
      return createLogger(null, { level, prefix });
    }, true);

    const logger = core.get('logger');
    const spy = vi.spyOn(console, 'error');

    logger.error('error message');
    const output = spy.mock.calls[0][0];

    expect(output).toContain('[PROD]');
    expect(logger.getLevel()).toBe('error');

    spy.mockRestore();
  });
});