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
      // 尝试获取 storage 服务，如果不存在则尝试 data 服务
      let dataService;
      try {
        dataService = ctx.get('storage');
      } catch (e) {
        try {
          dataService = ctx.get('data');
        } catch (e2) {
          throw new Error('Neither "storage" nor "data" service is registered');
        }
      }
      
      if (typeof dataService.getData !== 'function') {
        throw new Error('Data service must have a getData method');
      }
      
      dataSource = dataService.getData(from);
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
  
  // 添加 live 方法 - 用于订阅查询结果的变化
  query.live = function(options, callback) {
    // 验证输入参数
    if (!options) {
      throw new Error('Live query requires options parameter');
    }
    
    if (!callback || typeof callback !== 'function') {
      throw new Error('Live query requires callback function');
    }
    
    const { from, where } = options;
    
    if (!from) {
      throw new Error('Live query requires "from" parameter');
    }
    
    // 获取初始查询结果
    const initialResult = query(options);
    
    // 调用回调函数，传入初始结果
    callback(initialResult);
    
    // 创建订阅对象
    const subscription = {
      // 查询选项
      options,
      
      // 回调函数
      callback,
      
      // 当前结果
      currentResult: initialResult,
      
      // 取消订阅方法
      unsubscribe: function() {
        try {
          const eventService = ctx.get('events');
          if (eventService && typeof eventService.unsubscribe === 'function') {
            eventService.unsubscribe(this);
          }
        } catch (e) {
          // 如果事件服务不存在，只是警告
          console.warn('Event service not available, unsubscribe operation is a no-op');
        }
      },
      
      // 更新方法，当数据变化时调用
      update: function() {
        const newResult = query(this.options);
        
        // 只有结果发生变化时才通知
        if (!resultsEqual(this.currentResult, newResult)) {
          this.currentResult = newResult;
          this.callback(newResult);
        }
      }
    };
    
    // 尝试订阅数据变化事件
    try {
      const eventService = ctx.get('events');
      if (eventService && typeof eventService.subscribe === 'function') {
        eventService.subscribe(from, subscription);
      }
    } catch (e) {
      // 如果事件服务不存在，只是警告
      console.warn('Event service not available, live query will not update automatically');
    }
    
    // 返回订阅对象
    return subscription;
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

/**
 * 比较两个查询结果是否相等
 * @param {Array} result1 - 第一个结果
 * @param {Array} result2 - 第二个结果
 * @returns {Boolean} 是否相等
 */
function resultsEqual(result1, result2) {
  // 如果引用相同，直接返回 true
  if (result1 === result2) {
    return true;
  }
  
  // 如果一个是数组另一个不是，返回 false
  if (Array.isArray(result1) !== Array.isArray(result2)) {
    return false;
  }
  
  // 如果长度不同，返回 false
  if (result1.length !== result2.length) {
    return false;
  }
  
  // 比较每个元素（简单比较）
  for (let i = 0; i < result1.length; i++) {
    if (result1[i] !== result2[i]) {
      return false;
    }
  }
  
  return true;
}

// 默认导出查询引擎创建函数
export default createQueryEngine;