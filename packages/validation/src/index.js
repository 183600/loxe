/**
 * 数据验证实现
 * 支持基本类型验证和自定义规则
 */

export function createValidation(ctx) {
  const validators = {
    string: (value) => typeof value === 'string',
    number: (value) => typeof value === 'number' && !isNaN(value),
    boolean: (value) => typeof value === 'boolean',
    array: (value) => Array.isArray(value),
    object: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    required: (value) => value !== undefined && value !== null,
    email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    min: (value, min) => typeof value === 'number' && value >= min,
    max: (value, max) => typeof value === 'number' && value <= max,
    minLength: (value, min) => (typeof value === 'string' || Array.isArray(value)) && value.length >= min,
    maxLength: (value, max) => (typeof value === 'string' || Array.isArray(value)) && value.length <= max
  };

  const validate = (value, rules) => {
    const errors = [];
    
    for (const rule of rules) {
      if (typeof rule === 'string') {
        if (!validators[rule](value)) {
          errors.push(`Validation failed: ${rule}`);
        }
      } else if (typeof rule === 'object') {
        const [name, ...args] = Object.entries(rule)[0];
        if (validators[name] && !validators[name](value, ...args)) {
          errors.push(`Validation failed: ${name}`);
        }
      } else if (typeof rule === 'function') {
        const result = rule(value);
        if (result !== true) {
          errors.push(result || 'Custom validation failed');
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  };

  const schema = (definition) => {
    return (data) => {
      const errors = {};
      for (const [field, rules] of Object.entries(definition)) {
        const result = validate(data[field], rules);
        if (!result.valid) {
          errors[field] = result.errors;
        }
      }
      return { valid: Object.keys(errors).length === 0, errors };
    };
  };

  return {
    validators,
    validate,
    schema
  };
}

export default createValidation;
