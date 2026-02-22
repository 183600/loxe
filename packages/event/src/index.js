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
      if (listeners.has(event)) {
        for (const callback of listeners.get(event)) {
          callback(data);
        }
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
