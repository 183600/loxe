/**
 * 路由实现
 * 支持基本路径匹配和参数解析
 */

export function createRouter(ctx) {
  const routes = [];

  const matchRoute = (pattern, path) => {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);
    
    if (patternParts.length !== pathParts.length) {
      return null;
    }
    
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    
    return params;
  };

  const router = {
    on(method, pattern, handler) {
      routes.push({ method: method.toUpperCase(), pattern, handler });
      return this;
    },

    get(pattern, handler) { return this.on('GET', pattern, handler); },
    post(pattern, handler) { return this.on('POST', pattern, handler); },
    put(pattern, handler) { return this.on('PUT', pattern, handler); },
    delete(pattern, handler) { return this.on('DELETE', pattern, handler); },

    handle(method, path, context = {}) {
      for (const route of routes) {
        if (route.method === method.toUpperCase()) {
          const params = matchRoute(route.pattern, path);
          if (params !== null) {
            return route.handler({ ...context, params, path, method });
          }
        }
      }
      return null;
    },

    routes() {
      return [...routes];
    }
  };

  return router;
}

export default createRouter;
