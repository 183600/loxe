import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Core + Event + Logger', () => {
  let core;
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    core = createCore();

    core.register('events', () => createEventEmitter(), true);
    core.register('logger', () => createLogger(undefined, { level: 'info', prefix: 'App' }), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should provide both event and logger services through core', () => {
    const events = core.get('events');
    const logger = core.get('logger');

    expect(events).toBeDefined();
    expect(logger).toBeDefined();
    expect(typeof events.on).toBe('function');
    expect(typeof logger.info).toBe('function');
  });

  it('should log events when they are emitted', () => {
    const events = core.get('events');
    const logger = core.get('logger');

    events.on('test:event', (data) => {
      logger.info('Event emitted', { event: 'test:event', data });
    });

    events.emit('test:event', { message: 'Hello' });

    expect(logSpy).toHaveBeenCalled();
  });

  it('should support service that uses both events and logger', () => {
    core.register('dataService', (ctx) => {
      const events = ctx.get('events');
      const logger = ctx.get('logger');

      return {
        saveData: (data) => {
          logger.info('Saving data', { id: data.id });
          events.emit('data:saved', { id: data.id, timestamp: Date.now() });
          return { success: true };
        }
      };
    }, true);

    const dataService = core.get('dataService');
    const result = dataService.saveData({ id: 1, name: 'Test' });

    expect(result.success).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should handle event errors with logging', () => {
    const events = core.get('events');
    const logger = core.get('logger');

    events.on('error:event', (data) => {
      logger.error('Error occurred', { error: data.error });
    });

    events.emit('error:event', { error: 'Something went wrong' });

    expect(errorSpy).toHaveBeenCalled();
  });

  it('should support event-driven logging', () => {
    const events = core.get('events');
    const logger = core.get('logger');

    events.on('log:*', (event, data) => {
      const level = event.split(':')[1];
      if (logger[level]) {
        logger[level](data.message, data.meta);
      }
    });

    events.emit('log:info', { message: 'Info message', meta: { key: 'value' } });
    events.emit('log:warn', { message: 'Warning message', meta: { key: 'value' } });

    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should support logging event listener lifecycle', () => {
    const events = core.get('events');
    const logger = core.get('logger');

    logger.info('Registering event listener', { event: 'user:action' });

    const listener = (data) => {
      logger.info('User action handled', { action: data.action });
    };

    events.on('user:action', listener);
    events.emit('user:action', { action: 'login' });

    logger.info('Removing event listener', { event: 'user:action' });
    events.off('user:action', listener);

    expect(logSpy).toHaveBeenCalled();
  });

  it('should support multiple services with event and logger dependencies', () => {
    core.register('userService', (ctx) => {
      const events = ctx.get('events');
      const logger = ctx.get('logger');

      return {
        login: (username) => {
          logger.info('User login attempt', { username });
          events.emit('user:login', { username, timestamp: Date.now() });
          return { success: true, username };
        }
      };
    }, true);

    core.register('auditService', (ctx) => {
      const events = ctx.get('events');
      const logger = ctx.get('logger');

      events.on('user:login', (data) => {
        logger.info('Audit log: user login', { username: data.username });
      });

      return { name: 'auditService' };
    }, true);

    const userService = core.get('userService');
    const result = userService.login('testuser');

    expect(result.success).toBe(true);
    expect(logSpy).toHaveBeenCalled();
  });
});