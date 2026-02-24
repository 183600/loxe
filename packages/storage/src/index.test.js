import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IStorage, ITransaction, createStorage, MemoryStorage, MemoryTransaction, IndexedDBStorage, IndexedDBTransaction } from './index.js';

describe('IStorage Interface', () => {
  let storage;

  beforeEach(() => {
    // 创建一个测试用的存储实现
    class TestStorage extends IStorage {
      constructor() {
        super();
        this.data = new Map();
        this.isOpen = false;
      }

      async open(options = {}) {
        this.isOpen = true;
      }

      async close() {
        this.isOpen = false;
      }

      async get(key) {
        return this.data.get(key) || null;
      }

      async put(key, value) {
        this.data.set(key, value);
      }

      async del(key) {
        return this.data.delete(key);
      }

      async scan(options = {}) {
        const { prefix = '', limit } = options;
        const results = [];
        
        for (const [key, value] of this.data.entries()) {
          if (key.startsWith(prefix)) {
            results.push({ key, value });
            if (limit && results.length >= limit) {
              break;
            }
          }
        }
        
        return results;
      }

      async tx() {
        return new TestTransaction(this.data);
      }
    }

    // 创建一个测试用的事务实现
    class TestTransaction extends ITransaction {
      constructor(data) {
        super();
        this.data = data;
        this.originalData = new Map(data);
        this.changes = new Map();
      }

      async get(key) {
        if (this.changes.has(key)) {
          return this.changes.get(key);
        }
        return this.data.get(key) || null;
      }

      async put(key, value) {
        this.changes.set(key, value);
      }

      async del(key) {
        this.changes.set(key, null);
      }

      async commit() {
        for (const [key, value] of this.changes.entries()) {
          if (value === null) {
            this.data.delete(key);
          } else {
            this.data.set(key, value);
          }
        }
      }

      async rollback() {
        this.changes.clear();
      }
    }

    storage = new TestStorage();
  });

  it('should implement required methods', () => {
    expect(typeof storage.open).toBe('function');
    expect(typeof storage.close).toBe('function');
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.put).toBe('function');
    expect(typeof storage.del).toBe('function');
    expect(typeof storage.scan).toBe('function');
    expect(typeof storage.tx).toBe('function');
  });

  it('should open and close storage', async () => {
    await storage.open();
    expect(storage.isOpen).toBe(true);
    
    await storage.close();
    expect(storage.isOpen).toBe(false);
  });

  it('should store and retrieve values', async () => {
    await storage.open();
    
    await storage.put('key1', 'value1');
    const value = await storage.get('key1');
    expect(value).toBe('value1');
    
    const nonExistent = await storage.get('nonexistent');
    expect(nonExistent).toBe(null);
    
    await storage.close();
  });

  it('should delete values', async () => {
    await storage.open();
    
    await storage.put('key1', 'value1');
    const exists = await storage.get('key1');
    expect(exists).toBe('value1');
    
    const deleted = await storage.del('key1');
    expect(deleted).toBe(true);
    
    const notFound = await storage.get('key1');
    expect(notFound).toBe(null);
    
    const notDeleted = await storage.del('nonexistent');
    expect(notDeleted).toBe(false);
    
    await storage.close();
  });

  it('should scan keys with prefix', async () => {
    await storage.open();
    
    await storage.put('user:1', { name: 'Alice' });
    await storage.put('user:2', { name: 'Bob' });
    await storage.put('post:1', { title: 'Hello' });
    
    const users = await storage.scan({ prefix: 'user:' });
    expect(users).toHaveLength(2);
    expect(users[0].key).toBe('user:1');
    expect(users[1].key).toBe('user:2');
    
    const posts = await storage.scan({ prefix: 'post:' });
    expect(posts).toHaveLength(1);
    expect(posts[0].key).toBe('post:1');
    
    const limited = await storage.scan({ prefix: 'user:', limit: 1 });
    expect(limited).toHaveLength(1);
    
    await storage.close();
  });

  it('should handle transactions', async () => {
    await storage.open();
    
    await storage.put('key1', 'original1');
    await storage.put('key2', 'original2');
    
    const tx = await storage.tx();
    
    // 事务内读取
    let value = await tx.get('key1');
    expect(value).toBe('original1');
    
    // 事务内修改
    await tx.put('key1', 'modified1');
    await tx.put('key3', 'new3');
    
    // 事务内读取修改后的值
    value = await tx.get('key1');
    expect(value).toBe('modified1');
    value = await tx.get('key3');
    expect(value).toBe('new3');
    
    // 提交前原始数据未变
    value = await storage.get('key1');
    expect(value).toBe('original1');
    value = await storage.get('key3');
    expect(value).toBe(null);
    
    // 提交事务
    await tx.commit();
    
    // 提交后数据已改变
    value = await storage.get('key1');
    expect(value).toBe('modified1');
    value = await storage.get('key3');
    expect(value).toBe('new3');
    
    await storage.close();
  });

  it('should handle transaction rollback', async () => {
    await storage.open();
    
    await storage.put('key1', 'original1');
    
    const tx = await storage.tx();
    await tx.put('key1', 'modified1');
    await tx.put('key2', 'new2');
    
    // 回滚事务
    await tx.rollback();
    
    // 回滚后数据未改变
    let value = await storage.get('key1');
    expect(value).toBe('original1');
    value = await storage.get('key2');
    expect(value).toBe(null);
    
    await storage.close();
  });
});

describe('createStorage', () => {
  it('should throw error for unimplemented storage type', () => {
    expect(() => createStorage('unknown')).toThrow('Storage type \'unknown\' is not implemented yet');
  });
  
  it('should create memory storage', () => {
    const storage = createStorage('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
  });
  
  it('should create indexeddb storage', () => {
    const storage = createStorage('indexeddb');
    expect(storage).toBeInstanceOf(IndexedDBStorage);
  });
});

describe('IndexedDBStorage', () => {
  it('should throw error for all operations (stub implementation)', () => {
    const storage = new IndexedDBStorage();
    
    expect(storage.open()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.close()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.get('key')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.put('key', 'value')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.del('key')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.scan()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(storage.tx()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
  });
});

describe('IndexedDBTransaction', () => {
  it('should throw error for all operations (stub implementation)', () => {
    const tx = new IndexedDBTransaction();
    
    expect(tx.get('key')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(tx.put('key', 'value')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(tx.del('key')).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(tx.commit()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
    expect(tx.rollback()).rejects.toThrow('IndexedDB is not supported in this environment. This is a stub implementation.');
  });
});

describe('MemoryStorage', () => {
  let storage;
  
  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.open();
  });
  
  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });
  
  it('should open and close storage', async () => {
    const newStorage = new MemoryStorage();
    expect(newStorage.isOpen).toBe(false);
    
    await newStorage.open();
    expect(newStorage.isOpen).toBe(true);
    
    await newStorage.close();
    expect(newStorage.isOpen).toBe(false);
  });
  
  it('should store and retrieve values', async () => {
    await storage.put('key1', 'value1');
    const value = await storage.get('key1');
    expect(value).toBe('value1');
    
    const nonExistent = await storage.get('nonexistent');
    expect(nonExistent).toBe(null);
  });
  
  it('should delete values', async () => {
    await storage.put('key1', 'value1');
    const exists = await storage.get('key1');
    expect(exists).toBe('value1');
    
    const deleted = await storage.del('key1');
    expect(deleted).toBe(true);
    
    const notFound = await storage.get('key1');
    expect(notFound).toBe(null);
    
    const notDeleted = await storage.del('nonexistent');
    expect(notDeleted).toBe(false);
  });
  
  it('should scan keys with prefix', async () => {
    await storage.put('user:1', { name: 'Alice' });
    await storage.put('user:2', { name: 'Bob' });
    await storage.put('post:1', { title: 'Hello' });
    
    const users = await storage.scan({ prefix: 'user:' });
    expect(users).toHaveLength(2);
    
    const posts = await storage.scan({ prefix: 'post:' });
    expect(posts).toHaveLength(1);
    
    const limited = await storage.scan({ prefix: 'user:', limit: 1 });
    expect(limited).toHaveLength(1);
  });
  
  it('should throw error when operating on closed storage', async () => {
    await storage.close();
    
    await expect(storage.get('key')).rejects.toThrow('Storage is not open');
    await expect(storage.put('key', 'value')).rejects.toThrow('Storage is not open');
    await expect(storage.del('key')).rejects.toThrow('Storage is not open');
    await expect(storage.scan()).rejects.toThrow('Storage is not open');
    await expect(storage.tx()).rejects.toThrow('Storage is not open');
  });
});

describe('MemoryTransaction', () => {
  let storage;
  
  beforeEach(async () => {
    storage = new MemoryStorage();
    await storage.open();
  });
  
  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });
  
  it('should handle transaction commit', async () => {
    await storage.put('key1', 'original1');
    
    const tx = await storage.tx();
    await tx.put('key1', 'modified1');
    await tx.put('key2', 'new2');
    await tx.del('key1');
    await tx.commit();
    
    const value1 = await storage.get('key1');
    expect(value1).toBe(null);
    
    const value2 = await storage.get('key2');
    expect(value2).toBe('new2');
  });
  
  it('should handle transaction rollback', async () => {
    await storage.put('key1', 'original1');
    
    const tx = await storage.tx();
    await tx.put('key1', 'modified1');
    await tx.put('key2', 'new2');
    await tx.rollback();
    
    const value1 = await storage.get('key1');
    expect(value1).toBe('original1');
    
    const value2 = await storage.get('key2');
    expect(value2).toBe(null);
  });
  
  it('should handle read operations in transaction', async () => {
    await storage.put('key1', 'original1');
    
    const tx = await storage.tx();
    
    // 读取原始值
    let value = await tx.get('key1');
    expect(value).toBe('original1');
    
    // 修改值
    await tx.put('key1', 'modified1');
    
    // 读取修改后的值
    value = await tx.get('key1');
    expect(value).toBe('modified1');
    
    // 原始存储中的值应该还未改变
    value = await storage.get('key1');
    expect(value).toBe('original1');
    
    await tx.commit();
    
    // 提交后，原始存储中的值应该已改变
    value = await storage.get('key1');
    expect(value).toBe('modified1');
  });
  
  it('should handle delete in transaction', async () => {
    await storage.put('key1', 'value1');
    
    const tx = await storage.tx();
    await tx.del('key1');
    
    // 事务内已删除
    let value = await tx.get('key1');
    expect(value).toBe(null);
    
    // 原始存储中还存在
    value = await storage.get('key1');
    expect(value).toBe('value1');
    
    await tx.commit();
    
    // 提交后已删除
    value = await storage.get('key1');
    expect(value).toBe(null);
  });
  
  it('should throw error when using committed transaction', async () => {
    const tx = await storage.tx();
    await tx.commit();
    
    await expect(tx.get('key')).rejects.toThrow('Transaction has already been committed');
    await expect(tx.put('key', 'value')).rejects.toThrow('Transaction has already been committed');
    await expect(tx.del('key')).rejects.toThrow('Transaction has already been committed');
    await expect(tx.commit()).rejects.toThrow('Transaction has already been committed');
    await expect(tx.rollback()).rejects.toThrow('Transaction has already been committed');
  });
  
  it('should throw error when using rolled back transaction', async () => {
    const tx = await storage.tx();
    await tx.rollback();
    
    await expect(tx.get('key')).rejects.toThrow('Transaction has already been rolled back');
    await expect(tx.put('key', 'value')).rejects.toThrow('Transaction has already been rolled back');
    await expect(tx.del('key')).rejects.toThrow('Transaction has already been rolled back');
    await expect(tx.commit()).rejects.toThrow('Transaction has already been rolled back');
    await expect(tx.rollback()).rejects.toThrow('Transaction has already been rolled back');
  });

  it('should handle concurrent transactions independently', async () => {
    await storage.put('key1', 'original1');
    await storage.put('key2', 'original2');
    
    const tx1 = await storage.tx();
    const tx2 = await storage.tx();
    
    // 两个事务同时修改同一个键
    await tx1.put('key1', 'tx1-value');
    await tx2.put('key1', 'tx2-value');
    
    // 每个事务看到自己的修改
    expect(await tx1.get('key1')).toBe('tx1-value');
    expect(await tx2.get('key1')).toBe('tx2-value');
    
    // 原始存储未变
    expect(await storage.get('key1')).toBe('original1');
    
    // 提交 tx1
    await tx1.commit();
    expect(await storage.get('key1')).toBe('tx1-value');
    
    // 提交 tx2，会覆盖 tx1 的修改
    await tx2.commit();
    expect(await storage.get('key1')).toBe('tx2-value');
  });

  it('should handle transaction with multiple operations on same key', async () => {
    await storage.put('key1', 'initial');
    
    const tx = await storage.tx();
    
    // 多次操作同一个键
    await tx.put('key1', 'first');
    await tx.put('key1', 'second');
    await tx.put('key1', 'third');
    
    expect(await tx.get('key1')).toBe('third');
    
    await tx.commit();
    expect(await storage.get('key1')).toBe('third');
  });

  it('should handle transaction with empty operations', async () => {
    const tx = await storage.tx();
    
    // 不做任何操作直接提交
    await tx.commit();
    
    // 应该成功，不影响存储
    expect(storage.data.size).toBe(0);
  });

  it('should handle scan with empty prefix', async () => {
    await storage.put('key1', 'value1');
    await storage.put('key2', 'value2');
    await storage.put('key3', 'value3');
    
    const results = await storage.scan({ prefix: '' });
    expect(results).toHaveLength(3);
  });

  it('should handle scan with no matching results', async () => {
    await storage.put('key1', 'value1');
    await storage.put('key2', 'value2');
    
    const results = await storage.scan({ prefix: 'nonexistent:' });
    expect(results).toHaveLength(0);
  });

  it('should handle scan with limit greater than available items', async () => {
    await storage.put('key1', 'value1');
    await storage.put('key2', 'value2');
    
    const results = await storage.scan({ prefix: '', limit: 10 });
    expect(results).toHaveLength(2);
  });
});