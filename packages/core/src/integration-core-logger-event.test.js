import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { createLogger } from '../../logger/src/index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Core + Logger + Event', () => {
  it('should log event emissions', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    
    core.register('eventLogger', (ctx) => {
      const event = ctx.get('event');
      const logger = ctx.get('logger');
      
      // 包装 emit 方法以记录日志
      const originalEmit = event.emit;
      event.emit = function(eventName, data) {
        logger.info(`Event emitted: ${eventName}`, { data });
        return originalEmit.call(this, eventName, data);
      };
      
      return {
        emit: event.emit.bind(event),
        on: event.on.bind(event)
      };
    }, true);
    
    const eventLogger = core.get('eventLogger');
    const spy = vi.spyOn(console, 'log');
    
    eventLogger.emit('user:login', { userId: 123, timestamp: Date.now() });
    
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Event emitted: user:login');
    expect(output).toContain('userId');
    
    spy.mockRestore();
  });

  it('should create event-driven logging service', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    
    core.register('eventDrivenLogger', (ctx) => {
      const event = ctx.get('event');
      const logger = ctx.get('logger');
      
      // 监听特定事件并记录日志
      event.on('log:info', (data) => logger.info(data.message, data.meta));
      event.on('log:warn', (data) => logger.warn(data.message, data.meta));
      event.on('log:error', (data) => logger.error(data.message, data.meta));
      
      const service = {
        log(level, message, meta = {}) {
          event.emit(`log:${level}`, { message, meta });
        },
        
        info: (message, meta) => service.log('info', message, meta),
        warn: (message, meta) => service.log('warn', message, meta),
        error: (message, meta) => service.log('error', message, meta)
      };
      
      return service;
    }, true);
    
    const logger = core.get('eventDrivenLogger');
    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    
    logger.info('User logged in', { userId: 123 });
    logger.warn('High memory usage', { memoryUsage: '90%' });
    logger.error('Database connection failed', { error: 'ECONNREFUSED' });
    
    expect(spyLog).toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalled();
    expect(spyError).toHaveBeenCalled();
    
    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should support event-based log level changes', () => {
    const core = createCore();
    
    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'info' }), true);
    
    core.register('dynamicLogger', (ctx) => {
      const { event, logger } = {
        event: ctx.get('event'),
        logger: ctx.get('logger')
      };
      
      // 监听日志级别变更事件
      event.on('log:level:change', (data) => {
        logger.setLevel(data.level);
      });
      
      return {
        log: logger.info.bind(logger),
        debug: logger.debug.bind(logger),
        setLevel: (level) => event.emit('log:level:change', { level })
      };
    }, true);
    
    const logger = core.get('dynamicLogger');
    const spy = vi.spyOn(console, 'log');
    
    // 初始级别是 info，debug 不应该输出
    logger.debug('Debug message');
    expect(spy).not.toHaveBeenCalled();
    
    // 通过事件改变日志级别
    logger.setLevel('debug');
    
    // 现在 debug 应该输出
    logger.debug('Debug message 2');
    expect(spy).toHaveBeenCalled();
    
    spy.mockRestore();
  });
});