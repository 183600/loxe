import { describe, it, expect, vi } from 'vitest';
import { createCore } from './index.js';
import { createEventEmitter } from '../../event/src/index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Core + Event + Logger', () => {
  it('should log event emissions', () => {
    const core = createCore();

    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'info' }), true);

    const event = core.get('event');
    const logger = core.get('logger');

    const spy = vi.spyOn(console, 'log');

    event.on('test', (data) => {
      logger.info('Event received', { event: 'test', data });
    });

    event.emit('test', { message: 'Hello' });

    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0][0]).toContain('Event received');
  });

  it('should create an event logger service', () => {
    const core = createCore();

    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'info' }), true);

    core.register('eventLogger', (ctx) => {
      const event = ctx.get('event');
      const logger = ctx.get('logger');

      return {
        emit(eventName, data) {
          logger.info('Event emitted', { event: eventName, data });
          event.emit(eventName, data);
        },
        on(eventName, callback) {
          logger.info('Listener registered', { event: eventName });
          return event.on(eventName, callback);
        }
      };
    }, true);

    const eventLogger = core.get('eventLogger');
    const spy = vi.spyOn(console, 'log');

    const results = [];
    eventLogger.on('test', (data) => results.push(data));
    eventLogger.emit('test', { value: 42 });

    expect(results).toEqual([{ value: 42 }]);
    expect(spy).toHaveBeenCalled();
  });

  it('should log errors from event handlers', () => {
    const core = createCore();

    core.register('event', createEventEmitter, true);
    core.register('logger', () => createLogger(null, { level: 'error' }), true);

    const event = core.get('event');
    const logger = core.get('logger');

    const spy = vi.spyOn(console, 'error');

    event.on('error', (data) => {
      throw new Error('Handler error');
    });

    expect(() => event.emit('error', {})).toThrow();
  });
});
