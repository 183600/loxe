import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Core + Config + Logger Integration', () => {
  it('should integrate core with config and logger', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      appName: 'TestApp',
      logLevel: 'info'
    }), true);
    
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      return createLogger(null, { 
        level: config.get('logLevel'),
        prefix: config.get('appName')
      });
    }, true);
    
    const config = core.get('config');
    const logger = core.get('logger');
    
    expect(config.get('appName')).toBe('TestApp');
    expect(logger.getLevel()).toBe('info');
    
    const spy = vi.spyOn(console, 'log');
    logger.info('Application started');
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[TestApp]');
    spy.mockRestore();
  });

  it('should allow dynamic log level changes via config', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ logLevel: 'error' }), true);
    
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      return createLogger(null, { level: config.get('logLevel') });
    }, true);
    
    const config = core.get('config');
    const logger = core.get('logger');
    
    const spy = vi.spyOn(console, 'log');
    
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');
    
    expect(spy).not.toHaveBeenCalled();
    
    // 通过配置更改日志级别
    config.set('logLevel', 'debug');
    logger.setLevel('debug');
    
    logger.debug('debug message 2');
    logger.info('info message 2');
    
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });

  it('should create a configurable logging service', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      enableLogging: true,
      logPrefix: '[APP]'
    }), true);
    
    core.register('logger', () => createLogger(null, { level: 'debug' }), true);
    
    core.register('configurableLogger', (ctx) => {
      const config = ctx.get('config');
      const logger = ctx.get('logger');
      
      return {
        log(level, message, meta) {
          if (config.get('enableLogging')) {
            const prefix = config.get('logPrefix');
            const prefixedMessage = prefix ? `${prefix} ${message}` : message;
            
            switch (level) {
              case 'debug': logger.debug(prefixedMessage, meta); break;
              case 'info': logger.info(prefixedMessage, meta); break;
              case 'warn': logger.warn(prefixedMessage, meta); break;
              case 'error': logger.error(prefixedMessage, meta); break;
            }
          }
        },
        setEnabled(enabled) {
          config.set('enableLogging', enabled);
        }
      };
    }, true);
    
    const service = core.get('configurableLogger');
    const spy = vi.spyOn(console, 'log');
    
    service.log('info', 'Test message', { userId: 123 });
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[APP]');
    expect(output).toContain('Test message');
    
    spy.mockReset();
    
    service.setEnabled(false);
    service.log('info', 'Should not appear');
    expect(spy).not.toHaveBeenCalled();
    
    spy.mockRestore();
  });
});
