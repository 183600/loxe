/**
 * 日志记录器实现
 * 支持多级别日志输出
 */

export function createLogger(ctx, options = {}) {
  const { level = 'info', prefix = '' } = options;
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  const currentLevel = levels[level] ?? 1;

  const formatMessage = (levelName, message, meta) => {
    const timestamp = new Date().toISOString();
    const prefixStr = prefix ? `[${prefix}] ` : '';
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${prefixStr}[${levelName.toUpperCase()}] ${message}${metaStr}`;
  };

  const log = (levelName, message, meta) => {
    if (levels[levelName] >= currentLevel) {
      const output = formatMessage(levelName, message, meta);
      if (levelName === 'error') {
        console.error(output);
      } else if (levelName === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    }
  };

  return {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
    setLevel: (newLevel) => { currentLevel = levels[newLevel] ?? currentLevel; },
    getLevel: () => Object.keys(levels).find(k => levels[k] === currentLevel)
  };
}

export default createLogger;
