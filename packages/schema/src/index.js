const schemas = new Map();
const migrations = new Map();

export function registerSchema(name, schema) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  if (!schema || typeof schema !== 'object') {
    throw new Error('Schema must be a valid object');
  }
  
  schemas.set(name, schema);
  return true;
}

export function getSchema(name) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  return schemas.get(name);
}

export function getAllSchemas() {
  return Object.fromEntries(schemas);
}

export function hasSchema(name) {
  if (typeof name !== 'string' || !name.trim()) {
    return false;
  }
  
  return schemas.has(name);
}

export function clearAllSchemas() {
  schemas.clear();
}

export function validate(schemaName, data) {
  if (typeof schemaName !== 'string' || !schemaName.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  const schema = schemas.get(schemaName);
  if (!schema) {
    throw new Error(`Schema '${schemaName}' not found`);
  }
  
  return validateData(data, schema);
}

function validateData(data, schema) {
  const errors = [];
  
  // Check type
  if (schema.type) {
    // Allow null and undefined values to pass type check (valid for non-required fields)
    if (data !== null && data !== undefined) {
      const dataType = Array.isArray(data) ? 'array' : typeof data;
      if (dataType !== schema.type) {
        errors.push(`Expected type '${schema.type}', but got '${dataType}'`);
      }
    }
  }
  
  // Check object properties
  if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
    const properties = schema.properties;
    
    // Check required properties
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          errors.push(`Required property '${requiredProp}' is missing`);
        }
      }
    }
    
    // Validate each property
    for (const [propName, propSchema] of Object.entries(properties)) {
      if (propName in data) {
        const propValidation = validateData(data[propName], propSchema);
        errors.push(...propValidation.errors.map(err => `${propName}: ${err}`));
      }
    }
  }
  
  // Check array items
  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.items) {
      data.forEach((item, index) => {
        const itemValidation = validateData(item, schema.items);
        errors.push(...itemValidation.errors.map(err => `[${index}]: ${err}`));
      });
    }
  }
  
  // Check enum values
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function registerMigration(schemaName, fromVersion, toVersion, migrationFn) {
  if (typeof schemaName !== 'string' || !schemaName.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  if (typeof fromVersion !== 'string' || !fromVersion.trim()) {
    throw new Error('From version must be a non-empty string');
  }
  
  if (typeof toVersion !== 'string' || !toVersion.trim()) {
    throw new Error('To version must be a non-empty string');
  }
  
  if (typeof migrationFn !== 'function') {
    throw new Error('Migration function must be a function');
  }
  
  const key = `${schemaName}:${fromVersion}->${toVersion}`;
  migrations.set(key, {
    schemaName,
    fromVersion,
    toVersion,
    migrationFn
  });
  
  return true;
}

export function migrate(schemaName, data, fromVersion, toVersion) {
  if (typeof schemaName !== 'string' || !schemaName.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  if (fromVersion === toVersion) {
    return data;
  }
  
  const migrationPath = findMigrationPath(schemaName, fromVersion, toVersion);
  
  if (!migrationPath || migrationPath.length === 0) {
    throw new Error(`No migration path found from ${fromVersion} to ${toVersion} for schema ${schemaName}`);
  }
  
  let result = data;
  
  for (const migration of migrationPath) {
    result = migration.migrationFn(result);
  }
  
  return result;
}

export function getMigrationHistory(schemaName) {
  if (typeof schemaName !== 'string' || !schemaName.trim()) {
    throw new Error('Schema name must be a non-empty string');
  }
  
  const history = [];
  
  for (const [key, migration] of migrations.entries()) {
    if (migration.schemaName === schemaName) {
      history.push({
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion
      });
    }
  }
  
  return history;
}

function findMigrationPath(schemaName, fromVersion, toVersion) {
  // Simple direct migration lookup
  const key = `${schemaName}:${fromVersion}->${toVersion}`;
  const directMigration = migrations.get(key);
  
  if (directMigration) {
    return [directMigration];
  }
  
  // Try to find a multi-step path (basic implementation)
  // This is a simplified version - in a real implementation, you might use
  // a proper graph traversal algorithm like BFS or DFS
  const path = [];
  let currentVersion = fromVersion;
  
  while (currentVersion !== toVersion) {
    let foundMigration = null;
    
    for (const [key, migration] of migrations.entries()) {
      if (migration.schemaName === schemaName && 
          migration.fromVersion === currentVersion) {
        foundMigration = migration;
        break;
      }
    }
    
    if (!foundMigration) {
      return null; // No path found
    }
    
    path.push(foundMigration);
    currentVersion = foundMigration.toVersion;
    
    // Prevent infinite loops
    if (path.length > 10) {
      return null;
    }
  }
  
  return path;
}