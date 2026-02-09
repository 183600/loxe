#!/usr/bin/env bash
set -euo pipefail
set -o pipefail

WORK_BRANCH="${WORK_BRANCH:-main}"
RUN_ONCE="${RUN_ONCE:-0}"          # 1=只跑一轮(遍历5包一次)
SLEEP_BETWEEN="${SLEEP_BETWEEN:-1}"

PACKAGES=(storage schema query sync security)

# 只允许改动的路径：packages/<pkg>/**
# 如确需允许额外路径（不建议），可通过环境变量扩展（空格分隔前缀）
EXTRA_ALLOW_PREFIXES="${EXTRA_ALLOW_PREFIXES:-}"

detect_pm() {
  if [[ -f "pnpm-lock.yaml" ]]; then echo "pnpm"; return 0; fi
  if [[ -f "package-lock.json" ]]; then echo "npm"; return 0; fi
  echo "pnpm"
}

pm_install() {
  local pm="$1"
  if [[ "$pm" == "pnpm" ]]; then
    corepack enable >/dev/null 2>&1 || true
    pnpm -v
    pnpm install --frozen-lockfile=false
  else
    npm -v
    npm ci || npm install
  fi
}

pkg_test_cmd() {
  local pm="$1"
  local pkg="$2"

  # 允许外部覆盖（printf 模板：用 %s 放包名）
  if [[ -n "${TEST_CMD_TEMPLATE:-}" ]]; then
    printf "$TEST_CMD_TEMPLATE" "$pkg"
    return 0
  fi

  if [[ "$pm" == "pnpm" ]]; then
    printf 'pnpm --filter "./packages/%s" test' "$pkg"
  else
    # npm workspace 用法：--workspace <path>
    printf 'npm --workspace "./packages/%s" test' "$pkg"
  fi
}

first_error_snippet() {
  # 从测试日志中截取“第一个失败/第一个 error”附近内容，给 iflow 做单 bug 修复输入
  local log="$1"
  [[ -f "$log" ]] || return 0

  # 优先截取 vitest/jest 常见 FAIL 块；否则截取第一个 error/fatal
  if grep -nE '^ FAIL ' "$log" >/dev/null 2>&1; then
    local start
    start="$(grep -nE '^ FAIL ' "$log" | head -n1 | cut -d: -f1)"
    sed -n "${start},$((start+120))p" "$log"
    return 0
  fi

  if grep -nE '(error:|Error:|fatal:|FATAL:|panic:|Exception)' "$log" >/dev/null 2>&1; then
    local start
    start="$(grep -nE '(error:|Error:|fatal:|FATAL:|panic:|Exception)' "$log" | head -n1 | cut -d: -f1)"
    sed -n "${start},$((start+80))p" "$log"
    return 0
  fi

  tail -n 120 "$log"
}

next_plan_item() {
  local plan="$1"
  [[ -f "$plan" ]] || return 0
  # 取第一个未完成 checkbox 的文本
  awk '
    /^\s*-\s*\[\s\]\s+/ {
      sub(/^\s*-\s*\[\s\]\s+/, "", $0);
      print $0;
      exit 0
    }
  ' "$plan" || true
}

enforce_one_pkg_only() {
  local pkg="$1"
  local allow_prefix="packages/${pkg}/"
  local bad=0

  # 列出所有变更文件（含未暂存）
  local files
  files="$(git status --porcelain | awk '{print $2}' || true)"
  [[ -z "$files" ]] && return 0

  while IFS= read -r f; do
    [[ -z "$f" ]] && continue

    # 允许：packages/<pkg>/**
    if [[ "$f" == "$allow_prefix"* ]]; then
      continue
    fi

    # 允许额外白名单前缀（不建议，默认空）
    local ok=0
    for p in $EXTRA_ALLOW_PREFIXES; do
      if [[ "$f" == "$p"* ]]; then ok=1; break; fi
    done
    [[ "$ok" -eq 1 ]] && continue

    echo "⛔ 越界改动：$f （本轮只允许改 packages/${pkg}/）"
    bad=1
  done <<< "$files"

  if [[ "$bad" -eq 1 ]]; then
    echo "↩︎ 回滚越界文件..."
    # 逐个回滚越界文件，保留允许范围内改动
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      if [[ "$f" != "$allow_prefix"* ]]; then
        local ok=0
        for p in $EXTRA_ALLOW_PREFIXES; do
          if [[ "$f" == "$p"* ]]; then ok=1; break; fi
        done
        [[ "$ok" -eq 1 ]] && continue
        git restore --worktree --staged -- "$f" || true
      fi
    done <<< "$files"
  fi
}

run_iflow_impl_one_item() {
  local pkg="$1"
  local plan_item="$2"

  pushd "packages/${pkg}" >/dev/null

  # 在包目录执行 iflow，强约束“只改当前包”
  iflow "$(cat <<EOF
你在一个 JS/ESM monorepo 的 packages/${pkg} 包内工作。

目标：只实现 PLAN.md 中“下一个未完成事项”（本次只做这一件事）：
- 计划项：${plan_item}

硬性约束：
1) 本轮只允许修改 packages/${pkg}/ 下的文件；不要改其他包、不要改根目录配置。
2) 修改后请同步更新本包的 PLAN.md：把这一条从 [ ] 改成 [x]（只勾这一条）。
3) 为本包补充必要的 vitest 测试（少量即可），并确保本包测试通过。
4) 若需要依赖另一个库的能力，请通过 ctx.get('xxx') 进行调用（不要直接 import 其他包源码）。

think:high
EOF
)" --yolo

  popd >/dev/null
}

run_iflow_debug_one_bug() {
  local pkg="$1"
  local snippet="$2"

  pushd "packages/${pkg}" >/dev/null

  iflow "$(cat <<EOF
你在调试 JS/ESM monorepo 的 packages/${pkg} 包。

要求：本次 iflow 调用只修一个 bug —— 只处理下面日志片段中“第一个失败/第一个 error”对应的问题，其他失败留到下一轮。

你可以在调试时：
- 添加少量 console.log/console.error 日志
- 必要时添加 debugger 断点（但提交前尽量移除或改为受控调试，不要污染输出）

硬性约束：
1) 本轮只允许修改 packages/${pkg}/ 下的文件；不要改其他包、不要改根目录配置。
2) 不要删除现有测试；可以补充测试来覆盖修复。
3) 修复后确保 packages/${pkg} 的测试通过。

日志片段：
----------------
${snippet}
----------------

think:high
EOF
)" --yolo

  popd >/dev/null
}

commit_pkg_if_changed() {
  local pkg="$1"
  git add "packages/${pkg}" || true
  if git diff --cached --quiet; then
    echo "ℹ️ packages/${pkg} 没有可提交的变更"
    return 0
  fi
  git commit -m "chore(${pkg}): iterate one step" || true
}

pm="$(detect_pm)"
echo "📦 package manager: $pm"
pm_install "$pm"

round=0
while true; do
  round=$((round+1))
  echo "===================="
  echo "Round #$round"
  echo "===================="

  for pkg in "${PACKAGES[@]}"; do
    echo
    echo "---- package: $pkg ----"

    plan_file="packages/${pkg}/PLAN.md"
    if [[ ! -f "$plan_file" ]]; then
      echo "❌ 缺少 ${plan_file}（每个库必须有 PLAN.md）"
      exit 1
    fi

    test_log="$(mktemp -t "iflow_${pkg}_test_XXXX.log")"
    cmd="$(pkg_test_cmd "$pm" "$pkg")"
    echo "🧪 Test cmd: $cmd"

    set +e
    bash -lc "$cmd" 2>&1 | tee "$test_log"
    ts="${PIPESTATUS[0]:-1}"
    set -e

    if [[ "$ts" -ne 0 ]]; then
      echo "❌ 测试失败：进入单 bug 修复"
      snippet="$(first_error_snippet "$test_log")"
      run_iflow_debug_one_bug "$pkg" "$snippet"
      enforce_one_pkg_only "$pkg"

      # 再跑一次测试
      set +e
      bash -lc "$cmd" 2>&1 | tee "$test_log"
      ts2="${PIPESTATUS[0]:-1}"
      set -e

      if [[ "$ts2" -eq 0 ]]; then
        echo "✅ 修复后测试通过：提交本包变更"
        enforce_one_pkg_only "$pkg"
        commit_pkg_if_changed "$pkg"
      else
        echo "❌ 修复后仍失败：留到下一轮（确保一次 iflow 只修一个 bug）"
        enforce_one_pkg_only "$pkg"
      fi

      continue
    fi

    # 测试通过：推进一个 plan item
    item="$(next_plan_item "$plan_file")"
    if [[ -z "${item:-}" ]]; then
      echo "ℹ️ ${pkg} 的 PLAN.md 没有未完成项，跳过"
      continue
    fi

    echo "📌 Next plan item: $item"
    run_iflow_impl_one_item "$pkg" "$item"
    enforce_one_pkg_only "$pkg"

    # 跑测试验证
    set +e
    bash -lc "$cmd" 2>&1 | tee "$test_log"
    ts3="${PIPESTATUS[0]:-1}"
    set -e

    if [[ "$ts3" -eq 0 ]]; then
      echo "✅ 实现计划项后测试通过：提交本包变更"
      enforce_one_pkg_only "$pkg"
      commit_pkg_if_changed "$pkg"
    else
      echo "❌ 实现后测试失败：下一轮先单 bug 修复（本轮不再追加 iflow 调用）"
      enforce_one_pkg_only "$pkg"
    fi
  done

  [[ "$RUN_ONCE" == "1" ]] && exit 0
  sleep "$SLEEP_BETWEEN"
done
