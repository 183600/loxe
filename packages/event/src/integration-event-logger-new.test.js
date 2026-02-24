import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createEventEmitter } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Event + Logger', () => {
  let events;
  let logger;
  let logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    events = createEventEmitter();
    logger = createLogger(undefined, { level: 'info' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log event emissions', () => {
    const eventLog = [];
    
    events.on('test:event', (data) => {
      eventLog.push(data);
      logger.info('Event received', { event: 'test:event', data });
    });

    events.emit('test:event', { message: 'Hello' });

    expect(eventLog).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should log event errors', () => {
    const errorLog = [];
    
    events.on('error:event', (data) => {
      errorLog.push(data);
      logger.error('Event error', { event: 'error:event', data });
    });

    events.emit('error:event', { error: 'Something went wrong' });

    expect(errorLog).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should support event logging with metadata', () => {
    const eventLog = [];
    
    events.on('user:action', (data) => {
      eventLog.push(data);
      logger.info('User action logged', { 
        userId: data.userId, 
        action: data.action.action,
        timestamp: data.timestamp 
      });
    });

    events.emit('user:action', { 
      userId: 123, 
      action: { action: 'login' },
      timestamp: Date.now()
    });

    expect(eventLog).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should support debug logging for event system', () => {
    logger.setLevel('debug');
    
    const eventLog = [];
    
    events.on('debug:event', (data) => {
      eventLog.push(data);
      logger.debug('Debug event', { event: 'debug:event', data });
    });

    events.emit('debug:event', { debugInfo: 'test' });

    expect(eventLog).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should log event listener registration', () => {
    logger.info('Registering event listener', { event: 'api:request' });
    
    const listener = (data) => {
      logger.info('API request processed', { url: data.url });
    };

    events.on('api:request', listener);
    events.emit('api:request', { url: '/api/users' });

    expect(logSpy).toHaveBeenCalled();
  });

  it('should log event listener removal', () => {
    const listener = (data) => {
      logger.info('Event handled', { data });
    };

    events.on('temp:event', listener);
    logger.info('Event listener registered', { event: 'temp:event' });

    events.off('temp:event', listener);
    logger.info('Event listener removed', { event: 'temp:event' });

    expect(logSpy).toHaveBeenCalled();
  });
});