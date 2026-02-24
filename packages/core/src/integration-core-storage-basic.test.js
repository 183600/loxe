import { describe, it, expect, beforeEach } from 'vitest';
import { createCore } from './index.js';
import { createStorage } from '../../storage/src/index.js';

describe('Integration: Core + Storage', () => {
  let core;

  beforeEach(async () => {
    core = createCore();
    core.register('storage', () => createStorage('memory'), true);
    const storage = core.get('storage');
    await storage.open();
  });

  it('should provide storage service through core', async () => {
    const storage = core.get('storage');
    expect(storage).toBeDefined();
    expect(typeof storage.get).toBe('function');
    expect(typeof storage.put).toBe('function');
    expect(typeof storage.del).toBe('function');
    expect(typeof storage.scan).toBe('function');
  });

  it('should return same storage instance for singleton', () => {
    const storage1 = core.get('storage');
    const storage2 = core.get('storage');
    expect(storage1).toBe(storage2);
  });

  it('should store and retrieve values via storage', async () => {
    const storage = core.get('storage');
    
    await storage.put('key1', 'value1');
    const value = await storage.get('key1');
    expect(value).toBe('value1');
    
    await storage.put('key2', { data: 123 });
    const value2 = await storage.get('key2');
    expect(value2).toEqual({ data: 123 });
  });

  it('should delete values from storage', async () => {
    const storage = core.get('storage');
    
    await storage.put('key1', 'value1');
    expect(await storage.get('key1')).toBe('value1');
    
    const deleted = await storage.del('key1');
    expect(deleted).toBe(true);
    expect(await storage.get('key1')).toBe(null);
  });

  it('should scan keys with prefix', async () => {
    const storage = core.get('storage');
    
    await storage.put('user:1', { name: 'Alice' });
    await storage.put('user:2', { name: 'Bob' });
    await storage.put('post:1', { title: 'Hello' });
    
    const users = await storage.scan({ prefix: 'user:' });
    expect(users).toHaveLength(2);
    expect(users[0].key).toBe('user:1');
    expect(users[1].key).toBe('user:2');
    
    const posts = await storage.scan({ prefix: 'post:' });
    expect(posts).toHaveLength(1);
  });

  it('should support service with storage dependency', async () => {
    core.register('userService', (ctx) => {
      const storage = ctx.get('storage');
      return {
        async getUser(id) {
          const user = await storage.get(`user:${id}`);
          if (user) return user;
          
          const newUser = { id, name: `User${id}`, createdAt: Date.now() };
          await storage.put(`user:${id}`, newUser);
          return newUser;
        },
        async deleteUser(id) {
          return await storage.del(`user:${id}`);
        }
      };
    }, true);

    const userService = core.get('userService');
    
    const user1 = await userService.getUser(1);
    const user2 = await userService.getUser(1);
    
    expect(user1).toEqual(user2);
    expect(user1.name).toBe('User1');
  });

  it('should handle storage transactions', async () => {
    const storage = core.get('storage');
    
    await storage.put('key1', 'original1');
    await storage.put('key2', 'original2');
    
    const tx = await storage.tx();
    
    await tx.put('key1', 'modified1');
    await tx.put('key3', 'new3');
    
    // 事务内读取修改后的值
    expect(await tx.get('key1')).toBe('modified1');
    expect(await tx.get('key3')).toBe('new3');
    
    // 提交前原始数据未变
    expect(await storage.get('key1')).toBe('original1');
    expect(await storage.get('key3')).toBe(null);
    
    await tx.commit();
    
    // 提交后数据已改变
    expect(await storage.get('key1')).toBe('modified1');
    expect(await storage.get('key3')).toBe('new3');
  });

  it('should handle transaction rollback', async () => {
    const storage = core.get('storage');
    
    await storage.put('key1', 'original1');
    
    const tx = await storage.tx();
    await tx.put('key1', 'modified1');
    await tx.put('key2', 'new2');
    await tx.rollback();
    
    // 回滚后数据未改变
    expect(await storage.get('key1')).toBe('original1');
    expect(await storage.get('key2')).toBe(null);
  });
});