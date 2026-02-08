#!/usr/bin/env bash
set -u
set -o pipefail

WORK_BRANCH="${WORK_BRANCH:-main}"
RUN_ONCE="${RUN_ONCE:-0}"                  # 设为 1 可只跑一轮
TEST_LOG="${TEST_LOG:-/tmp/iflow_js_last.log}"

# marker 文件放到真实 git dir 里，避免被 git add
GIT_DIR_REAL="$(git rev-parse --git-dir 2>/dev/null || echo ".git")"
RELEASE_MARKER_FILE="${RELEASE_MARKER_FILE:-${GIT_DIR_REAL%/}/iflow_release_tag}"
RELEASE_WINDOW_SECONDS="${RELEASE_WINDOW_SECONDS:-604800}"  # 7 天

detect_pm() {
  if [[ -f "pnpm-lock.yaml" ]]; then echo "pnpm"; return 0; fi
  if [[ -f "package-lock.json" ]]; then echo "npm"; return 0; fi
  echo "pnpm"
}

pm_run_install() {
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

pm_run_test() {
  local pm="$1"
  local cmd="${TEST_CMD:-}"
  if [[ -n "$cmd" ]]; then
    bash -lc "$cmd"
    return $?
  fi

  # 默认：跑 workspace tests；如果你不是 monorepo，可把 TEST_CMD 设置为 "npm test"
  if [[ "$pm" == "pnpm" ]]; then
    pnpm -r test
  else
    npm -ws test
  fi
}

has_error_in_log() {
  local log="$1"
  [[ -f "$log" ]] || return 1
  grep -Eiq '(^|[^[:alpha:]])(error:|fatal:|panic:|exception:)([^[:alpha:]]|$)' "$log"
}

extract_version() {
  node -pe "require('./package.json').version" 2>/dev/null || true
}

latest_release_age_ok() {
  command -v gh >/dev/null 2>&1 || return 1
  [[ -n "${GITHUB_REPOSITORY:-}" ]] || return 1
  if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
    return 1
  fi

  local published_at pub_ts now_ts delta
  published_at="$(gh api "/repos/${GITHUB_REPOSITORY}/releases/latest" --jq '.published_at' 2>/dev/null || true)"
  if [[ -z "${published_at:-}" || "${published_at}" == "null" ]]; then
    return 0
  fi

  pub_ts="$(date -d "$published_at" +%s 2>/dev/null || echo 0)"
  now_ts="$(date +%s)"
  [[ "$pub_ts" -gt 0 ]] || return 1

  delta=$(( now_ts - pub_ts ))
  (( delta >= RELEASE_WINDOW_SECONDS ))
}

attempt_bump_and_tag() {
  [[ "${GITHUB_ACTIONS:-}" == "true" ]] || return 0
  [[ -f "$RELEASE_MARKER_FILE" ]] && return 0
  latest_release_age_ok || return 0

  git fetch --tags --force >/dev/null 2>&1 || true

  local old_ver new_ver tag
  old_ver="$(extract_version)"
  echo "ℹ️ 当前版本：${old_ver:-<unknown>}"

  # 用 iflow bump 根 package.json 的 version（只改 version 字段）
  iflow '把根目录 package.json 的 version 字段做一次 patch bump（例如 0.1.2 -> 0.1.3），只修改 version 字段，不要修改其他文件。think:high' --yolo || return 0

  git add -A
  new_ver="$(extract_version)"
  echo "ℹ️ bump 后版本：${new_ver:-<unknown>}"
  [[ -n "${new_ver:-}" && "${new_ver}" != "${old_ver}" ]] || return 0

  if git diff --cached --quiet; then
    return 0
  fi

  git commit -m "chore(release): v${new_ver}" || return 0
  tag="v${new_ver}"

  if ! git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
    git tag -a "${tag}" -m "${tag}" || return 0
  fi

  mkdir -p "$(dirname -- "$RELEASE_MARKER_FILE")"
  printf '%s\n' "${tag}" > "$RELEASE_MARKER_FILE"
  echo "✅ 已准备发布：${tag}"
}

trap 'echo; echo "已终止."; exit 0' INT TERM

pm="$(detect_pm)"
echo "📦 package manager: $pm"

# 依赖安装（只做一次）
pm_run_install "$pm"

while true; do
  echo "===================="
  echo "$(date '+%F %T') 运行测试"
  echo "===================="

  : > "$TEST_LOG"

  set +e
  pm_run_test "$pm" 2>&1 | tee "$TEST_LOG"
  ps=("${PIPESTATUS[@]}")
  TEST_STATUS="${ps[0]:-255}"
  set -e

  HAS_ERROR=0
  if has_error_in_log "$TEST_LOG"; then HAS_ERROR=1; fi

  if [[ "$TEST_STATUS" -eq 0 ]]; then
    # ✅ 测试通过：让 iflow 少量加测试（控制增长）
    iflow '为这个 JS monorepo 增加一些 vitest 测试用例（总新增不超过10个），优先覆盖核心逻辑与 5 个库的基本交互，避免改动实现代码。think:high' --yolo || true

    git add -A
    if git diff --cached --quiet; then
      echo "ℹ️ 没有变化可提交"
    else
      git commit -m "ci: tests pass (auto)" || true
    fi

    if [[ "$HAS_ERROR" -eq 0 ]]; then
      attempt_bump_and_tag || true
    fi
  else
    echo "❌ 测试失败，调用 iflow 修复..."
    iflow '解决当前 pnpm/npm test 的所有失败（忽略 warning），尽量只改实现代码，不要删除测试；如需可添加少量日志帮助定位，但不要引入重依赖或大量 CPU/内存消耗。think:high' --yolo || true
  fi

  [[ "$RUN_ONCE" == "1" ]] && exit 0
  echo "🔁 下一轮..."
  sleep 1
done
