#!/usr/bin/env bash
set -u
set -o pipefail

trap 'echo; echo "已终止."; exit 0' INT TERM

# 定义需要并发执行的目录列表
# 请根据实际项目结构修改这里的目录路径
DIRS=(
  "src/module_a"
  "src/module_b"
  "src/module_c"
)

while true; do
  echo "===================="
  echo "$(date '+%F %T') 开始并发执行 iflow 任务"
  echo "===================="

  # 遍历目录列表，在后台并发执行
  for dir in "${DIRS[@]}"; do
    (
      # 检查目录是否存在，不存在则跳过
      if [[ -d "$dir" ]]; then
        echo ">>> [Start] 进入目录: $dir"
        # 进入子目录执行
        cd "$dir"
        
        # 执行 iflow 任务 (保持原命令不变)
        iflow "这个项目是基于OpenClaw开发的NewClaw，修改一下项目里面各个地方的名称 think:high" --yolo || true
        iflow "确保这个项目的各个功能都可以在Linux上正常使用，不要删除这个项目的功能 think:high" --yolo || true
        
        echo "<<< [Done] 完成目录: $dir"
      else
        echo "!!! [Skip] 目录不存在: $dir"
      fi
    ) &
  done

  # 等待所有后台作业完成
  wait

  echo "🔁 所有并发任务已完成，重新开始循环..."
  sleep 1
done