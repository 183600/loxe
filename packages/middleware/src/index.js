/**
 * 中间件管道实现
 * 支持异步中间件和错误处理
 */

export function createMiddleware(ctx) {
  const stack = [];

  const compose = (middlewares) => {
    return async (context, next) => {
      let index = -1;

      const dispatch = async (i) => {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;
        
        const middleware = middlewares[i];
        if (!middleware) {
          return next ? next(context) : undefined;
        }

        await middleware(context, () => dispatch(i + 1));
      };

      await dispatch(0);
    };
  };

  const middleware = {
    use(fn) {
      stack.push(fn);
      return this;
    },

    async execute(context) {
      const fn = compose(stack);
      await fn(context);
    },

    clear() {
      stack.length = 0;
    }
  };

  return middleware;
}

export default createMiddleware;
