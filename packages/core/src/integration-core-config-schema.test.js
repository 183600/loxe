import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createConfig } from '../../config/src/index.js';
import { registerSchema, validate, clearAllSchemas } from '../../schema/src/index.js';

describe('Integration: Core + Config + Schema', () => {
  let core;

  beforeEach(() => {
    clearAllSchemas();
    core = createCore();
  });

  afterEach(() => {
    clearAllSchemas();
  });

  it('should validate configuration against schema', () => {
    core.register('config', () => createConfig({
      database: {
        host: 'localhost',
        port: 5432,
        username: 'admin',
        password: 'secret'
      },
      api: {
        timeout: 5000,
        retries: 3
      }
    }), true);

    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('configValidator', (ctx) => {
      const config = ctx.get('config');
      const schema = ctx.get('schema');

      return {
        schema: schema,
        validateConfig(schemaName) {
          const configData = config.all();
          return schema.validate(schemaName, configData);
        },

        getValidatedConfig(schemaName) {
          const validation = this.validateConfig(schemaName);
          if (!validation.valid) {
            throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
          }
          return config.all();
        }
      };
    }, true);

    const configValidator = core.get('configValidator');

    // 注册配置 schema
    configValidator.schema.register('appConfig', {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' },
            username: { type: 'string' },
            password: { type: 'string' }
          },
          required: ['host', 'port']
        },
        api: {
          type: 'object',
          properties: {
            timeout: { type: 'number' },
            retries: { type: 'number' }
          }
        }
      },
      required: ['database']
    });

    // 验证配置
    const validation = configValidator.validateConfig('appConfig');
    expect(validation.valid).toBe(true);

    // 获取验证后的配置
    const config = configValidator.getValidatedConfig('appConfig');
    expect(config.database.host).toBe('localhost');
    expect(config.api.timeout).toBe(5000);
  });

  it('should detect invalid configuration', () => {
    core.register('config', () => createConfig({
      database: {
        host: 'localhost',
        port: 'invalid' // 应该是数字
      }
    }), true);

    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('configValidator', (ctx) => {
      const config = ctx.get('config');
      const schema = ctx.get('schema');

      return {
        schema: schema,
        validateConfig(schemaName) {
          const configData = config.all();
          return schema.validate(schemaName, configData);
        }
      };
    }, true);

    const configValidator = core.get('configValidator');

    // 注册配置 schema
    configValidator.schema.register('appConfig', {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' }
          },
          required: ['host', 'port']
        }
      },
      required: ['database']
    });

    // 验证配置应该失败
    const validation = configValidator.validateConfig('appConfig');
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  it('should support schema-based config defaults', () => {
    core.register('config', () => createConfig({
      database: {
        host: 'localhost'
        // 缺少 port
      }
    }), true);

    core.register('schema', () => ({
      register: registerSchema,
      validate: validate
    }), true);

    core.register('configWithDefaults', (ctx) => {
      const config = ctx.get('config');
      const schema = ctx.get('schema');

      // 深度合并函数
      const deepMerge = (target, source) => {
        const result = { ...target };
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
              result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
            result[key] = deepMerge(result[key], source[key]);
          } else {
            result[key] = source[key];
          }
        }
        return result;
      };

      return {
        schema: schema,
        getConfigWithDefaults(schemaName, defaults) {
          const configData = config.all();
          const merged = deepMerge(defaults, configData);
          const validation = schema.validate(schemaName, merged);
          
          if (!validation.valid) {
            throw new Error(`Config validation failed: ${validation.errors.join(', ')}`);
          }
          
          return merged;
        }
      };
    }, true);

    const configService = core.get('configWithDefaults');

    // 注册配置 schema
    configService.schema.register('appConfig', {
      type: 'object',
      properties: {
        database: {
          type: 'object',
          properties: {
            host: { type: 'string' },
            port: { type: 'number' }
          },
          required: ['host']
        }
      },
      required: ['database']
    });

    // 使用默认值获取配置
    const defaults = {
      database: {
        port: 5432,
        username: 'default_user'
      }
    };

    const config = configService.getConfigWithDefaults('appConfig', defaults);
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.username).toBe('default_user');
  });
});