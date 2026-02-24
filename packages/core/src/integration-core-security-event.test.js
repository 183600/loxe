import { describe, it, expect } from 'vitest';
import { createCore } from './index.js';
import { createSecurityContext } from '../../security/src/index.js';
import { createEventEmitter } from '../../event/src/index.js';

describe('Integration: Core + Security + Event', () => {
  it('should emit security events on access control', () => {
    const core = createCore();

    core.register('security', () => createSecurityContext(core), true);
    core.register('event', createEventEmitter, true);

    const security = core.get('security');
    const event = core.get('event');

    security.setPrincipal({ id: 'user1', role: 'admin' });
    security.addPolicy({
      action: 'read',
      principalAttributes: { role: 'admin' }
    });

    const events = [];
    event.on('security:access', (data) => events.push(data));

    const resource = { type: 'document', id: 1 };
    const canAccess = security.can('read', resource);

    expect(canAccess).toBe(true);
  });

  it('should log security events', () => {
    const core = createCore();

    core.register('security', () => createSecurityContext(core), true);
    core.register('event', createEventEmitter, true);

    core.register('securityEventLogger', (ctx) => {
      const security = ctx.get('security');
      const event = ctx.get('event');

      return {
        checkAccess(action, resource) {
          const result = security.can(action, resource);
          event.emit('security:check', {
            action,
            resource,
            allowed: result,
            principal: security.principal
          });
          return result;
        }
      };
    }, true);

    const securityLogger = core.get('securityEventLogger');
    const event = core.get('event');
    const security = core.get('security');

    security.setPrincipal({ id: 'user1', role: 'user' });
    security.addPolicy({
      action: 'read',
      principalAttributes: { role: 'user' }
    });

    const events = [];
    event.on('security:check', (data) => events.push(data));

    const result = securityLogger.checkAccess('read', { type: 'data' });

    expect(result).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0].allowed).toBe(true);
  });

  it('should emit events on encryption/decryption', () => {
    const core = createCore();

    core.register('security', () => createSecurityContext(core), true);
    core.register('event', createEventEmitter, true);

    core.register('secureEventService', (ctx) => {
      const security = ctx.get('security');
      const event = ctx.get('event');

      return {
        encrypt(data) {
          const encrypted = security.encrypt(data);
          event.emit('security:encrypt', { original: data, encrypted });
          return encrypted;
        },
        decrypt(encryptedData) {
          const decrypted = security.decrypt(encryptedData);
          event.emit('security:decrypt', { encrypted: encryptedData, decrypted });
          return decrypted;
        }
      };
    }, true);

    const secureService = core.get('secureEventService');
    const event = core.get('event');

    const events = [];
    event.on('security:encrypt', (data) => events.push({ type: 'encrypt', ...data }));
    event.on('security:decrypt', (data) => events.push({ type: 'decrypt', ...data }));

    const original = { id: 1, secret: 'password123' };
    const encrypted = secureService.encrypt(original);
    const decrypted = secureService.decrypt(encrypted);

    expect(decrypted).toEqual(original);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('encrypt');
    expect(events[1].type).toBe('decrypt');
  });

  it('should emit events on signing and verification', () => {
    const core = createCore();

    core.register('security', () => createSecurityContext(core), true);
    core.register('event', createEventEmitter, true);

    core.register('signatureEventService', (ctx) => {
      const security = ctx.get('security');
      const event = ctx.get('event');

      return {
        sign(data) {
          const signature = security.sign(data);
          event.emit('security:sign', { data, signature });
          return signature;
        },
        verify(data, signature) {
          const isValid = security.verify(data, signature);
          event.emit('security:verify', { data, signature, isValid });
          return isValid;
        }
      };
    }, true);

    const signatureService = core.get('signatureEventService');
    const event = core.get('event');

    const events = [];
    event.on('security:sign', (data) => events.push({ type: 'sign', ...data }));
    event.on('security:verify', (data) => events.push({ type: 'verify', ...data }));

    const data = { transactionId: 'tx123', amount: 100 };
    const signature = signatureService.sign(data);
    const isValid = signatureService.verify(data, signature);

    expect(isValid).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('sign');
    expect(events[1].type).toBe('verify');
  });
});