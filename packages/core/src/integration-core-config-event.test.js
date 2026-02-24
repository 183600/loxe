import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Core + Config + Event Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should integrate core with config and event emitter', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ appName: 'TestApp' }), true);
    core.register('event', createEventEmitter, true);
    
    const config = core.get('config');
    const event = core.get('event');
    
    expect(config.get('appName')).toBe('TestApp');
    
    let received = null;
    event.on('test', (data) => { received = data; });
    event.emit('test', 'hello');
    
    expect(received).toBe('hello');
  });

  it('should use config to control event behavior', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      enableEvents: true,
      maxListeners: 10
    }), true);
    
    core.register('event', createEventEmitter, true);
    
    const config = core.get('config');
    const event = core.get('event');
    
    const results = [];
    event.on('test', (data) => {
      if (config.get('enableEvents')) {
        results.push(data);
      }
    });
    
    event.emit('test', 'message1');
    expect(results).toEqual(['message1']);
    
    config.set('enableEvents', false);
    event.emit('test', 'message2');
    expect(results).toEqual(['message1']);
  });

  it('should emit config change events', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ value: 1 }), true);
    core.register('event', createEventEmitter, true);
    
    const config = core.get('config');
    const event = core.get('event');
    
    const changes = [];
    event.on('config:change', (data) => { changes.push(data); });
    
    config.set('value', 2);
    event.emit('config:change', { key: 'value', oldValue: 1, newValue: 2 });
    
    config.set('value', 3);
    event.emit('config:change', { key: 'value', oldValue: 2, newValue: 3 });
    
    expect(changes).toHaveLength(2);
    expect(changes[0]).toEqual({ key: 'value', oldValue: 1, newValue: 2 });
    expect(changes[1]).toEqual({ key: 'value', oldValue: 2, newValue: 3 });
  });

  it('should create a configurable event service', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      eventPrefix: 'app',
      enableDebug: false
    }), true);
    
    core.register('event', createEventEmitter, true);
    
    core.register('configurableEvent', (ctx) => {
      const config = ctx.get('config');
      const event = ctx.get('event');
      
      return {
        emit(eventName, data) {
          const prefix = config.get('eventPrefix');
          const fullEventName = prefix ? `${prefix}:${eventName}` : eventName;
          
          if (config.get('enableDebug')) {
            console.log(`Emitting: ${fullEventName}`, data);
          }
          
          event.emit(fullEventName, data);
        },
        on(eventName, callback) {
          const prefix = config.get('eventPrefix');
          const fullEventName = prefix ? `${prefix}:${eventName}` : eventName;
          return event.on(fullEventName, callback);
        }
      };
    }, true);
    
    const service = core.get('configurableEvent');
    const results = [];
    
    service.on('test', (data) => results.push(data));
    service.emit('test', 'hello');
    
    expect(results).toEqual(['hello']);
  });

  it('should handle config-based event filtering', () => {
    const core = createCore();
    
    core.register('config', () => createConfig({ 
      allowedEvents: ['user:login', 'user:logout']
    }), true);
    
    core.register('event', createEventEmitter, true);
    
    core.register('filteredEvent', (ctx) => {
      const config = ctx.get('config');
      const event = ctx.get('event');
      const allowedEvents = config.get('allowedEvents');
      
      return {
        emit(eventName, ...args) {
          if (allowedEvents.includes(eventName)) {
            event.emit(eventName, ...args);
          }
        },
        on: event.on.bind(event)
      };
    }, true);
    
    const service = core.get('filteredEvent');
    const results = [];
    
    service.on('user:login', (data) => results.push('login:' + data));
    service.on('user:logout', (data) => results.push('logout:' + data));
    service.on('user:update', (data) => results.push('update:' + data));
    
    service.emit('user:login', 'user1');
    service.emit('user:logout', 'user1');
    service.emit('user:update', 'user1');
    
    expect(results).toEqual(['login:user1', 'logout:user1']);
  });
});
