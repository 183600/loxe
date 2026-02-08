# LFDE — Local-First Data Engine（本地优先的全能数据引擎）

一个面向应用的“客户端数据平台”工程化骨架：**极小 Core + 5 个可独立演进的库**。目标覆盖（逐步实现）：离线优先、实时同步、权限控制、查询引擎、端到端加密，并支持多存储后端与插件生态。

> 目前仓库定位：**架构/脚手架 + 可自动迭代的 GitHub Actions 流水线**。复杂能力将由 5 个库逐步扩展。

---

## 特性（设计目标）

- **Local-First**：本地读写优先，网络同步是可选增强
- **分层架构**：Core 极小，仅负责装配/生命周期/事件总线
- **可替换后端**：存储（IndexedDB/SQLite/OPFS）、同步（WS/WebRTC/HTTP）等均可替换
- **库间互调但低耦合**：库不互相 `import`，通过 `ctx.get('service')` 互相调用
- **自动化增长**：GitHub Actions 中调用 iFlow CLI 自动修复测试、补充测试用例

---

## Monorepo 包结构

```
packages/
  core/       # @lfde/core     极小内核：Kernel/Engine/事件总线/服务定位
  storage/    # @lfde/storage  存储引擎（IndexedDB/SQLite/OPFS 的统一抽象）
  schema/     # @lfde/schema   Schema / 迁移 / 校验
  query/      # @lfde/query    查询/索引/LiveQuery（响应式查询）
  sync/       # @lfde/sync     基于 CRDT 的同步协议 + 多传输
  security/   # @lfde/security ABAC 权限 + E2E 加密
scripts/
  iflow_js_loop.sh            # 在 Actions 里循环：test -> fix/add tests -> commit
.github/workflows/
  iflow-autoloop-js.yml       # Actions：安装依赖/跑循环脚本/推送提交与 tag
```

---

## Core 设计（极小但可扩展）

Core（`@lfde/core`）提供：

- `createKernel({ factories, config })`
  - `ctx.get(name)`：按需构建并缓存服务实例（支持库间互调）
  - `ctx.on/ctx.emit`：事件总线，用于解耦跨库消息
  - `start/stop`：生命周期管理
- `createEngine(options)`
  - 默认装配 5 个库：`storage/schema/security/query/sync`
  - 通过 getter 暴露：`engine.storage` / `engine.query` 等

> 核心原则：**复杂能力全部放在 5 个库里**，Core 永远保持“小而稳定”。

---

## 快速开始（本地开发）

### 环境要求
- Node.js >= 22
- 推荐 pnpm（也支持 npm workspaces）

### 安装依赖
```bash
pnpm install
# 或 npm install
```

### 运行测试
```bash
pnpm -r test
# 或 npm -ws test
```

### 使用示例（概念）
```js
import { createEngine } from '@lfde/core'

const db = createEngine({
  config: { appId: 'demo' },
  storage: { adapter: 'indexeddb' },
})

await db.start()

await db.storage.put('notes', 'n1', { title: 'hello', body: 'world' })
const rows = await db.query.query({ from: 'notes', where: { title: 'hello' } })

await db.sync.connect({ url: 'wss://example.com/sync' })

await db.stop()
```

---

## 库间互相调用（关键机制）

每个库在构造时都会收到同一个 `ctx`：

- `ctx.get('storage')`：获取存储服务
- `ctx.get('security')`：获取安全服务
- `ctx.emit('event', payload)` / `ctx.on('event', handler)`：跨库通信

示例（概念）：`sync` 在落盘前调用 `security.encrypt()`，再调用 `storage.put()`。

---

## GitHub Actions：iFlow 自动迭代

仓库内置了自动循环脚本与工作流：

- 工作流：`.github/workflows/iflow-autoloop-js.yml`
- 循环脚本：`scripts/iflow_js_loop.sh`

行为概述：
1. 安装依赖
2. 反复执行 `test`
3. 若测试失败：调用 `iflow` 修复
4. 若测试通过：调用 `iflow` 增加少量测试（不超过 10 个），并提交
5. 可选：满足条件时自动 bump 版本并打 tag（7 天窗口）

### 需要配置的 Secrets（GitHub 仓库 Settings → Secrets）
必需：
- `IFLOW_API_KEY`：iFlow API Key
- `IFLOW_PAT`：用于 checkout/push 的 PAT（若默认 token 权限不足）

可选：
- `GITEE_REMOTE_URL`：需要同步到 Gitee 时配置

---

## 约定（建议）

- 包统一使用 ESM（`"type": "module"`）
- 每个库提供 `createX(ctx, options)` 工厂函数
- 对外 API 尽量稳定，内部实现可快速迭代
- 单测优先：所有“自动增长”以 tests 作为约束边界

---

## Roadmap（建议的实现阶段）

1. **MVP 可运行**：
   - storage：IndexedDB adapter + 内存 fallback
   - schema：简单 schema 注册/校验
   - query：基本过滤/排序 + 最小 live query
   - sync：最小 WS 同步骨架（先不做完整 CRDT）
   - security：ABAC 最小实现 + 简化加密接口（可先 stub）
2. **可用性增强**：
   - 索引、查询优化
   - 增量同步、快照、压缩
   - E2E 密钥轮换、设备管理
3. **生态**：
   - React/Vue/Svelte bindings
   - DevTools（可视化查询、同步状态、权限调试）

---

## License

TBD（建议使用 Apache-2.0 或 MIT，视商业化策略选择）
