import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConfig } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Config + Logger', () => {
  let config, logger, logSpy, warnSpy, errorSpy;

  beforeEach(() => {
    config = createConfig({
      logLevel: 'info',
      logPrefix: 'MyApp',
      featureFlags: {
        enableDebug: false,
        verboseLogging: true
      }
    });
    
    logger = createLogger(null, {
      level: config.get('logLevel'),
      prefix: config.get('logPrefix')
    });
    
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize logger with config values', () => {
    expect(logger.getLevel()).toBe('info');
    
    logger.info('Test message');
    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
  });

  it('should update logger level when config changes', () => {
    expect(logger.getLevel()).toBe('info');
    
    config.set('logLevel', 'debug');
    logger.setLevel(config.get('logLevel'));
    
    expect(logger.getLevel()).toBe('debug');
    
    logger.debug('Debug message');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('should use config to control logging behavior', () => {
    const enableDebug = config.get('featureFlags.enableDebug');
    
    if (enableDebug) {
      logger.debug('Debug info');
      expect(logSpy).toHaveBeenCalled();
    } else {
      logger.debug('Debug info');
      expect(logSpy).not.toHaveBeenCalled();
    }
  });

  it('should create a configurable logger service', () => {
    const configurableLogger = {
      config,
      logger,
      
      setLevel(level) {
        this.config.set('logLevel', level);
        this.logger.setLevel(level);
      },
      
      getLevel() {
        return this.logger.getLevel();
      },
      
      log(level, message, meta) {
        const prefix = this.config.get('logPrefix');
        const fullMessage = prefix ? `[${prefix}] ${message}` : message;
        
        switch (level) {
          case 'debug':
            this.logger.debug(fullMessage, meta);
            break;
          case 'info':
            this.logger.info(fullMessage, meta);
            break;
          case 'warn':
            this.logger.warn(fullMessage, meta);
            break;
          case 'error':
            this.logger.error(fullMessage, meta);
            break;
        }
      },
      
      updateConfig(newConfig) {
        this.config.merge(newConfig);
        if (newConfig.logLevel) {
          this.logger.setLevel(newConfig.logLevel);
        }
      }
    };
    
    configurableLogger.log('info', 'Test message');
    expect(logSpy).toHaveBeenCalled();
    
    configurableLogger.setLevel('warn');
    expect(configurableLogger.getLevel()).toBe('warn');
  });

  it('should support dynamic prefix changes via config', () => {
    const service = {
      config,
      logger,
      
      setPrefix(prefix) {
        this.config.set('logPrefix', prefix);
        // Note: Logger prefix is set at creation time, so this shows
        // how config can be used to manage configuration state
      },
      
      logWithConfigPrefix(message) {
        const prefix = this.config.get('logPrefix');
        const fullMessage = prefix ? `[${prefix}] ${message}` : message;
        this.logger.info(fullMessage);
      }
    };
    
    service.logWithConfigPrefix('First message');
    expect(logSpy).toHaveBeenCalled();
    let output = logSpy.mock.calls[0][0];
    expect(output).toContain('[MyApp]');
    
    service.setPrefix('UpdatedApp');
    service.logWithConfigPrefix('Second message');
    output = logSpy.mock.calls[1][0];
    expect(output).toContain('[UpdatedApp]');
  });

  it('should handle config-based log filtering', () => {
    const filteredLogger = {
      config,
      logger,
      
      shouldLog(level) {
        const verbose = this.config.get('featureFlags.verboseLogging');
        const configLevel = this.config.get('logLevel');
        
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[configLevel] ?? 1;
        
        if (!verbose && level === 'debug') {
          return false;
        }
        
        return levels[level] >= currentLevel;
      },
      
      log(level, message, meta) {
        if (this.shouldLog(level)) {
          switch (level) {
            case 'debug':
              this.logger.debug(message, meta);
              break;
            case 'info':
              this.logger.info(message, meta);
              break;
            case 'warn':
              this.logger.warn(message, meta);
              break;
            case 'error':
              this.logger.error(message, meta);
              break;
          }
        }
      }
    };
    
    filteredLogger.log('debug', 'Debug message');
    expect(logSpy).not.toHaveBeenCalled();
    
    filteredLogger.log('info', 'Info message');
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('should support environment variable configuration for logging', () => {
    const originalEnv = process.env;
    process.env.LOG_LEVEL = 'warn';
    
    const envConfig = createConfig();
    const envLogger = createLogger(null, {
      level: envConfig.get('log.level') || 'info'
    });
    
    expect(envLogger.getLevel()).toBe('warn');
    
    process.env = originalEnv;
  });
});