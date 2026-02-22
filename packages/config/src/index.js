/**
 * 配置管理实现
 * 支持环境变量和运行时配置
 */

export function createConfig(ctx, initialConfig = {}) {
  const config = { ...initialConfig };

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
