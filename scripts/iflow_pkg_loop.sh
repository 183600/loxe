#!/bin/bash
# ==========================================
# 脚本二：单库维护脚本 (Bun + iFlow)
# 使用 Bun test runner 进行测试
# ==========================================

set -euo pipefail

# 包名参数
: "${PKG:?PKG is required (e.g., storage|schema|query|...)}"

# 工作分支
WORK_BRANCH="${WORK_BRANCH:-main}"

# 最大循环次数
MAX_LOOPS="${MAX_LOOPS:-10}"

# 包路径
PKG_PATH="packages/${PKG}"

# 添加 Bun 路径
export PATH="$HOME/.bun/bin:$PATH"

# 循环计数器
count=0

# 检查包目录是否存在
if [ ! -d "$PKG_PATH" ]; then
  echo "❌ 包目录不存在: $PKG_PATH"
  exit 1
fi

echo "========================================="
echo "📦 开始维护包: @lfde/${PKG}"
echo "📍 路径: $PKG_PATH"
echo "🔄 最大循环: $MAX_LOOPS"
echo "========================================="

while [ $count -lt $MAX_LOOPS ]; do
  echo "========================================="
  echo "🔄 循环次数: $((count + 1)) / $MAX_LOOPS"
  echo "========================================="

  # 1. 运行测试
  echo "🧪 正在运行测试..."
  cd "$PKG_PATH"
  
  if bun test 2>&1; then
    echo "✅ 测试通过"
    
    # 2. Git 提交
    if ! git diff --quiet && ! git diff --cached --quiet; then
      echo "📝 正在提交代码..."
      git add .
      git commit -m "feat(${PKG}): 代码测试通过，准备生成新测试"
    else
      echo "ℹ️ 当前没有代码变更需要提交。"
    fi

    # 3. 调用 iflow 生成新测试
    echo "🤖 正在调用 iflow 生成新测试..."
    iflow "生成新的测试用例，使用 Bun test runner。只修改 packages/${PKG}/ 目录下的文件。think:high" --yolo || true
    
  else
    echo "❌ 测试失败，进入修复流程..."
    
    # 4. 循环修复
    while true; do
      echo "🔧 尝试修复代码..."
      
      # 捕获测试错误输出
      TEST_ERROR_OUTPUT=$(bun test 2>&1 || true)
      echo "📋 捕获到错误: ${TEST_ERROR_OUTPUT:0:500}..."
      
      # 调用 iflow 修复
      iflow "只在 packages/${PKG}/ 下修复测试失败的问题。不要修改其他包。一次修复所有错误。
Errors to fix:
${TEST_ERROR_OUTPUT}
think:high" --yolo || true
      
      # 修复后再次运行测试
      echo "🧪 修复后重新运行测试..."
      
      if bun test 2>&1; then
        echo "✅ 修复成功，测试通过"
        
        # Git 提交
        if ! git diff --quiet && ! git diff --cached --quiet; then
          echo "📝 正在提交修复后的代码..."
          git add .
          git commit -m "fix(${PKG}): 修复代码并通过测试"
        fi
        
        # 生成新测试
        echo "🤖 修复成功，正在生成新测试..."
        iflow "生成新的测试用例，使用 Bun test runner。只修改 packages/${PKG}/ 目录下的文件。think:high" --yolo || true
        
        break
      else
        echo "⚠️ 修复失败或仍有问题，再次尝试..."
        sleep 1
      fi
    done
  fi

  # 返回根目录
  cd - > /dev/null
  
  # 更新计数器
  count=$((count + 1))
  
  # 休眠
  sleep 1
done

echo "========================================="
echo "✅ 脚本执行结束: @lfde/${PKG}"
echo "========================================="
