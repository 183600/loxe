import { describe, it, expect } from 'vitest';
import { createSecurityContext } from './index.js';

describe('SecurityContext', () => {
  it('should return false when no principal is set', () => {
    const ctx = {};
    const security = createSecurityContext(ctx);
    
    expect(security.can('read', { id: 1 })).toBe(false);
  });

  it('should allow actions that match policies', () => {
    const ctx = {};
    const security = createSecurityContext(ctx);
    
    // Set up a principal
    security.setPrincipal({
      id: 'user1',
      role: 'admin',
      department: 'engineering'
    });
    
    // Add a policy that allows admins to read documents
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'admin'
      }
    });
    
    // Test the policy
    expect(security.can('read', { type: 'document' })).toBe(true);
    expect(security.can('write', { type: 'document' })).toBe(false);
  });

  it('should check resource attributes', () => {
    const ctx = {};
    const security = createSecurityContext(ctx);
    
    security.setPrincipal({
      id: 'user1',
      role: 'user'
    });
    
    // Policy that allows users to read their own documents
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        ownerId: 'user1'
      }
    });
    
    expect(security.can('read', { type: 'document', ownerId: 'user1' })).toBe(true);
    expect(security.can('read', { type: 'document', ownerId: 'user2' })).toBe(false);
  });

  it('should check environment attributes', () => {
    const ctx = {};
    const security = createSecurityContext(ctx);
    
    security.setPrincipal({
      id: 'user1',
      role: 'user'
    });
    
    // Policy that allows actions during business hours
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      },
      environmentAttributes: {
        timeOfDay: 'business'
      }
    });
    
    expect(security.can('read', { type: 'document' }, { timeOfDay: 'business' })).toBe(true);
    expect(security.can('read', { type: 'document' }, { timeOfDay: 'after-hours' })).toBe(false);
  });

  it('should allow multiple policies', () => {
    const ctx = {};
    const security = createSecurityContext(ctx);
    
    security.setPrincipal({
      id: 'user1',
      role: 'manager'
    });
    
    // Policy 1: Managers can approve expenses
    security.addPolicy({
      action: 'approve',
      principalAttributes: {
        role: 'manager'
      }
    });
    
    // Policy 2: Anyone can read public documents
    security.addPolicy({
      action: 'read',
      resourceAttributes: {
        visibility: 'public'
      }
    });
    
    expect(security.can('approve', { type: 'expense' })).toBe(true);
    expect(security.can('read', { type: 'document', visibility: 'public' })).toBe(true);
    expect(security.can('delete', { type: 'document' })).toBe(false);
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt string data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const originalData = 'Hello, World!';
      const encrypted = security.encrypt(originalData);
      const decrypted = security.decrypt(encrypted);
      
      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });

    it('should encrypt and decrypt object data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const originalData = { message: 'Hello', id: 123 };
      const encrypted = security.encrypt(originalData);
      const decrypted = security.decrypt(encrypted);
      
      expect(encrypted).not.toBe(JSON.stringify(originalData));
      expect(decrypted).toEqual(originalData);
    });

    it('should handle decrypt errors', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      expect(() => {
        security.decrypt('invalid-base64!');
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('sign/verify', () => {
    it('should sign and verify string data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const data = 'Hello, World!';
      const signature = security.sign(data);
      const isValid = security.verify(data, signature);
      
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature).toContain(':');
      expect(isValid).toBe(true);
    });

    it('should sign and verify object data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const data = { message: 'Hello', id: 123 };
      const signature = security.sign(data);
      const isValid = security.verify(data, signature);
      
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature).toContain(':');
      expect(isValid).toBe(true);
    });

    it('should fail verification for modified data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const originalData = 'Hello, World!';
      const modifiedData = 'Hello, Modified!';
      const signature = security.sign(originalData);
      const isValid = security.verify(modifiedData, signature);
      
      expect(isValid).toBe(false);
    });

    it('should fail verification for invalid signature format', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const data = 'Hello, World!';
      const invalidSignature = 'invalid-signature';
      const isValid = security.verify(data, invalidSignature);
      
      expect(isValid).toBe(false);
    });

    it('should fail verification for empty signature', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const data = 'Hello, World!';
      const emptySignature = '';
      const isValid = security.verify(data, emptySignature);
      
      expect(isValid).toBe(false);
    });

    it('should generate different signatures for different data', () => {
      const ctx = {};
      const security = createSecurityContext(ctx);
      
      const data1 = 'Hello, World!';
      const data2 = 'Goodbye, World!';
      const signature1 = security.sign(data1);
      const signature2 = security.sign(data2);
      
      expect(signature1).not.toBe(signature2);
    });
  });
});