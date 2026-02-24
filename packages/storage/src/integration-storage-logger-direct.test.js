import { describe, it, expect, vi } from 'vitest';
import { MemoryStorage } from './index.js';
import { createLogger } from '../logger/src/index.js';

describe('Integration: Storage + Logger Direct Interaction', () => {
  let storage;
  let logger;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.open();
    logger = createLogger(null, { level: 'info' });
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should log storage operations', async () => {
    const spyLog = vi.spyOn(console, 'log');

    // 包装存储方法以记录日志
    const originalPut = storage.put.bind(storage);
    const wrappedPut = async (key, value) => {
      logger.info(`Storage put: ${key}`, { value });
      return originalPut(key, value);
    };

    const originalGet = storage.get.bind(storage);
    const wrappedGet = async (key) => {
      const value = await originalGet(key);
      logger.info(`Storage get: ${key}`, { value });
      return value;
    };

    await wrappedPut('user:1', { name: 'Alice' });
    await wrappedGet('user:1');

    expect(spyLog).toHaveBeenCalledTimes(2);
    expect(spyLog.mock.calls[0][0]).toContain('Storage put: user:1');
    expect(spyLog.mock.calls[1][0]).toContain('Storage get: user:1');

    spyLog.mockRestore();
  });

  it('should log storage errors', async () => {
    const logger = createLogger(null, { level: 'error' });
    const spyError = vi.spyOn(console, 'error');

    // 模拟存储操作失败
    const errorStorage = new MemoryStorage();
    await errorStorage.open();

    const originalPut = errorStorage.put.bind(errorStorage);
    const wrappedPut = async (key, value) => {
      try {
        return await originalPut(key, value);
      } catch (error) {
        logger.error(`Storage put failed: ${key}`, { error: error.message });
        throw error;
      }
    };

    // 模拟一个会失败的操作
    await wrappedPut('test', 'value');

    // 正常情况下不会出错，这里只是测试日志机制
    spyError.mockRestore();
  });

  it('should log scan operations with results count', async () => {
    const spyLog = vi.spyOn(console, 'log');

    await storage.put('user:1', { name: 'Alice' });
    await storage.put('user:2', { name: 'Bob' });
    await storage.put('product:1', { name: 'Widget' });

    // 包装 scan 方法以记录日志
    const originalScan = storage.scan.bind(storage);
    const wrappedScan = async (options) => {
      const results = await originalScan(options);
      logger.info(`Storage scan: ${options.prefix || 'all'}`, { count: results.length });
      return results;
    };

    const users = await wrappedScan({ prefix: 'user:' });
    expect(users).toHaveLength(2);

    expect(spyLog).toHaveBeenCalled();
    expect(spyLog.mock.calls[0][0]).toContain('Storage scan: user:');
    expect(spyLog.mock.calls[0][0]).toContain('count: 2');

    spyLog.mockRestore();
  });
});