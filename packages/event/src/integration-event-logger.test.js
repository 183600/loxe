import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createEventEmitter } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Event and Logger Integration', () => {
  let emitter;
  let logger;
  let consoleSpy;

  beforeEach(() => {
    emitter = createEventEmitter();
    logger = createLogger(null, { level: 'info' });
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log events as they occur', () => {
    emitter.on('user:login', (user) => {
      logger.info('User logged in', { userId: user.id, username: user.name });
    });

    emitter.emit('user:login', { id: 1, name: 'Alice' });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('User logged in');
    expect(logOutput).toContain('userId');
    expect(logOutput).toContain('1');
  });

  it('should log errors from event handlers', () => {
    emitter.on('data:process', (data) => {
      try {
        if (!data.valid) {
          throw new Error('Invalid data');
        }
        logger.info('Data processed successfully');
      } catch (error) {
        logger.error('Data processing failed', { error: error.message });
      }
    });

    emitter.emit('data:process', { valid: false });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('Data processing failed');
  });

  it('should create an event logger middleware', () => {
    const eventLogger = (eventName) => {
      return (data) => {
        logger.info(`Event: ${eventName}`, data);
      };
    };

    emitter.on('request:start', eventLogger('request:start'));
    emitter.on('request:end', eventLogger('request:end'));

    emitter.emit('request:start', { url: '/api/users', method: 'GET' });
    emitter.emit('request:end', { url: '/api/users', status: 200 });

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('Event: request:start');
    expect(consoleSpy.mock.calls[1][0]).toContain('Event: request:end');
  });

  it('should log event statistics', () => {
    const eventCounts = new Map();

    emitter.on('count:*', (event, data) => {
      const eventName = event.split(':')[1];
      eventCounts.set(eventName, (eventCounts.get(eventName) || 0) + 1);
      logger.info(`${eventName} event occurred`, { count: eventCounts.get(eventName) });
    });

    emitter.emit('count:click', { button: 'submit' });
    emitter.emit('count:click', { button: 'cancel' });
    emitter.emit('count:scroll', { position: 100 });

    expect(eventCounts.get('click')).toBe(2);
    expect(eventCounts.get('scroll')).toBe(1);
    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });

  it('should handle event-driven logging with levels', () => {
    const debugLogger = createLogger(null, { level: 'debug', prefix: 'DEBUG' });
    const warnLogger = createLogger(null, { level: 'warn', prefix: 'WARN' });

    emitter.on('debug:event', (data) => {
      debugLogger.debug('Debug event', data);
    });

    emitter.on('warn:event', (data) => {
      warnLogger.warn('Warning event', data);
    });

    emitter.emit('debug:event', { detail: 'some debug info' });
    emitter.emit('warn:event', { detail: 'some warning' });

    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it('should create an audit logger for critical events', () => {
    const auditLogger = createLogger(null, { level: 'info', prefix: 'AUDIT' });

    const auditEvents = ['user:login', 'user:logout', 'data:delete'];

    auditEvents.forEach(eventName => {
      emitter.on(eventName, (data) => {
        auditLogger.info(`Audit: ${eventName}`, data);
      });
    });

    emitter.emit('user:login', { userId: 1, ip: '192.168.1.1' });
    emitter.emit('data:delete', { resourceId: 100, deletedBy: 1 });

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('AUDIT');
    expect(consoleSpy.mock.calls[0][0]).toContain('user:login');
  });

  it('should log event handler performance', () => {
    emitter.on('heavy:task', (data) => {
      const start = Date.now();
      
      // 模拟耗时操作
      for (let i = 0; i < 1000; i++) {}
      
      const duration = Date.now() - start;
      logger.info('Task completed', { duration: `${duration}ms`, taskId: data.id });
    });

    emitter.emit('heavy:task', { id: 'task-1' });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('Task completed');
    expect(logOutput).toContain('duration');
  });

  it('should handle event errors with logging', () => {
    const errorLogger = createLogger(null, { level: 'error', prefix: 'ERROR' });

    emitter.on('risky:operation', (data) => {
      try {
        if (data.shouldFail) {
          throw new Error('Operation failed');
        }
        logger.info('Operation succeeded');
      } catch (error) {
        errorLogger.error('Operation error', { 
          error: error.message,
          context: data.context 
        });
      }
    });

    emitter.emit('risky:operation', { shouldFail: true, context: { attempt: 1 } });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('ERROR');
    expect(logOutput).toContain('Operation error');
  });

  it('should create event flow logger', () => {
    const flowLogger = createLogger(null, { level: 'info', prefix: 'FLOW' });

    emitter.on('step:1', (data) => {
      flowLogger.info('Step 1 started', data);
      emitter.emit('step:2', { ...data, step1Complete: true });
    });

    emitter.on('step:2', (data) => {
      flowLogger.info('Step 2 started', data);
      emitter.emit('step:3', { ...data, step2Complete: true });
    });

    emitter.on('step:3', (data) => {
      flowLogger.info('Step 3 started', data);
    });

    emitter.emit('step:1', { flowId: 'flow-123' });

    expect(consoleSpy).toHaveBeenCalledTimes(3);
    expect(consoleSpy.mock.calls[0][0]).toContain('Step 1 started');
    expect(consoleSpy.mock.calls[1][0]).toContain('Step 2 started');
    expect(consoleSpy.mock.calls[2][0]).toContain('Step 3 started');
  });

  it('should log event listener registration', () => {
    const registrationLogger = createLogger(null, { level: 'debug', prefix: 'REGISTRY' });

    const trackedEmitter = {
      listeners: new Map(),
      
      on(event, callback) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        registrationLogger.debug(`Listener registered for event: ${event}`);
        return () => this.off(event, callback);
      },
      
      off(event, callback) {
        if (this.listeners.has(event)) {
          this.listeners.get(event).delete(callback);
          registrationLogger.debug(`Listener removed from event: ${event}`);
        }
      },
      
      emit(event, data) {
        if (this.listeners.has(event)) {
          for (const callback of this.listeners.get(event)) {
            callback(data);
          }
        }
      }
    };

    const unsubscribe = trackedEmitter.on('test:event', () => {});
    trackedEmitter.emit('test:event', {});
    unsubscribe();

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy.mock.calls[0][0]).toContain('Listener registered');
    expect(consoleSpy.mock.calls[1][0]).toContain('Listener removed');
  });
});