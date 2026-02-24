import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createCore } from '../../core/src/index.js';
import { createSecurityContext } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Integration: Security + Storage', () => {
  let core;
  let security;
  let storage;

  beforeEach(async () => {
    core = createCore();
    security = createSecurityContext();
    storage = createStorage('memory');
    await storage.open();
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should encrypt data before storing', async () => {
    const sensitiveData = {
      id: 'user-1',
      name: 'John Doe',
      ssn: '123-45-6789',
      creditCard: '4111-1111-1111-1111'
    };

    // Encrypt sensitive data
    const encrypted = security.encrypt(sensitiveData);
    expect(encrypted).not.toEqual(JSON.stringify(sensitiveData));

    // Store encrypted data
    await storage.put(`user:${sensitiveData.id}`, encrypted);

    // Retrieve encrypted data
    const retrievedEncrypted = await storage.get(`user:${sensitiveData.id}`);
    expect(retrievedEncrypted).toBe(encrypted);

    // Decrypt retrieved data
    const decrypted = security.decrypt(retrievedEncrypted);
    expect(decrypted).toEqual(sensitiveData);
  });

  it('should encrypt and decrypt string data in storage', async () => {
    const secretMessage = 'This is a secret message';

    // Encrypt
    const encrypted = security.encrypt(secretMessage);
    await storage.put('secret', encrypted);

    // Retrieve and decrypt
    const retrieved = await storage.get('secret');
    const decrypted = security.decrypt(retrieved);

    expect(decrypted).toBe(secretMessage);
  });

  it('should sign data before storing for integrity verification', async () => {
    const userData = {
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com'
    };

    // Sign the data
    const signature = security.sign(userData);
    expect(signature).toBeTruthy();

    // Store data with signature
    await storage.put(`user:${userData.id}`, userData);
    await storage.put(`user:${userData.id}:signature`, signature);

    // Retrieve and verify
    const retrievedData = await storage.get(`user:${userData.id}`);
    const retrievedSignature = await storage.get(`user:${userData.id}:signature`);

    const isValid = security.verify(retrievedData, retrievedSignature);
    expect(isValid).toBe(true);
  });

  it('should detect tampered data using signatures', async () => {
    const originalData = {
      id: 'doc-1',
      content: 'Important document content'
    };

    // Sign and store
    const signature = security.sign(originalData);
    await storage.put(`doc:${originalData.id}`, originalData);
    await storage.put(`doc:${originalData.id}:signature`, signature);

    // Retrieve and tamper with data
    const tamperedData = {
      id: 'doc-1',
      content: 'Tampered content!'
    };

    // Verify with original signature
    const isValid = security.verify(tamperedData, signature);
    expect(isValid).toBe(false);
  });

  it('should use security policies to control storage access', async () => {
    // Set up security context with principal
    security.setPrincipal({
      id: 'user-1',
      role: 'admin',
      department: 'engineering'
    });

    // Add policy for admin write access
    security.addPolicy({
      action: 'write',
      principalAttributes: {
        role: 'admin'
      }
    });

    // Check if user can write
    const canWrite = security.can('write', { type: 'document' });
    expect(canWrite).toBe(true);

    // Store data if authorized
    if (canWrite) {
      const document = { id: 'doc-1', content: 'Secret document' };
      await storage.put(`doc:${document.id}`, document);
      const retrieved = await storage.get(`doc:${document.id}`);
      expect(retrieved).toEqual(document);
    }
  });

  it('should restrict storage access based on resource ownership', async () => {
    // Set up user principal
    security.setPrincipal({
      id: 'user-1',
      role: 'user'
    });

    // Policy: users can only read their own documents
    security.addPolicy({
      action: 'read',
      principalAttributes: {
        role: 'user'
      },
      resourceAttributes: {
        ownerId: 'user-1'
      }
    });

    // Store documents
    const ownDoc = { id: 'doc-1', ownerId: 'user-1', content: 'My document' };
    const otherDoc = { id: 'doc-2', ownerId: 'user-2', content: 'Other document' };

    await storage.put(`doc:${ownDoc.id}`, ownDoc);
    await storage.put(`doc:${otherDoc.id}`, otherDoc);

    // Check access
    const canReadOwn = security.can('read', ownDoc);
    const canReadOther = security.can('read', otherDoc);

    expect(canReadOwn).toBe(true);
    expect(canReadOther).toBe(false);
  });

  it('should encrypt data in storage transactions', async () => {
    const sensitiveRecords = [
      { id: 'rec-1', data: 'Secret 1' },
      { id: 'rec-2', data: 'Secret 2' },
      { id: 'rec-3', data: 'Secret 3' }
    ];

    // Start transaction
    const tx = await storage.tx();

    // Encrypt and store in transaction
    for (const record of sensitiveRecords) {
      const encrypted = security.encrypt(record);
      await tx.put(`record:${record.id}`, encrypted);
    }

    await tx.commit();

    // Verify all records
    for (const record of sensitiveRecords) {
      const encrypted = await storage.get(`record:${record.id}`);
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toEqual(record);
    }
  });

  it('should handle encryption errors gracefully', async () => {
    const validData = { id: 'test', value: 'data' };
    const encrypted = security.encrypt(validData);

    // Store valid encrypted data
    await storage.put('valid', encrypted);

    // Try to store invalid data (not encrypted)
    const invalidData = 'not-encrypted';
    await storage.put('invalid', invalidData);

    // Valid data should decrypt successfully
    const retrievedValid = await storage.get('valid');
    const decryptedValid = security.decrypt(retrievedValid);
    expect(decryptedValid).toEqual(validData);

    // Invalid data should throw error
    const retrievedInvalid = await storage.get('invalid');
    expect(() => {
      security.decrypt(retrievedInvalid);
    }).toThrow('Failed to decrypt data');
  });

  it('should scan encrypted data and decrypt on demand', async () => {
    const secrets = [
      { id: 'sec-1', secret: 'password1' },
      { id: 'sec-2', secret: 'password2' },
      { id: 'sec-3', secret: 'password3' }
    ];

    // Encrypt and store
    for (const secret of secrets) {
      const encrypted = security.encrypt(secret);
      await storage.put(`secret:${secret.id}`, encrypted);
    }

    // Scan all secrets
    const results = await storage.scan({ prefix: 'secret:' });
    expect(results).toHaveLength(3);

    // Decrypt each result
    const decryptedSecrets = results.map(({ key, value }) => ({
      key,
      data: security.decrypt(value)
    }));

    expect(decryptedSecrets[0].data).toEqual(secrets[0]);
    expect(decryptedSecrets[1].data).toEqual(secrets[1]);
    expect(decryptedSecrets[2].data).toEqual(secrets[2]);
  });

  it('should combine encryption and signing for secure storage', async () => {
    const criticalData = {
      id: 'critical-1',
      value: 'Critical information',
      timestamp: Date.now()
    };

    // Encrypt the data
    const encrypted = security.encrypt(criticalData);

    // Sign the original data (for integrity check)
    const signature = security.sign(criticalData);

    // Store both encrypted data and signature
    await storage.put(`critical:${criticalData.id}`, encrypted);
    await storage.put(`critical:${criticalData.id}:sig`, signature);

    // Retrieve and verify
    const retrievedEncrypted = await storage.get(`critical:${criticalData.id}`);
    const retrievedSignature = await storage.get(`critical:${criticalData.id}:sig`);

    // Decrypt
    const decrypted = security.decrypt(retrievedEncrypted);

    // Verify integrity
    const isValid = security.verify(decrypted, retrievedSignature);

    expect(decrypted).toEqual(criticalData);
    expect(isValid).toBe(true);
  });
});