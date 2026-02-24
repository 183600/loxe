import { describe, it, expect, vi } from 'vitest';
import { createEventEmitter } from './index.js';
import { createLogger } from '../logger/src/index.js';

describe('Integration: Event + Logger Direct Interaction', () => {
  it('should log all event emissions with metadata', () => {
    const event = createEventEmitter();
    const logger = createLogger(null, { level: 'info' });

    const spyLog = vi.spyOn(console, 'log');

    // 包装 emit 方法以记录日志
    const originalEmit = event.emit;
    event.emit = function(eventName, data) {
      logger.info(`Event emitted: ${eventName}`, { data });
      return originalEmit.call(this, eventName, data);
    };

    event.emit('user:login', { userId: 123, timestamp: Date.now() });
    event.emit('user:logout', { userId: 123, sessionDuration: 3600 });

    expect(spyLog).toHaveBeenCalledTimes(2);
    expect(spyLog.mock.calls[0][0]).toContain('Event emitted: user:login');
    expect(spyLog.mock.calls[1][0]).toContain('Event emitted: user:logout');

    spyLog.mockRestore();
  });

  it('should log errors thrown in event listeners', () => {
    const event = createEventEmitter();
    const logger = createLogger(null, { level: 'error' });

    const spyError = vi.spyOn(console, 'error');

    // 监听错误事件并记录
    event.on('listener:error', (error, eventName, data) => {
      logger.error(`Error in listener for event: ${eventName}`, { error: error.message, data });
    });

    // 包装 emit 方法以捕获错误
    const originalEmit = event.emit;
    event.emit = function(eventName, data) {
      try {
        return originalEmit.call(this, eventName, data);
      } catch (error) {
        event.emit('listener:error', error, eventName, data);
        throw error;
      }
    };

    // 添加会抛出错误的监听器
    event.on('test', () => {
      throw new Error('Listener failed');
    });

    expect(() => event.emit('test', { data: 'test' })).toThrow('Listener failed');
    expect(spyError).toHaveBeenCalled();
    expect(spyError.mock.calls[0][0]).toContain('Error in listener for event: test');
    expect(spyError.mock.calls[0][0]).toContain('Listener failed');

    spyError.mockRestore();
  });

  it('should create event-driven logger with level filtering', () => {
    const event = createEventEmitter();
    const logger = createLogger(null, { level: 'warn' });

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');

    // 监听日志事件并转发到 logger
    event.on('log:info', (data) => logger.info(data.message, data.meta));
    event.on('log:warn', (data) => logger.warn(data.message, data.meta));
    event.on('log:error', (data) => logger.error(data.message, data.meta));

    // 通过事件记录日志
    event.emit('log:info', { message: 'Info message', meta: { level: 'info' } });
    event.emit('log:warn', { message: 'Warning message', meta: { level: 'warn' } });
    event.emit('log:error', { message: 'Error message', meta: { level: 'error' } });

    // 由于 logger 级别是 warn，info 不应该输出
    expect(spyLog).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledTimes(1);
    expect(spyError).toHaveBeenCalledTimes(1);

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });
});