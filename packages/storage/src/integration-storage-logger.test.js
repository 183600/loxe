import { describe, it, expect, vi } from 'vitest';
import { createLogger } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Logger + Storage Integration', () => {
  let logger;
  let storage;

  beforeEach(async () => {
    logger = createLogger(null, { level: 'info', prefix: 'Storage' });
    storage = createStorage('memory');
    await storage.open();
  });

  afterEach(async () => {
    await storage.close();
  });

  it('should log storage operations', async () => {
    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    await storage.put('user:123', { name: 'Alice' });
    logger.info('PUT user:123', { name: 'Alice' });

    const user = await storage.get('user:123');
    logger.info('GET user:123', { found: !!user });

    await storage.del('user:123');
    logger.info('DELETE user:123');

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0][0]).toContain('PUT user:123');
    expect(spy.mock.calls[1][0]).toContain('GET user:123');
    expect(spy.mock.calls[2][0]).toContain('DELETE user:123');

    spy.mockRestore();
  });

  it('should create a logged storage wrapper', async () => {
    const loggedStorage = {
      async get(key) {
        const value = await storage.get(key);
        logger.info(`GET ${key}`, { found: value !== null });
        return value;
      },
      async put(key, value) {
        await storage.put(key, value);
        logger.info(`PUT ${key}`, { keys: Object.keys(value) });
      },
      async del(key) {
        const deleted = await storage.del(key);
        logger.info(`DELETE ${key}`, { deleted });
        return deleted;
      },
      async scan(options) {
        const results = await storage.scan(options);
        logger.info(`SCAN`, { prefix: options.prefix, count: results.length });
        return results;
      }
    };

    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    await loggedStorage.put('product:1', { id: 1, name: 'Widget', price: 100 });
    await loggedStorage.get('product:1');
    await loggedStorage.scan({ prefix: 'product:' });
    await loggedStorage.del('product:1');

    expect(spy).toHaveBeenCalledTimes(4);

    const putOutput = spy.mock.calls[0][0];
    expect(putOutput).toContain('PUT product:1');

    const getOutput = spy.mock.calls[1][0];
    expect(getOutput).toContain('GET product:1');

    const scanOutput = spy.mock.calls[2][0];
    expect(scanOutput).toContain('SCAN');

    const deleteOutput = spy.mock.calls[3][0];
    expect(deleteOutput).toContain('DELETE product:1');

    spy.mockRestore();
  });

  it('should log storage errors with error level', async () => {
    const errorLogger = createLogger(null, { level: 'error', prefix: 'Storage' });

    const errorStorage = {
      async get(key) {
        const value = await storage.get(key);
        if (value === null) {
          errorLogger.error(`Key not found: ${key}`);
        }
        return value;
      },
      async put(key, value) {
        if (!key || !value) {
          errorLogger.error('Invalid put operation', { key, value });
          throw new Error('Invalid parameters');
        }
        await storage.put(key, value);
      }
    };

    const spyLog = vi.spyOn(console, 'log');
    const spyWarn = vi.spyOn(console, 'warn');
    const spyError = vi.spyOn(console, 'error');
    spyLog.mockClear();
    spyWarn.mockClear();
    spyError.mockClear();

    // 记录未找到的键
    await errorStorage.get('nonexistent');
    expect(spyError).toHaveBeenCalled();
    const notFoundOutput = spyError.mock.calls[0][0];
    expect(notFoundOutput).toContain('Key not found: nonexistent');

    // 记录无效操作
    await expect(errorStorage.put('', null)).rejects.toThrow('Invalid parameters');
    expect(spyError).toHaveBeenCalledTimes(2);

    spyLog.mockRestore();
    spyWarn.mockRestore();
    spyError.mockRestore();
  });

  it('should log transaction operations', async () => {
    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    const tx = await storage.tx();

    await tx.put('key1', 'value1');
    logger.info('TX PUT key1');

    await tx.put('key2', 'value2');
    logger.info('TX PUT key2');

    await tx.commit();
    logger.info('TX COMMIT');

    expect(spy).toHaveBeenCalledTimes(3);
    expect(spy.mock.calls[0][0]).toContain('TX PUT key1');
    expect(spy.mock.calls[1][0]).toContain('TX PUT key2');
    expect(spy.mock.calls[2][0]).toContain('TX COMMIT');

    spy.mockRestore();
  });

  it('should log storage statistics', async () => {
    const spy = vi.spyOn(console, 'log');
    spy.mockClear();

    await storage.put('key1', 'value1');
    await storage.put('key2', 'value2');
    await storage.put('key3', 'value3');

    const scanResults = await storage.scan({});
    const stats = {
      totalKeys: scanResults.length,
      keys: scanResults.map(r => r.key)
    };

    logger.info('Storage statistics', stats);

    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls[0][0];
    expect(output).toContain('Storage statistics');
    expect(output).toContain('totalKeys');
    expect(output).toContain('3');

    spy.mockRestore();
  });
});