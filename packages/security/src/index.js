/**
 * Security module - ABAC (Attribute-Based Access Control) implementation
 */

class SecurityContext {
  constructor(ctx) {
    this.ctx = ctx;
    this.principal = null;
    this.policies = [];
  }

  /**
   * Set the current principal (user/entity)
   * @param {Object} principal - The principal object with attributes
   */
  setPrincipal(principal) {
    this.principal = principal;
  }

  /**
   * Check if the principal can perform an action on a resource
   * @param {string} action - The action to perform
   * @param {Object} resource - The resource object with attributes
   * @param {Object} environment - Environment attributes (optional)
   * @returns {boolean} - Whether the action is allowed
   */
  can(action, resource, environment = {}) {
    if (!this.principal) {
      return false;
    }

    // Simple ABAC implementation
    for (const policy of this.policies) {
      if (this.evaluatePolicy(policy, action, resource, environment)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a policy to the security context
   * @param {Object} policy - The policy object
   */
  addPolicy(policy) {
    this.policies.push(policy);
  }

  /**
   * Evaluate a single policy
   * @param {Object} policy - The policy to evaluate
   * @param {string} action - The action to perform
   * @param {Object} resource - The resource object
   * @param {Object} environment - Environment attributes
   * @returns {boolean} - Whether the policy allows the action
   */
  evaluatePolicy(policy, action, resource, environment) {
    // Check if the policy applies to the action
    if (policy.action && policy.action !== action) {
      return false;
    }

    // Check principal attributes
    if (policy.principalAttributes) {
      for (const [key, value] of Object.entries(policy.principalAttributes)) {
        if (this.principal[key] !== value) {
          return false;
        }
      }
    }

    // Check resource attributes
    if (policy.resourceAttributes) {
      for (const [key, value] of Object.entries(policy.resourceAttributes)) {
        if (resource[key] !== value) {
          return false;
        }
      }
    }

    // Check environment attributes
    if (policy.environmentAttributes) {
      for (const [key, value] of Object.entries(policy.environmentAttributes)) {
        if (environment[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Encrypt data using the security context
   * @param {string|Object} data - The data to encrypt
   * @param {Object} options - Encryption options (optional)
   * @returns {string} - The encrypted data
   */
  encrypt(data, options = {}) {
    // TODO: Implement actual encryption logic
    // This is a stub implementation that returns a base64 encoded string
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return Buffer.from(dataStr).toString('base64');
  }

  /**
   * Decrypt data using the security context
   * @param {string} encryptedData - The encrypted data
   * @param {Object} options - Decryption options (optional)
   * @returns {string|Object} - The decrypted data
   */
  decrypt(encryptedData, options = {}) {
    // TODO: Implement actual decryption logic
    // This is a stub implementation that decodes base64 string
    try {
      // Check if the input is a valid base64 string
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encryptedData)) {
        throw new Error('Invalid base64 format');
      }
      
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
      // Try to parse as JSON, if fails return as string
      try {
        return JSON.parse(decoded);
      } catch {
        return decoded;
      }
    } catch (error) {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Sign data using the security context
   * @param {string|Object} data - The data to sign
   * @param {Object} options - Signing options (optional)
   * @returns {string} - The signature
   */
  sign(data, options = {}) {
    // TODO: Implement actual signing logic
    // This is a stub implementation that returns a simple hash-like signature
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    const timestamp = Date.now().toString();
    const combined = `${dataStr}:${timestamp}`;
    
    // Simple hash-like signature (not cryptographically secure)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16) + `:${timestamp}`;
  }

  /**
   * Verify data signature using the security context
   * @param {string|Object} data - The original data
   * @param {string} signature - The signature to verify
   * @param {Object} options - Verification options (optional)
   * @returns {boolean} - Whether the signature is valid
   */
  verify(data, signature, options = {}) {
    // TODO: Implement actual verification logic
    // This is a stub implementation that checks the hash-like signature
    try {
      const [hashPart, timestampPart] = signature.split(':');
      
      if (!hashPart || !timestampPart) {
        return false;
      }
      
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
      const combined = `${dataStr}:${timestampPart}`;
      
      // Recalculate the hash
      let hash = 0;
      for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      const calculatedHash = Math.abs(hash).toString(16);
      return calculatedHash === hashPart;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Create a new security context
 * @param {Object} ctx - The application context
 * @returns {SecurityContext} - A new security context
 */
export function createSecurityContext(ctx) {
  return new SecurityContext(ctx);
}

export { SecurityContext };