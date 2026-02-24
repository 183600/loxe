/**
 * Minimal KV Storage Interface
 * 提供基本的键值存储操作接口
 */

/**
 * 基础存储接口
 * @interface IStorage
 */
export class IStorage {
  /**
   * 打开存储连接
   * @param {Object} options - 配置选项
   * @returns {Promise<void>}
   */
  async open(options = {}) {
    throw new Error('open method must be implemented');
  }

  /**
   * 关闭存储连接
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close method must be implemented');
  }

  /**
   * 获取值
   * @param {string} key - 键
   * @returns {Promise<any|null>} 值，如果不存在则返回 null
   */
  async get(key) {
    throw new Error('get method must be implemented');
  }

  /**
   * 设置值
   * @param {string} key - 键
   * @param {any} value - 值
   * @returns {Promise<void>}
   */
  async put(key, value) {
    throw new Error('put method must be implemented');
  }

  /**
   * 删除键
   * @param {string} key - 键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async del(key) {
    throw new Error('del method must be implemented');
  }

  /**
   * 扫描键
   * @param {Object} options - 扫描选项
   * @param {string} options.prefix - 键前缀
   * @param {number} options.limit - 限制数量
   * @returns {Promise<Array<{key: string, value: any}>>}
   */
  async scan(options = {}) {
    throw new Error('scan method must be implemented');
  }

  /**
   * 开始事务
   * @returns {Promise<ITransaction>} 事务对象
   */
  async tx() {
    throw new Error('tx method must be implemented');
  }
}

/**
 * 事务接口
 * @interface ITransaction
 */
export class ITransaction {
  /**
   * 获取值
   * @param {string} key - 键
   * @returns {Promise<any|null>} 值，如果不存在则返回 null
   */
  async get(key) {
    throw new Error('get method must be implemented');
  }

  /**
   * 设置值
   * @param {string} key - 键
   * @param {any} value - 值
   * @returns {Promise<void>}
   */
  async put(key, value) {
    throw new Error('put method must be implemented');
  }

  /**
   * 删除键
   * @param {string} key - 键
   * @returns {Promise<boolean>} 是否删除成功
   */
  async del(key) {
    throw new Error('del method must be implemented');
  }

  /**
   * 提交事务
   * @returns {Promise<void>}
   */
  async commit() {
    throw new Error('commit method must be implemented');
  }

  /**
   * 回滚事务
   * @returns {Promise<void>}
   */
  async rollback() {
    throw new Error('rollback method must be implemented');
  }
}

/**
 * 内存事务实现
 */
export class MemoryTransaction extends ITransaction {
  constructor(storage) {
    super();
    this.storage = storage;
    this.changes = new Map();
    this.isCommitted = false;
    this.isRolledBack = false;
    // 创建快照以确保事务隔离
    this.snapshot = new Map(storage.data);
  }

  async get(key) {
    this._checkState();
    
    // 先检查事务中的更改
    if (this.changes.has(key)) {
      const value = this.changes.get(key);
      return value === undefined ? null : value;
    }
    
    // 否则从快照中获取（而不是直接从 storage.data）
    return this.snapshot.get(key) || null;
  }

  async put(key, value) {
    this._checkState();
    this.changes.set(key, value);
  }

  async del(key) {
    this._checkState();
    this.changes.set(key, undefined);
  }

  async commit() {
    this._checkState();
    
    // 应用所有更改到存储
    for (const [key, value] of this.changes.entries()) {
      if (value === undefined) {
        this.storage.data.delete(key);
      } else {
        this.storage.data.set(key, value);
      }
    }
    
    this.isCommitted = true;
  }

  async rollback() {
    this._checkState();
    this.isRolledBack = true;
  }

  _checkState() {
    if (this.isCommitted) {
      throw new Error('Transaction has already been committed');
    }
    if (this.isRolledBack) {
      throw new Error('Transaction has already been rolled back');
    }
  }
}

/**
 * 内存存储适配器实现
 */
export class MemoryStorage extends IStorage {
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
    this._checkOpen();
    return this.data.get(key) || null;
  }

  async put(key, value) {
    this._checkOpen();
    this.data.set(key, value);
  }

  async del(key) {
    this._checkOpen();
    return this.data.delete(key);
  }

  async scan(options = {}) {
    this._checkOpen();
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
    this._checkOpen();
    return new MemoryTransaction(this);
  }

  _checkOpen() {
    if (!this.isOpen) {
      throw new Error('Storage is not open');
    }
  }
}

/**
 * IndexedDB 事务实现（Stub 版本）
 */
export class IndexedDBTransaction extends ITransaction {
  constructor() {
    super();
  }

  _throwNotSupported() {
    throw new Error('IndexedDB is not supported in this environment. This is a stub implementation.');
  }

  async get(key) {
    this._throwNotSupported();
  }

  async put(key, value) {
    this._throwNotSupported();
  }

  async del(key) {
    this._throwNotSupported();
  }

  async commit() {
    this._throwNotSupported();
  }

  async rollback() {
    this._throwNotSupported();
  }
}

/**
 * IndexedDB 存储适配器实现（Stub 版本）
 */
export class IndexedDBStorage extends IStorage {
  constructor() {
    super();
  }

  _throwNotSupported() {
    throw new Error('IndexedDB is not supported in this environment. This is a stub implementation.');
  }

  async open(options = {}) {
    this._throwNotSupported();
  }

  async close() {
    this._throwNotSupported();
  }

  async get(key) {
    this._throwNotSupported();
  }

  async put(key, value) {
    this._throwNotSupported();
  }

  async del(key) {
    this._throwNotSupported();
  }

  async scan(options = {}) {
    this._throwNotSupported();
  }

  async tx() {
    this._throwNotSupported();
  }
}

/**
 * 存储工厂函数
 * @param {string} type - 存储类型
 * @param {Object} options - 配置选项
 * @returns {IStorage} 存储实例
 */
export function createStorage(type, options = {}) {
  switch (type) {
    case 'memory':
      return new MemoryStorage();
    case 'indexeddb':
      return new IndexedDBStorage();
    default:
      throw new Error(`Storage type '${type}' is not implemented yet`);
  }
}