import { describe, it, expect, beforeEach } from 'vitest';
import { createEventEmitter } from './index.js';

describe('Event Wildcard Matching Tests', () => {
  let events;

  beforeEach(() => {
    events = createEventEmitter();
  });

  it('should match events with single wildcard at end', () => {
    const matched = [];
    
    events.on('user:*', (event, data) => {
      matched.push({ event, data });
    });

    events.emit('user:login', { username: 'alice' });
    events.emit('user:logout', { username: 'alice' });
    events.emit('user:update', { username: 'alice' });

    expect(matched).toHaveLength(3);
    expect(matched[0].event).toBe('user:login');
    expect(matched[1].event).toBe('user:logout');
    expect(matched[2].event).toBe('user:update');
  });

  it('should not match events that do not fit wildcard pattern', () => {
    const matched = [];
    
    events.on('user:*', (event, data) => {
      matched.push(event);
    });

    events.emit('user:login', {});
    events.emit('admin:login', {});
    events.emit('system:startup', {});

    expect(matched).toHaveLength(1);
    expect(matched[0]).toBe('user:login');
  });

  it('should support multiple wildcard patterns', () => {
    const userEvents = [];
    const adminEvents = [];
    
    events.on('user:*', (event, data) => {
      userEvents.push(event);
    });

    events.on('admin:*', (event, data) => {
      adminEvents.push(event);
    });

    events.emit('user:login', {});
    events.emit('admin:login', {});
    events.emit('user:logout', {});

    expect(userEvents).toHaveLength(2);
    expect(adminEvents).toHaveLength(1);
  });

  it('should match both exact and wildcard listeners', () => {
    const exactMatches = [];
    const wildcardMatches = [];
    
    events.on('user:login', (data) => {
      exactMatches.push(data);
    });

    events.on('user:*', (event, data) => {
      wildcardMatches.push({ event, data });
    });

    events.emit('user:login', { username: 'alice' });

    expect(exactMatches).toHaveLength(1);
    expect(wildcardMatches).toHaveLength(1);
    expect(wildcardMatches[0].event).toBe('user:login');
  });

  it('should handle wildcard with multiple colons', () => {
    const matched = [];
    
    events.on('api:*:*', (event, data) => {
      matched.push(event);
    });

    events.emit('api:v1:users', {});
    events.emit('api:v1:posts', {});
    events.emit('api:v2:users', {});
    events.emit('api:users', {});

    expect(matched).toHaveLength(3);
    expect(matched).toContain('api:v1:users');
    expect(matched).toContain('api:v1:posts');
    expect(matched).toContain('api:v2:users');
  });

  it('should handle wildcard at different positions', () => {
    const matched = [];
    
    events.on('*:error', (event, data) => {
      matched.push(event);
    });

    events.emit('user:error', {});
    events.emit('system:error', {});
    events.emit('network:error', {});
    events.emit('user:success', {});

    expect(matched).toHaveLength(3);
    expect(matched).toContain('user:error');
    expect(matched).toContain('system:error');
    expect(matched).toContain('network:error');
  });

  it('should handle multiple wildcards in pattern', () => {
    const matched = [];
    
    events.on('*:*', (event, data) => {
      matched.push(event);
    });

    events.emit('a:b', {});
    events.emit('x:y', {});
    events.emit('1:2', {});

    expect(matched).toHaveLength(3);
  });

  it('should handle wildcard with very long event names', () => {
    const matched = [];
    
    events.on('very:long:event:name:*', (event, data) => {
      matched.push(event);
    });

    events.emit('very:long:event:name:action1', {});
    events.emit('very:long:event:name:action2', {});

    expect(matched).toHaveLength(2);
  });

  it('should handle wildcard with special characters', () => {
    const matched = [];
    
    events.on('event:*', (event, data) => {
      matched.push(event);
    });

    events.emit('event:action-1', {});
    events.emit('event:action_2', {});
    events.emit('event:action.3', {});

    expect(matched).toHaveLength(3);
  });

  it('should handle wildcard with numeric event names', () => {
    const matched = [];
    
    events.on('status:*', (event, data) => {
      matched.push(event);
    });

    events.emit('status:200', {});
    events.emit('status:404', {});
    events.emit('status:500', {});

    expect(matched).toHaveLength(3);
  });

  it('should handle wildcard with empty suffix', () => {
    const matched = [];
    
    events.on('event:*', (event, data) => {
      matched.push(event);
    });

    events.emit('event:', {});

    expect(matched).toHaveLength(1);
    expect(matched[0]).toBe('event:');
  });

  it('should handle wildcard listener removal', () => {
    const matched = [];
    
    const listener = (event, data) => {
      matched.push(event);
    };

    events.on('user:*', listener);
    events.emit('user:login', {});
    
    events.off('user:*', listener);
    events.emit('user:logout', {});

    expect(matched).toHaveLength(1);
  });

  it('should handle wildcard with once', () => {
    const matched = [];
    
    events.once('user:*', (event, data) => {
      matched.push(event);
    });

    events.emit('user:login', {});
    events.emit('user:logout', {});

    expect(matched).toHaveLength(1);
  });

  it('should handle removeAllListeners with wildcard pattern', () => {
    const matched = [];
    
    events.on('user:*', (event, data) => {
      matched.push(event);
    });

    events.emit('user:login', {});
    events.removeAllListeners('user:*');
    events.emit('user:logout', {});

    expect(matched).toHaveLength(1);
  });

  it('should handle wildcard pattern with no matches', () => {
    const matched = [];
    
    events.on('nonexistent:*', (event, data) => {
      matched.push(event);
    });

    events.emit('user:login', {});
    events.emit('system:startup', {});

    expect(matched).toHaveLength(0);
  });

  it('should handle wildcard listener throwing errors', () => {
    const matched = [];
    const errors = [];
    
    events.on('user:*', (event, data) => {
      matched.push(event);
      if (event === 'user:error') {
        throw new Error('Test error');
      }
    });

    events.emit('user:login', {});
    
    expect(() => {
      events.emit('user:error', {});
    }).toThrow('Test error');

    expect(matched).toHaveLength(2);
  });
});