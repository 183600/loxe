/**
 * 通用工具函数
 * 提供常用的数据处理和类型判断功能
 */

export function createUtils(ctx) {
  return {
    isString: (v) => typeof v === 'string',
    isNumber: (v) => typeof v === 'number' && !isNaN(v),
    isBoolean: (v) => typeof v === 'boolean',
    isArray: (v) => Array.isArray(v),
    isObject: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    isFunction: (v) => typeof v === 'function',
    isNull: (v) => v === null,
    isUndefined: (v) => v === undefined,
    
    isEmpty: (v) => {
      if (v === null || v === undefined) return true;
      if (typeof v === 'string') return v.length === 0;
      if (Array.isArray(v)) return v.length === 0;
      if (typeof v === 'object') return Object.keys(v).length === 0;
      return false;
    },

    deepClone: function(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(v => this.deepClone(v));
      const cloned = {};
      for (const [k, v] of Object.entries(obj)) {
        cloned[k] = this.deepClone(v);
      }
      return cloned;
    },

    deepMerge: function(target, source) {
      const result = { ...target };
      for (const [k, v] of Object.entries(source)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') {
          result[k] = this.deepMerge(target[k], v);
        } else {
          result[k] = v;
        }
      }
      return result;
    },

    pick: (obj, keys) => {
      const result = {};
      for (const k of keys) {
        if (k in obj) result[k] = obj[k];
      }
      return result;
    },

    omit: (obj, keys) => {
      const result = { ...obj };
      for (const k of keys) {
        delete result[k];
      }
      return result;
    },

    debounce: (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    },

    throttle: (fn, limit) => {
      let last = 0;
      return (...args) => {
        const now = Date.now();
        if (now - last >= limit) {
          last = now;
          return fn(...args);
        }
      };
    }
  };
}

export default createUtils;
