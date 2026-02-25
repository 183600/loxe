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

    emit(event, ...args) {
          const errors = [];
          
          // 精确匹配
          if (listeners.has(event)) {
            for (const callback of listeners.get(event)) {
              try {
                // 根据回调函数的参数长度决定传递的参数数量
                if (callback.length === 0) {
                  callback();
                } else if (callback.length === 1) {
                  callback(args[0]);
                } else if (callback.length === 2) {
                  callback(args[0], args[1]);
                } else {
                  callback(...args);
                }
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
            // 只处理包含 '*' 的通配符模式
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
                      // 通配符匹配时，根据回调函数的参数长度决定传递的参数数量
                      if (callback.length === 0) {
                        callback();
                      } else if (callback.length === 1) {
                        callback(event);
                      } else if (callback.length === 2) {
                        callback(event, args[0]);
                      } else {
                        callback(event, ...args);
                      }
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
        },    once(event, callback) {
      const originalEvent = event;
      const originalCallback = callback;
      let called = false;
      
      const wrapper = (...args) => {
        if (called) return;
        called = true;
        
        try {
          // 根据原始回调函数的参数长度决定传递的参数数量
          if (originalCallback.length === 0) {
            originalCallback();
          } else if (originalCallback.length === 1) {
            originalCallback(args[0]);
          } else if (originalCallback.length === 2) {
            originalCallback(args[0], args[1]);
          } else {
            originalCallback(...args);
          }
          
          // 只有在回调成功执行后才移除监听器
          this.off(originalEvent, wrapper);
        } catch (error) {
          // 如果回调抛出错误，重置 called 标志
          // 这样监听器不会被移除，下次发射时仍然会执行
          called = false;
          throw error;
        }
      };
      
      // 设置 wrapper 的 length 属性以匹配原始回调函数
      Object.defineProperty(wrapper, 'length', {
        value: originalCallback.length,
        configurable: true,
        writable: false,
        enumerable: false
      });
      
      // 注册 wrapper
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