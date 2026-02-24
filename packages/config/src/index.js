/**
 * 配置管理实现
 * 支持环境变量和运行时配置
 */

export function createConfig(ctx, initialConfig = {}) {
  // 智能参数解析：如果只传了一个参数且是对象，则视为 initialConfig
  let actualCtx = ctx;
  let actualInitialConfig = initialConfig;
  
  // 检查实际传入的参数数量
  const argCount = arguments.length;
  if (argCount === 1 && ctx && typeof ctx === 'object' && !Array.isArray(ctx)) {
    // 如果只有一个对象参数，将其视为 initialConfig
    actualCtx = undefined;
    actualInitialConfig = ctx;
  }
  
  const config = { ...actualInitialConfig };
  
  // // 调试日志
  // if (process.env.DEBUG_CONFIG) {
  //   console.log('[Config Debug] argCount:', argCount, 'ctx:', ctx, 'initialConfig:', initialConfig);
  //   console.log('[Config Debug] actualCtx:', actualCtx, 'actualInitialInitialConfig:', actualInitialConfig);
  //   console.log('[Config Debug] config:', config);
  // }

  const configApi = {
    get(key, defaultValue = undefined) {
      if (key in config) {
        return config[key];
      }
      // 尝试从环境变量获取
      const envKey = key.toUpperCase().replace(/\./g, '_');
      if (typeof process !== 'undefined' && process.env && process.env[envKey]) {
        return process.env[envKey];
      }
      return defaultValue;
    },

    set(key, value) {
      config[key] = value;
      return this;
    },

    has(key) {
      return key in config;
    },

    delete(key) {
      delete config[key];
      return this;
    },

    all() {
      return { ...config };
    },

    merge(obj) {
      Object.assign(config, obj);
      return this;
    }
  };

  return configApi;
}

export default createConfig;
