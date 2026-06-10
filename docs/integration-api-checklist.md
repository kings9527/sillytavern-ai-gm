# AI-GM 集成接口清单

日期: 2026-06-10  
来源: `src/middleware/` + `src/endpoints/tokenizers.js` + `src/endpoints/worldinfo.js` + `src/server-main.js`  
状态: 只读分析，未修改 ST 代码

---

## 一、认证与安全层（必须复用）

| # | 机制 | 来源文件 | 接口/配置 | 优先级 | AI-GM 动作 |
|---|------|----------|-----------|--------|------------|
| 1 | **Cookie Session** | `server-main.js` | `cookieSession({ httpOnly, sameSite: lax })` | P0 | 所有 AI-GM 端点必须挂接在 `requireLoginMiddleware` 之后 |
| 2 | **CSRF 保护** | `server-main.js` | `POST` 需 `x-csrf-token` header；获取 `GET /csrf-token` | P0 | 前端调用 AI-GM API 时携带 CSRF token |
| 3 | **IP 白名单** | `whitelist.js` | `whitelist: []` (config.yaml) | P1 | 了解即可，由 ST 主流程控制 |
| 4 | **Host 白名单** | `hostWhitelist.js` | `hostWhitelist.enabled` / `hostWhitelist.hosts` | P1 | 了解即可 |
| 5 | **Basic Auth** | `basicAuth.js` | `basicAuthUser.username/password` 或 perUser 模式 | P1 | 若用户开启 basicAuth，前端请求需带 Authorization header |
| 6 | **Rate Limit** | `basicAuth.js` | `rateLimiting.basicAuthMaxAttempts` (5次/60s) | P1 | 了解即可，影响登录而非 API |
| 7 | **Private Address Filter** | `private-request-filter.js` | `privateAddressWhitelist.enabled` | P1 | 若 AI-GM 需要请求外部 LLM API，注意此限制 |
| 8 | **Request Proxy** | `request-proxy.js` | `requestProxyEnabled` / `requestProxyUrl` | P1 | 出站 LLM 请求需复用此代理配置 |
| 9 | **Filename 校验** | `validateFileName.js` | 禁止 `\x00` 和路径分隔符 | P2 | 模组文件命名遵循此规则 |

### 认证端点速查

```
GET  /csrf-token          → { token: string } 或 { token: "disabled" }
POST /api/ping            → 204 (extend session)
GET  /login               → 登录页
```

---

## 二、Token 计数 / 上下文预算层（直接调用）

| # | 端点 | 方法 | 输入 | 输出 | 用途 | 优先级 |
|---|------|------|------|------|------|--------|
| 1 | `/api/tokenizers/openai/count` | POST | `body: messages[]` + `?model=xxx` | `{ token_count }` | **计算对话总 token** | P0 |
| 2 | `/api/tokenizers/openai/encode` | POST | `body: { text }` + `?model=xxx` | `{ ids, count, chunks }` | 编码文本 | P1 |
| 3 | `/api/tokenizers/openai/decode` | POST | `body: { ids }` + `?model=xxx` | `{ text }` | 解码 token | P1 |
| 4 | `/api/tokenizers/:model/encode` | POST | `body: { text }` | `{ ids, count, chunks }` | 具体模型编码 | P2 |
| 5 | `/api/tokenizers/:model/decode` | POST | `body: { ids }` | `{ text }` | 具体模型解码 | P2 |
| 6 | `/api/tokenizers/remote/kobold/count` | POST | `body: { text, url }` | `{ count, ids }` | 远程 Kobold 计数 | P2 |
| 7 | `/api/tokenizers/remote/textgenerationwebui/encode` | POST | `body: { text, url, model, api_type }` | `{ count, ids }` | 远程 TGW 编码 | P2 |

### 模型映射表（AI-GM 需复用）

| 用户选择 | 内部 tokenizer | 调用端点 |
|----------|----------------|----------|
| GPT-4o / GPT-4.1 | `gpt-4o` | `tiktoken` |
| GPT-3.5 Turbo | `gpt-3.5-turbo` | `tiktoken` |
| Claude 全系 | `claude` | `WebTokenizer` |
| Llama 3 | `llama3` | `WebTokenizer` |
| Llama 2 | `llama` | `SentencePiece` |
| Mistral | `mistral` | `SentencePiece` |
| Yi | `yi` | `SentencePiece` |
| DeepSeek | `deepseek` | `WebTokenizer` |
| Gemma / Gemini | `gemma` | `SentencePiece` |
| Jamba | `jamba` | `SentencePiece` |
| Qwen2 | `qwen2` | `WebTokenizer` |
| Command-R | `command-r` | `WebTokenizer` |
| Command-A | `command-a` | `WebTokenizer` |
| Nemo | `nemo` | `WebTokenizer` |
| 默认 | `gpt-3.5-turbo` | `tiktoken` |

### 上下文预算管理（AI-GM 自建）

ST 只提供 "计数"，AI-GM 需自建：
- **预算分配器** — 根据 `world_info_budget` (默认25%)、角色卡、聊天记录分配上限
- **截断策略** — 超限时按优先级丢弃（旧消息 > lore entries > 次要角色）
- **动态重算** — 每次用户发送后调用 `/api/tokenizers/openai/count` 确认当前占用
- **回退估算** — tokenizer 失败时，用 `ceil(byteLength / 3.35)` 估算

---

## 三、WorldInfo / Lore 存储层（复用+自建）

### 3.1 复用 ST WorldInfo API（设定/背景）

| # | 端点 | 方法 | 输入 | 输出 | 用途 | 优先级 |
|---|------|------|------|------|------|--------|
| 1 | `/api/worldinfo/list` | POST | — | `[{ file_id, name, extensions }]` | 列出所有 lorebook | P0 |
| 2 | `/api/worldinfo/get` | POST | `body: { name }` | `{ entries: {...}, name }` | 读取 lorebook | P0 |
| 3 | `/api/worldinfo/edit` | POST | `body: { name, data }` | `{ ok: true }` | **写入/更新 lorebook** | P0 |
| 4 | `/api/worldinfo/delete` | POST | `body: { name }` | 200 | 删除 lorebook | P2 |
| 5 | `/api/worldinfo/import` | POST | multipart `file` | `{ name }` | 导入 lorebook | P2 |

### 3.2 模组独立存储（游戏状态/元数据）

**方案:** 混合存储 — 设定用 WorldInfo，游戏状态用独立文件。

| 数据类型 | 存储位置 | 格式 | 写入方式 | 说明 |
|----------|----------|------|----------|------|
| 模组背景/设定 | `worlds/{modName}.json` | WorldInfo JSON | `POST /api/worldinfo/edit` | 复用 ST 原生机制 |
| 游戏状态 (HP/骰子/库存) | `{userRoot}/ai-gm/{modId}/state.json` | 自定义 JSON | `write-file-atomic` | AI-GM 自建 |
| 模组元数据 | `{userRoot}/ai-gm/{modId}/meta.json` | 自定义 JSON | `write-file-atomic` | 作者/版本/规则书 |
| GM 决策日志 | `{userRoot}/ai-gm/{modId}/gm-log.jsonl` | JSON Lines | 追加写入 | 按行记录 GM 行为 |
| 模组资源 | `{userRoot}/ai-gm/{modId}/assets/` | 图片/音频 | 常规写入 | 角色图、场景图等 |
| 模组注册表 | `{userRoot}/ai-gm/registry.json` | JSON | `write-file-atomic` | 已安装模组索引 |

### 3.3 WorldInfo Entry 字段速查（AI-GM 生成 lore 时需遵守）

```json
{
  "uid": 1,
  "key": ["关键词1", "关键词2"],
  "keysecondary": ["筛选词"],
  "content": "触发后插入的文本内容",
  "comment": "备注",
  "order": 100,
  "depth": 4,
  "selective": true,
  "selectiveLogic": 0,
  "position": 3,
  "role": 0,
  "probability": 100,
  "sticky": 0,
  "cooldown": 0,
  "delay": 0,
  "excludeRecursion": false,
  "preventRecursion": false,
  "disable": false,
  "matchDialogue": true
}
```

**关键字段含义:**
- `position`: 0=Before Prompt, 1=After Prompt, 2=Author's Note, 3=at depth
- `role`: 0=system, 1=user, 2=assistant
- `selectiveLogic`: 0=AND_ANY, 1=NOT_ALL, 2=NOT_ANY, 3=AND_ALL
- `sticky`: 触发后持续 N 条消息
- `cooldown`: 触发后冷却 N 条消息
- `delay`: 触发后延迟 N 条消息才插入

---

## 四、端点注册方式（AI-GM 插件接入 ST）

### 4.1 推荐方案：通过 ST 插件系统注册

ST 在 `server-main.js` 中加载插件：

```js
const pluginsDirectory = path.join(serverDirectory, 'plugins');
const cleanupPlugins = await loadPlugins(app, pluginsDirectory);
```

AI-GM 作为插件应：
1. 在 `plugins/ai-gm/` 下提供 `index.js`
2. 在 `index.js` 中导出一个函数接收 `app` 实例
3. 在 `app.use(requireLoginMiddleware)` 之后注册自己的路由（如 `/api/ai-gm/*`）

### 4.2 路由挂载示例

```js
// plugins/ai-gm/index.js
module.exports = function(app) {
    // 所有 AI-GM API 都需要登录
    const router = require('express').Router();
    
    router.post('/state/get', async (req, res) => { ... });
    router.post('/state/save', async (req, res) => { ... });
    router.post('/roll', async (req, res) => { ... });
    router.post('/scene/change', async (req, res) => { ... });
    
    // 挂载到 /api/ai-gm
    app.use('/api/ai-gm', router);
};
```

### 4.3 必须遵守的约束

- 使用 `sanitize-filename` 处理所有文件名
- 使用 `write-file-atomic` 进行原子写入
- 文件大小限制：请求体 500MB，文件上传 500MB
- 复用 `getConfigValue` 读取配置，不自建配置系统
- 通过 `server-events.js` 监听 `SERVER_STARTED` 事件进行初始化

---

## 五、检查清单（AI-GM 开发时逐条确认）

### 安全
- [ ] 所有 AI-GM 端点挂载在 `requireLoginMiddleware` 之后
- [ ] 前端请求携带 `x-csrf-token`（通过 `GET /csrf-token` 获取）
- [ ] 若用户开启 Basic Auth，前端请求带 `Authorization: Basic ...`
- [ ] 若用户开启 Request Proxy，AI-GM 的 LLM 出站请求复用代理配置
- [ ] 文件命名使用 `sanitize-filename` 过滤
- [ ] 禁止路径注入（`\x00`, `/`, `\\`）

### Token / 上下文
- [ ] 调用 `/api/tokenizers/openai/count?model=xxx` 计算对话 token
- [ ] 实现 `guesstimate(str)` 回退策略（`ceil(byteLength / 3.35)`）
- [ ] 自建预算分配器（world_info_budget + 角色卡 + 聊天记录）
- [ ] 自建截断策略（超限时丢弃旧消息/次要条目）
- [ ] 支持模型映射表（`getTokenizerModel` 逻辑）

### WorldInfo / 存储
- [ ] 模组设定通过 `/api/worldinfo/edit` 写入 WorldInfo JSON
- [ ] 游戏状态存到 `{userRoot}/ai-gm/{modId}/state.json`
- [ ] 元数据存到 `{userRoot}/ai-gm/{modId}/meta.json`
- [ ] GM 日志用 JSON Lines 追加到 `{userRoot}/ai-gm/{modId}/gm-log.jsonl`
- [ ] 所有写入使用 `write-file-atomic`
- [ ] 提供模组导入/导出（ZIP 包，包含 WorldInfo + state + meta + assets）

### 插件接入
- [ ] 提供 `plugins/ai-gm/index.js` 入口
- [ ] 通过 `loadPlugins` 机制加载
- [ ] 监听 `SERVER_STARTED` 事件初始化
- [ ] 提供模组卸载时的清理函数（cleanup）

---

*生成时间: 2026-06-10 08:00+ Asia/Shanghai*  
*数据来源: SillyTavern src/middleware/, src/endpoints/tokenizers.js, src/endpoints/worldinfo.js, src/server-main.js*  
*只读分析，未修改源码。*
