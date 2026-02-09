import { describe, it, expect, beforeEach } from 'vitest';
import { IStorage, ITransaction, createStorage } from './index.js';

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
});