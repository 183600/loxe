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
 * 存储工厂函数
 * @param {string} type - 存储类型
 * @param {Object} options - 配置选项
 * @returns {IStorage} 存储实例
 */
export function createStorage(type, options = {}) {
  // 这里将通过 ctx.get('xxx') 调用其他库的能力
  // 目前只定义接口，具体实现在后续任务中
  throw new Error(`Storage type '${type}' is not implemented yet`);
}