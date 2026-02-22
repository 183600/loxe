#!/bin/bash
# ==========================================
# 脚本一：14库并行调度脚本 (Bun + iFlow)
# 使用 GNU Parallel 并发调用脚本二
# ==========================================

set -euo pipefail

# ==========================================
# 配置区域
# ==========================================

# 工作目录（项目根目录）
PROJECT_ROOT="${PROJECT_ROOT:-/data/data/com.termux/files/home/Valt}"

# 14个库目录
PACKAGES=(
  "core"
  "storage"
  "schema"
  "query"
  "sync"
  "security"
  "event"
  "cache"
  "logger"
  "config"
  "validation"
  "router"
  "middleware"
  "utils"
)

# 构建并行执行的命令数组
DIRS=()
CMDS=()

for pkg in "${PACKAGES[@]}"; do
  DIRS+=("${PROJECT_ROOT}")
  CMDS+=("bash ${PROJECT_ROOT}/scripts/iflow_pkg_loop.sh PKG=${pkg} > ${PROJECT_ROOT}/packages/${pkg}/${pkg}.log 2>&1")
done

# 并发控制
JOB_LIMIT="${JOB_LIMIT:-14}"

# 最大循环次数（传递给脚本二）
MAX_LOOPS="${MAX_LOOPS:-10}"

# ==========================================
# 进程清理与信号处理
# ==========================================

CLEANUP_FLAG="/tmp/iflow_cleanup_$$.flag"
MAIN_PID=$$

touch "$CLEANUP_FLAG"

cleanup_all_processes() {
  echo -e "\n\n========================================="
  echo "[中断信号] 收到终止请求，正在彻底清理所有进程..."
  echo "========================================="
  
  # 设置清理标志
  echo "1" > "$CLEANUP_FLAG"
  
  # 发送 SIGTERM
  pkill -TERM -f "iflow_pkg_loop" 2>/dev/null || true
  pkill -TERM -P $$ 2>/dev/null || true
  sleep 1
  
  # 强制杀死顽固进程
  echo "正在强制终止残留进程..."
  pkill -9 -f "iflow_pkg_loop" 2>/dev/null || true
  pkill -9 -P $$ 2>/dev/null || true
  
  # 清理标志文件
  rm -f "$CLEANUP_FLAG"
  
  echo "========================================="
  echo "清理完成，脚本已终止"
  echo "========================================="
  exit 130
}

trap cleanup_all_processes SIGINT SIGTERM SIGHUP

# ==========================================
# 核心执行函数
# ==========================================

run_job() {
  local dir="$1"
  local cmd="$2"
  local job_id="$3"
  
  # 检查清理标志
  if [ -f "$CLEANUP_FLAG" ] && [ "$(cat "$CLEANUP_FLAG")" = "1" ]; then
    echo "[Job $job_id] 检测到清理信号，立即退出"
    return 143
  fi
  
  # 进入目录
  cd "$dir" || return 1
  
  # 加载环境变量
  if [ -f ~/.bashrc ]; then
    source ~/.bashrc 2>/dev/null || true
  fi
  
  # 设置 Bun 路径
  if [ -d "$HOME/.bun/bin" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  
  # 设置 pnpm 路径（iflow CLI 可能需要）
  if [ -d "$HOME/.local/share/pnpm" ]; then
    export PATH="$HOME/.local/share/pnpm:$PATH"
  fi
  
  # 设置环境变量
  export MAX_LOOPS="${MAX_LOOPS:-10}"
  export NODE_OPTIONS="--max-old-space-size=4096"
  
  # 执行命令
  (
    trap 'exit 143' SIGINT SIGTERM
    if [ -f "$CLEANUP_FLAG" ] && [ "$(cat "$CLEANUP_FLAG")" = "1" ]; then
      exit 143
    fi
    eval "$cmd"
  )
  
  local exit_code=$?
  
  if [ $exit_code -eq 130 ] || [ $exit_code -eq 143 ] || [ $exit_code -eq 137 ]; then
    return $exit_code
  fi
  
  return $exit_code
}

export -f run_job
export CLEANUP_FLAG
export MAIN_PID
export MAX_LOOPS

# ==========================================
# 执行逻辑
# ==========================================

cd "$PROJECT_ROOT" || exit 1

if ! command -v parallel &>/dev/null; then
  echo "错误: 未检测到 GNU Parallel。请先安装。"
  echo "在 Ubuntu/Debian: sudo apt-get install parallel"
  echo "在 Termux: pkg install parallel"
  exit 1
fi

echo "========================================="
echo "🚀 使用 GNU Parallel 开始并行执行..."
echo "📂 项目根目录: $PROJECT_ROOT"
echo "📦 包数量: ${#PACKAGES[@]}"
echo "🔄 每包最大循环: $MAX_LOOPS"
echo "⚡ 最大并发任务数: $JOB_LIMIT"
echo "📝 按 Ctrl+C 可以中断并彻底清理所有进程"
echo "========================================="
echo "📦 包列表: ${PACKAGES[*]}"
echo "========================================="

# 使用 parallel 并发执行
parallel --jobs "${JOB_LIMIT}" \
  --tag \
  --line-buffer \
  --joblog /tmp/iflow_14pkgs_log_$$.txt \
  --resume-failed \
  run_job {1} {2} {#} \
  ::: "${DIRS[@]}" \
  :::+ "${CMDS[@]}"

PARALLEL_EXIT=$?

# 清理标志文件
rm -f "$CLEANUP_FLAG"

echo "========================================="
if [ $PARALLEL_EXIT -eq 0 ]; then
  echo "✅ 所有任务执行完毕。"
elif [ $PARALLEL_EXIT -eq 130 ] || [ $PARALLEL_EXIT -eq 143 ]; then
  echo "⚠️ 任务被用户中断。"
else
  echo "❌ 任务执行异常，退出码: $PARALLEL_EXIT"
fi
echo "========================================="

exit $PARALLEL_EXIT
