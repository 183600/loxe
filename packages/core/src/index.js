/**
 * 核心上下文容器
 * 提供服务注册和依赖注入功能
 */

export function createCore(options = {}) {
  const services = new Map();
  const singletons = new Map();

  const core = {
    register(name, factory, singleton = false) {
      services.set(name, { factory, singleton });
      singletons.delete(name);
      return this;
    },

    get(name) {
      const service = services.get(name);
      if (!service) {
        throw new Error(`Service '${name}' not registered`);
      }

      if (service.singleton) {
        if (singletons.has(name)) {
          return singletons.get(name);
        }
        const instance = service.factory(this);
        singletons.set(name, instance);
        return instance;
      }

      return service.factory(this);
    },

    has(name) {
      return services.has(name);
    },

    remove(name) {
      services.delete(name);
      singletons.delete(name);
      return this;
    },

    clear() {
      services.clear();
      singletons.clear();
      return this;
    },

    list() {
      return Array.from(services.keys());
    },

    // 批量注册服务
    registerAll(registrations) {
      for (const [name, factory, singleton] of registrations) {
        this.register(name, factory, singleton);
      }
      return this;
    }
  };

  return core;
}

export default createCore;
