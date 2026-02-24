import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStorage } from './index.js';
import { createLogger } from '../../logger/src/index.js';

describe('Integration: Storage + Logger', () => {
  let storage, logger, logSpy, warnSpy, errorSpy;

  beforeEach(async () => {
    logger = createLogger(null, { level: 'debug' });
    storage = createStorage('memory');
    await storage.open();
    
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (storage) {
      await storage.close();
    }
  });

  it('should log storage operations', async () => {
    const loggedStorage = {
      storage,
      logger,
      
      async get(key) {
        this.logger.debug('Storage get', { key });
        const value = await this.storage.get(key);
        this.logger.debug('Storage get result', { key, found: value !== null });
        return value;
      },
      
      async put(key, value) {
        this.logger.debug('Storage put', { key });
        await this.storage.put(key, value);
        this.logger.info('Storage put success', { key });
      },
      
      async del(key) {
        this.logger.debug('Storage delete', { key });
        const deleted = await this.storage.del(key);
        this.logger.info('Storage delete result', { key, deleted });
        return deleted;
      },
      
      async scan(options) {
        this.logger.debug('Storage scan', options);
        const results = await this.storage.scan(options);
        this.logger.debug('Storage scan result', { count: results.length });
        return results;
      }
    };
    
    await loggedStorage.put('key1', 'value1');
    expect(logSpy).toHaveBeenCalled();
    
    const value = await loggedStorage.get('key1');
    expect(value).toBe('value1');
    
    const deleted = await loggedStorage.del('key1');
    expect(deleted).toBe(true);
  });

  it('should log storage errors', async () => {
    const errorStorage = {
      storage,
      logger,
      
      async get(key) {
        try {
          return await this.storage.get(key);
        } catch (error) {
          this.logger.error('Storage get error', { key, error: error.message });
          throw error;
        }
      },
      
      async put(key, value) {
        try {
          await this.storage.put(key, value);
          this.logger.info('Storage put success', { key });
        } catch (error) {
          this.logger.error('Storage put error', { key, error: error.message });
          throw error;
        }
      }
    };
    
    await errorStorage.put('key1', 'value1');
    expect(logSpy).toHaveBeenCalled();
    
    const value = await errorStorage.get('key1');
    expect(value).toBe('value1');
  });

  it('should log storage transaction operations', async () => {
    const loggedStorage = {
      storage,
      logger,
      
      async tx() {
        this.logger.debug('Starting transaction');
        const tx = await this.storage.tx();
        
        return {
          async get(key) {
            this.logger.debug('Transaction get', { key });
            return await tx.get(key);
          },
          
          async put(key, value) {
            this.logger.debug('Transaction put', { key });
            await tx.put(key, value);
          },
          
          async del(key) {
            this.logger.debug('Transaction delete', { key });
            await tx.del(key);
          },
          
          async commit() {
            this.logger.info('Committing transaction');
            await tx.commit();
            this.logger.info('Transaction committed');
          },
          
          async rollback() {
            this.logger.warn('Rolling back transaction');
            await tx.rollback();
            this.logger.info('Transaction rolled back');
          }
        };
      }
    };
    
    await loggedStorage.storage.put('key1', 'original1');
    
    const tx = await loggedStorage.tx();
    await tx.put('key1', 'modified1');
    await tx.put('key2', 'new2');
    await tx.commit();
    
    expect(logSpy).toHaveBeenCalled();
  });

  it('should support configurable logging levels', async () => {
    const configurableStorage = {
      storage,
      logger,
      logLevel: 'info',
      
      setLogLevel(level) {
        this.logLevel = level;
        this.logger.setLevel(level);
      },
      
      async get(key) {
        if (this.logLevel === 'debug') {
          this.logger.debug('Storage get', { key });
        }
        return await this.storage.get(key);
      },
      
      async put(key, value) {
        this.logger.info('Storage put', { key });
        await this.storage.put(key, value);
      }
    };
    
    configurableStorage.setLogLevel('debug');
    await configurableStorage.put('key1', 'value1');
    await configurableStorage.get('key1');
    
    expect(logSpy).toHaveBeenCalled();
  });

  it('should log storage statistics', async () => {
    const stats = { reads: 0, writes: 0, deletes: 0 };
    
    const statsStorage = {
      storage,
      logger,
      stats,
      
      async get(key) {
        this.stats.reads++;
        const value = await this.storage.get(key);
        this.logger.debug('Storage read', { key, totalReads: this.stats.reads });
        return value;
      },
      
      async put(key, value) {
        this.stats.writes++;
        await this.storage.put(key, value);
        this.logger.info('Storage write', { key, totalWrites: this.stats.writes });
      },
      
      async del(key) {
        this.stats.deletes++;
        const deleted = await this.storage.del(key);
        this.logger.info('Storage delete', { key, totalDeletes: this.stats.deletes });
        return deleted;
      },
      
      getStats() {
        this.logger.info('Storage stats', this.stats);
        return { ...this.stats };
      }
    };
    
    await statsStorage.put('key1', 'value1');
    await statsStorage.put('key2', 'value2');
    await statsStorage.get('key1');
    await statsStorage.get('key2');
    await statsStorage.del('key1');
    
    const statsResult = statsStorage.getStats();
    expect(statsResult).toEqual({ reads: 2, writes: 2, deletes: 1 });
  });

  it('should log storage scan operations with details', async () => {
    const detailedStorage = {
      storage,
      logger,
      
      async scan(options = {}) {
        this.logger.debug('Storage scan started', options);
        const startTime = Date.now();
        
        const results = await this.storage.scan(options);
        
        const duration = Date.now() - startTime;
        this.logger.info('Storage scan completed', {
          prefix: options.prefix,
          limit: options.limit,
          resultsCount: results.length,
          durationMs: duration
        });
        
        return results;
      }
    };
    
    await detailedStorage.storage.put('user:1', { name: 'Alice' });
    await detailedStorage.storage.put('user:2', { name: 'Bob' });
    await detailedStorage.storage.put('post:1', { title: 'Hello' });
    
    const users = await detailedStorage.scan({ prefix: 'user:' });
    expect(users).toHaveLength(2);
    expect(logSpy).toHaveBeenCalled();
  });

  it('should handle storage connection logging', async () => {
    const connectionStorage = {
      storage,
      logger,
      isConnected: false,
      
      async open(options = {}) {
        this.logger.info('Opening storage connection', options);
        await this.storage.open(options);
        this.isConnected = true;
        this.logger.info('Storage connection opened');
      },
      
      async close() {
        this.logger.info(''Closing storage connection');
        await this.storage.close();
        this.isConnected = false;
        this.logger.info('Storage connection closed');
      },
      
      async get(key) {
        if (!this.isConnected) {
          this.logger.error('Storage not connected');
          throw new Error('Storage not connected');
        }
        return await this.storage.get(key);
      }
    };
    
    await connectionStorage.open();
    expect(connectionStorage.isConnected).toBe(true);
    
    await connectionStorage.storage.put('key1', 'value1');
    const value = await connectionStorage.get('key1');
    expect(value).toBe('value1');
    
    await connectionStorage.close();
    expect(connectionStorage.isConnected).toBe(false);
  });
});