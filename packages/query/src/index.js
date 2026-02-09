/**
 * 基本查询引擎实现
 * 支持 query({from, where}) 过滤功能
 */

/**
 * 创建查询函数
 * @param {Object} ctx - 上下文对象，用于访问其他服务
 * @returns {Function} 查询函数
 */
export function createQueryEngine(ctx) {
  const query = function query(options) {
    const { from, where } = options;
    
    // 验证输入参数
    if (!from) {
      throw new Error('Query requires "from" parameter');
    }
    
    // 获取数据源
    let dataSource;
    if (typeof from === 'string') {
      // 如果是从其他服务获取数据
      const storageService = ctx.get('storage');
      dataSource = storageService.getData(from);
    } else if (Array.isArray(from)) {
      // 如果直接传入数组数据
      dataSource = from;
    } else {
      throw new Error('"from" must be a string (data source name) or an array');
    }
    
    // 如果没有过滤条件，直接返回数据
    if (!where) {
      return dataSource;
    }
    
    // 应用过滤条件
    return filterData(dataSource, where);
  };
  
  // 添加 compile 方法 - 用于编译查询优化
  query.compile = function(options) {
    const { from, where } = options;
    
    // 验证输入参数
    if (!from) {
      throw new Error('Compile requires "from" parameter');
    }
    
    // 占位实现：返回编译后的查询函数
    // 实际实现应该包含查询优化逻辑
    return function() {
      return query(options);
    };
  };
  
  // 添加 ensureIndex 方法 - 用于确保索引存在
  query.ensureIndex = function(dataSource, fields) {
    // 验证输入参数
    if (!dataSource) {
      throw new Error('ensureIndex requires "dataSource" parameter');
    }
    
    if (!fields || !Array.isArray(fields) || fields.length === 0) {
      throw new Error('ensureIndex requires "fields" array parameter');
    }
    
    // 占位实现：通过上下文调用索引服务
    // 实际实现应该创建或验证索引
    try {
      const indexService = ctx.get('index');
      if (indexService && typeof indexService.ensureIndex === 'function') {
        return indexService.ensureIndex(dataSource, fields);
      }
    } catch (e) {
      // 如果索引服务不存在，返回占位结果
      console.warn('Index service not available, index operation is a placeholder');
    }
    
    // 占位返回值
    return {
      dataSource,
      fields,
      created: false,
      message: 'Index placeholder - no actual index created'
    };
  };
  
  return query;
}

/**
 * 根据条件过滤数据
 * @param {Array} data - 要过滤的数据数组
 * @param {Object|Function} where - 过滤条件
 * @returns {Array} 过滤后的数据
 */
function filterData(data, where) {
  if (!Array.isArray(data)) {
    return [];
  }
  
  if (typeof where === 'function') {
    // 如果 where 是函数，直接使用它过滤
    return data.filter(where);
  }
  
  if (typeof where === 'object' && where !== null) {
    // 如果 where 是对象，构建过滤函数
    return data.filter(item => matchesCondition(item, where));
  }
  
  // 其他情况返回空数组
  return [];
}

/**
 * 检查项目是否匹配条件
 * @param {Object} item - 要检查的数据项
 * @param {Object} condition - 条件对象
 * @returns {Boolean} 是否匹配
 */
function matchesCondition(item, condition) {
  for (const [key, value] of Object.entries(condition)) {
    if (!evaluateCondition(item[key], value)) {
      return false;
    }
  }
  return true;
}

/**
 * 评估单个条件
 * @param {*} itemValue - 数据项中的值
 * @param {*} conditionValue - 条件值
 * @returns {Boolean} 是否满足条件
 */
function evaluateCondition(itemValue, conditionValue) {
  // 如果条件值是对象，可能包含操作符
  if (typeof conditionValue === 'object' && conditionValue !== null && !Array.isArray(conditionValue)) {
    for (const [operator, operand] of Object.entries(conditionValue)) {
      switch (operator) {
        case '$eq':
          if (itemValue !== operand) return false;
          break;
        case '$ne':
          if (itemValue === operand) return false;
          break;
        case '$gt':
          if (itemValue <= operand) return false;
          break;
        case '$gte':
          if (itemValue < operand) return false;
          break;
        case '$lt':
          if (itemValue >= operand) return false;
          break;
        case '$lte':
          if (itemValue > operand) return false;
          break;
        case '$in':
          if (!Array.isArray(operand) || !operand.includes(itemValue)) return false;
          break;
        case '$nin':
          if (Array.isArray(operand) && operand.includes(itemValue)) return false;
          break;
        default:
          throw new Error(`Unsupported operator: ${operator}`);
      }
    }
    return true;
  }
  
  // 简单相等比较
  return itemValue === conditionValue;
}

// 默认导出查询引擎创建函数
export default createQueryEngine;