import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Core + Config + Logger Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate core with config', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ apiUrl: 'https://api.example.com' }), true);
    
    const config = core.get('config');
    expect(config.get('apiUrl')).toBe('https://api.example.com');
  });

  it('should integrate core with logger', () => {
    const core = createCore();
    
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    
    const logger = core.get('logger');
    const spy = vi.spyOn(console, 'log');
    
    logger.info('test message');
    
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain('[INFO]');
    expect(spy.mock.calls[0][0]).toContain('test message');
  });

  it('should create a configured logger service', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ logLevel: 'debug', appPrefix: 'MyApp' }), true);
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      return createLogger(null, { 
        level: config.get('logLevel'), 
        prefix: config.get('appPrefix') 
      });
    }, true);
    
    const logger = core.get('logger');
    const spy = vi.spyOn(console, 'log');
    
    logger.debug('debug message');
    logger.info('info message');
    
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0][0]).toContain('[MyApp]');
    expect(spy.mock.calls[0][0]).toContain('[DEBUG]');
    expect(spy.mock.calls[1][0]).toContain('[INFO]');
  });

  it('should use config to control logger level dynamically', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ logLevel: 'error' }), true);
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      return createLogger(null, { level: config.get('logLevel') });
    }, true);
    
    const config = core.get('config');
    const logger = core.get('logger');
    
    const spyLog = vi.spyOn(console, 'log');
    const spyError = vi.spyOn(console, 'error');
    
    logger.info('info message');
    logger.error('error message');
    
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalled();
    
    config.set('logLevel', 'debug');
    const logger2 = createLogger(null, { level: config.get('logLevel') });
    
    logger2.info('info message 2');
    
    expect(spyLog).toHaveBeenCalled();
  });

  it('should create a logging service with config-based prefixes', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      appName: 'MyApp',
      appVersion: '1.0.0',
      logPrefix: '[APP]'
    }), true);
    
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      const appName = config.get('appName');
      const prefix = `${config.get('logPrefix')} ${appName}`;
      return createLogger(null, { level: 'info', prefix });
    }, true);
    
    const logger = core.get('logger');
    const spy = vi.spyOn(console, 'log');
    
    logger.info('startup message');
    
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('[APP]');
    expect(output).toContain('MyApp');
    expect(output).toContain('startup message');
  });

  it('should handle config changes affecting logger behavior', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      logLevel: 'info',
      featureFlags: { enableDebug: false }
    }), true);
    
    core.register('logger', (ctx) => {
      const config = ctx.get('config');
      return createLogger(null, { 
        level: config.get('featureFlags.enableDebug') ? 'debug' : config.get('logLevel')
      });
    }, true);
    
    const config = core.get('config');
    const logger = core.get('logger');
    
    const spy = vi.spyOn(console, 'log');
    
    logger.info('normal message');
    expect(spy).toHaveBeenCalledTimes(1);
    
    config.merge({ featureFlags: { enableDebug: true } });
    const logger2 = createLogger(null, { level: 'debug' });
    
    logger2.debug('debug message');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});