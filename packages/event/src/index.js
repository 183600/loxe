/**
 * 事件发射器实现
 * 支持基本的 pub/sub 模式
 */

export function createEventEmitter(ctx) {
  const listeners = new Map();

  const emitter = {
    on(event, callback) {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
      return () => this.off(event, callback);
    },

    off(event, callback) {
      if (listeners.has(event)) {
        listeners.get(event).delete(callback);
      }
    },

    emit(event, data) {
      const errors = [];
      
      // 精确匹配
      if (listeners.has(event)) {
        for (const callback of listeners.get(event)) {
          try {
            callback(data);
          } catch (error) {
            errors.push(error);
          }
        }
      }
      
      // 通配符匹配 (如 count:* 匹配 count:click, api:* 匹配 api:request:get, api:*:* 匹配 api:v1:users)
      const eventStr = String(event);
      const eventParts = eventStr.split(':');
      
      for (const [key, callbacks] of listeners.entries()) {
        const keyStr = String(key);
        if (keyStr.includes('*')) {
          const patternParts = keyStr.split(':');
          
          // 检查是否匹配：模式段数必须小于等于事件段数
          if (patternParts.length <= eventParts.length) {
            let matches = true;
            for (let i = 0; i < patternParts.length; i++) {
              if (patternParts[i] !== '*' && patternParts[i] !== eventParts[i]) {
                matches = false;
                break;
              }
            }
            
            if (matches) {
              for (const callback of callbacks) {
                try {
                  callback(event, data);
                } catch (error) {
                  errors.push(error);
                }
              }
            }
          }
        }
      }
      
      if (errors.length > 0) {
        throw errors[0];
      }
    },

    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      return this.on(event, wrapper);
    },

    removeAllListeners(event) {
      if (event) {
        listeners.delete(event);
      } else {
        listeners.clear();
      }
    }
  };

  return emitter;
}

export default createEventEmitter;
