import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Logger + Event Integration', () => {
  it('should log event emissions', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Event' });
    const event = createEventEmitter();

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    event.on('test', (data) => {
      logger.info(`Event received: ${data}`);
    });

    event.emit('test', 'hello');

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Event received: hello');
    expect(output).toContain('[Event]');

    spy.mockRestore();
  });

  it('should emit log events for monitoring', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'App' });
    const event = createEventEmitter();

    const logEvents = [];

    // 拦截 console.log 来发射事件
    const originalLog = console.log;
    console.log = (...args) => {
      event.emit('log', { level: 'info', message: args[0], timestamp: Date.now() });
      originalLog.apply(console, args);
    };

    event.on('log', (data) => {
      logEvents.push(data);
    });

    logger.info('test message');

    console.log = originalLog;

    expect(logEvents).toHaveLength(1);
    expect(logEvents[0].level).toBe('info');
    expect(logEvents[0].message).toContain('test message');
  });

  it('should create an event-driven logger service', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'Service' });
    const event = createEventEmitter();

    const eventLogger = {
      logEvent(eventName, data) {
        logger.info(`Event: ${eventName}`, data);
        event.emit('logged', { eventName, data, timestamp: Date.now() });
      },
      onLogged: (callback) => event.on('logged', callback)
    };

    const loggedEvents = [];
    eventLogger.onLogged((data) => loggedEvents.push(data));

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();
    eventLogger.logEvent('user:login', { userId: 123 });

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Event: user:login');

    expect(loggedEvents).toHaveLength(1);
    expect(loggedEvents[0].eventName).toBe('user:login');
    expect(loggedEvents[0].data).toEqual({ userId: 123 });

    spy.mockRestore();
  });

  it('should handle error events with logger', () => {
    const logger = createLogger(null, { level: 'error', prefix: 'Error' });
    const event = createEventEmitter();

    const spy = vi.spyOn(console, 'error');
    spy.mockClear();

    event.on('error', (error) => {
      logger.error(`Error occurred: ${error.message}`, { stack: error.stack });
    });

    const testError = new Error('Test error');
    event.emit('error', testError);

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Error occurred: Test error');
    expect(output).toContain('[Error]');

    spy.mockRestore();
  });

  it('should support log level changes via events', () => {
    const logger = createLogger(null, { level: 'info', prefix: 'App' });
    const event = createEventEmitter();

    event.on('setLogLevel', (level) => {
      logger.setLevel(level);
    });

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    logger.info('before change');
    expect(spy).toHaveBeenCalledTimes(1);

    event.emit('setLogLevel', 'error');

    logger.info('after change');
    expect(spy).toHaveBeenCalledTimes(1); // Still 1, not 2

    spy.mockRestore();
  });
});