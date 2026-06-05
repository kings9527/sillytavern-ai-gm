# AI-GM 请求限制解决方案

## 问题场景

在 AI-GM 开发和运行过程中，可能遇到以下请求过多问题：

| 场景 | 限制源 | 触发条件 |
|------|--------|----------|
| **GitHub API** | gh CLI / REST API | 频繁查询 issue/PR、批量操作 |
| **LLM API** | OpenAI/Claude/等 | 多 NPC 同时调用、长上下文、高频交互 |
| **SillyTavern API** | 本地服务器 | 开发测试时频繁重启、批量请求 |
| **图片生成** | SD/ComfyUI API | 场景/NPC 图片实时生成 |

---

## 1. GitHub API 限流（开发阶段）

### 限制
- 未认证：60 requests/hour
- 认证：5,000 requests/hour
- `gh search` 等批量操作消耗较大

### 解决方案

```javascript
// 1. 本地缓存层
class GitHubCache {
    constructor() {
        this.cache = new Map();
        this.ttl = 3600000; // 1小时
    }
    
    async get(key, fetcher) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.time < this.ttl) {
            return cached.data;
        }
        const data = await fetcher();
        this.cache.set(key, { data, time: Date.now() });
        return data;
    }
}

// 2. 批量操作合并
// 错误：循环中逐个调用
// 正确：一次性获取，内存中筛选
const allIssues = await gh.issue.list({ limit: 100, state: 'open' });
const bugs = allIssues.filter(i => i.labels.includes('Bug'));
```

### 定时任务优化

```javascript
// cron job 中限制 GitHub API 调用次数
// 将 daily-learning-github-practice 改为：
// - 每次任务最多 3 次 gh 调用
// - 优先使用本地缓存的 issue 列表
// - 复杂查询改为每周一次，而非每天
```

---

## 2. LLM API 限流（运行阶段）

### 限制
- OpenAI: RPM (requests per minute) / TPM (tokens per minute) 分级限制
- Claude: 根据 tier 不同，RPM 从 50 到 4000 不等
- 成本：多 NPC 同时调用 = 费用暴增

### 核心问题：多 NPC 同时请求

**场景**：场景中有 3 个 NPC + 1 个 GM 叙述 + 1 个玩家，每轮需要 5 次 LLM 调用。

**解决方案**：

#### 2.1 请求合并（Batching）

```javascript
class LLMBatcher {
    constructor() {
        this.queue = [];
        this.batchSize = 5;
        this.interval = 1000; // 1秒
        this.timer = null;
    }
    
    addRequest(request) {
        return new Promise((resolve) => {
            this.queue.push({ ...request, resolve });
            this.scheduleBatch();
        });
    }
    
    scheduleBatch() {
        if (this.timer) return;
        this.timer = setTimeout(() => this.processBatch(), this.interval);
    }
    
    async processBatch() {
        const batch = this.queue.splice(0, this.batchSize);
        if (batch.length === 0) {
            this.timer = null;
            return;
        }
        
        // 批量发送（如果 API 支持）
        // 或串行处理，但控制间隔
        for (const req of batch) {
            const result = await this.callLLM(req);
            req.resolve(result);
            await this.delay(200); // 200ms 间隔，避免 RPM 超限
        }
        
        this.timer = null;
        if (this.queue.length > 0) {
            this.scheduleBatch();
        }
    }
    
    delay(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
```

#### 2.2 分层模型策略（降本核心）

| 任务 | 模型 | 原因 |
|------|------|------|
| NPC 决策（选行动） | `gpt-4o-mini` / `claude-3-haiku` | 简单分类，不需要创造力 |
| GM 叙述 | `gpt-4o` / `claude-3.5-sonnet` | 需要高质量 prose |
| NPC 对话生成 | `gpt-4o-mini` | 有角色卡约束，不需要最强模型 |
| 规则计算 | 本地规则引擎 | 零 API 调用 |
| 场景描述 | `gpt-4o-mini` | 模板化内容 |

**成本对比**：
- 全部用 gpt-4o：5 NPC × 2000 tokens × $0.005/1K = $0.05/轮
- 分层模型：1×gpt-4o + 4×mini = $0.005 + $0.001×4 = $0.009/轮
- **节省 80%**

#### 2.3 上下文压缩（减少 Token）

```javascript
class ContextCompressor {
    compress(history, maxTokens = 4000) {
        // 策略：保留关键信息，丢弃冗余
        const priority = [
            'system_prompt',      // 永远保留
            'current_scene',      // 保留
            'player_stats',       // 保留
            'recent_events',      // 最近5轮
            'npc_states',         // 当前状态
            'old_history'         // 压缩为摘要
        ];
        
        // 对旧历史进行摘要
        const oldHistory = history.slice(0, -5);
        const summary = this.summarize(oldHistory);
        
        return {
            system: priority[0],
            scene: priority[1],
            summary,
            recent: history.slice(-5)
        };
    }
    
    summarize(history) {
        // 使用轻量模型或简单提取
        // 提取：关键事件、决策、状态变化
        return history
            .filter(h => h.type === 'scene_change' || h.type === 'combat')
            .map(h => `${h.actor}: ${h.action} → ${h.result}`)
            .join('\n');
    }
}
```

#### 2.4 请求队列 + 退避重试

```javascript
class RateLimitedLLMClient {
    constructor(apiKey, config = {}) {
        this.apiKey = apiKey;
        this.maxRetries = config.maxRetries || 3;
        this.baseDelay = config.baseDelay || 1000;
        this.maxRPM = config.maxRPM || 50;
        this.requestTimes = [];
    }
    
    async call(prompt, options = {}) {
        await this.waitForRateLimit();
        
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const result = await this.doCall(prompt, options);
                this.recordRequest();
                return result;
            } catch (e) {
                if (e.status === 429) { // Too Many Requests
                    const delay = this.baseDelay * Math.pow(2, attempt);
                    console.warn(`Rate limited, retrying in ${delay}ms...`);
                    await this.sleep(delay);
                } else {
                    throw e;
                }
            }
        }
        throw new Error('Max retries exceeded');
    }
    
    async waitForRateLimit() {
        const now = Date.now();
        const windowStart = now - 60000; // 1 minute window
        this.requestTimes = this.requestTimes.filter(t => t > windowStart);
        
        if (this.requestTimes.length >= this.maxRPM) {
            const oldest = this.requestTimes[0];
            const wait = 60000 - (now - oldest);
            if (wait > 0) {
                await this.sleep(wait);
            }
        }
    }
    
    recordRequest() {
        this.requestTimes.push(Date.now());
    }
    
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
```

---

## 3. 图片生成限流

### 场景
- 每切换场景生成一张背景图
- 每个 NPC 生成立绘
- 战斗关键时刻生成画面

### 解决方案

```javascript
class ImageGenerationManager {
    constructor() {
        this.cache = new Map(); // URL -> 图片缓存
        this.pending = new Map(); // 去重：相同 prompt 复用请求
        this.queue = [];
        this.processing = false;
    }
    
    async generate(prompt, options = {}) {
        // 1. 检查缓存
        const cacheKey = this.hashPrompt(prompt);
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // 2. 去重：相同 prompt 正在生成中，复用 Promise
        if (this.pending.has(cacheKey)) {
            return this.pending.get(cacheKey);
        }
        
        // 3. 加入队列
        const promise = this.queueGenerate(cacheKey, prompt, options);
        this.pending.set(cacheKey, promise);
        
        const result = await promise;
        this.cache.set(cacheKey, result);
        this.pending.delete(cacheKey);
        return result;
    }
    
    async queueGenerate(cacheKey, prompt, options) {
        return new Promise((resolve, reject) => {
            this.queue.push({ cacheKey, prompt, options, resolve, reject });
            this.processQueue();
        });
    }
    
    async processQueue() {
        if (this.processing) return;
        this.processing = true;
        
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            try {
                // 控制频率：每分钟最多 5 张图
                await this.sleep(12000); // 12秒间隔
                const result = await this.callSDAPI(item.prompt, item.options);
                item.resolve(result);
            } catch (e) {
                item.reject(e);
            }
        }
        
        this.processing = false;
    }
    
    sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }
}
```

### 降级策略

| 场景 | 首选 | 降级 | 兜底 |
|------|------|------|------|
| 场景背景 | SD 生成 | 预设图片库 | 纯色背景 + 文字描述 |
| NPC 立绘 | 角色卡头像 | 预设 NPC 图 | 文字名字标签 |
| 战斗画面 | 实时生成 | 战斗 UI 动画 | 文字描述 |

---

## 4. 开发阶段限流（SillyTavern API）

### 场景
- 开发时频繁重启 SillyTavern 测试
- 前端 Extension 热重载导致大量请求
- 后端 Plugin 调试时重复调用

### 解决方案

```javascript
// 1. 开发模式标记
const IS_DEV = process.env.NODE_ENV === 'development' || process.env.AI_GM_DEBUG === 'true';

// 2. 请求防抖
class DebouncedAPI {
    constructor(fn, delay = 300) {
        this.fn = fn;
        this.delay = delay;
        this.timeout = null;
    }
    
    call(...args) {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.fn(...args), this.delay);
    }
}

// 3. 开发模式 Mock
if (IS_DEV) {
    // Mock LLM 响应，避免真实 API 调用
    LLMClient.prototype.call = async function(prompt) {
        return { text: `[DEV MOCK] ${prompt.slice(0, 50)}...`, mock: true };
    };
    
    // Mock 图片生成
    ImageManager.prototype.generate = async function() {
        return { url: '/assets/dev-placeholder.png', mock: true };
    };
}
```

---

## 5. 综合配置（AI-GM 项目）

```javascript
// plugin/config.js
export const AI_GM_CONFIG = {
    // LLM 分层
    llm: {
        gm: { model: 'gpt-4o', temperature: 0.7, maxTokens: 2000 },
        npc: { model: 'gpt-4o-mini', temperature: 0.8, maxTokens: 500 },
        decision: { model: 'gpt-4o-mini', temperature: 0.3, maxTokens: 200 },
        summary: { model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 300 }
    },
    
    // 限流
    rateLimit: {
        llm: { rpm: 30, batchSize: 5, interval: 1000 },
        image: { rpm: 5, queueTimeout: 12000 },
        github: { cacheTTL: 3600000, maxCalls: 3 }
    },
    
    // 上下文
    context: {
        maxHistory: 20,        // 保留最近 20 轮
        compressAfter: 10,     // 超过 10 轮后压缩旧历史
        summaryInterval: 5      // 每 5 轮生成一次摘要
    },
    
    // 开发
    dev: {
        mockLLM: false,
        mockImage: false,
        verboseLogging: true
    }
};
```

---

## 6. 定时任务请求优化

将 cron job 中的 GitHub 操作限制：

```json
{
  "message": "【任务提示】\n\nGitHub API 限制：\n- 每次任务最多 3 次 gh 调用\n- 使用本地缓存文件存储 issue 列表\n- 复杂查询改为每周执行（并入 biweekly-pr-tracker）\n\nLLM 开发限制：\n- 开发阶段使用 mock 模式\n- 批量操作合并为单次调用\n\n完成后发送简要摘要到主会话。"
}
```

---

## 总结

| 问题 | 核心策略 | 效果 |
|------|----------|------|
| GitHub API 限流 | 本地缓存 + 批量获取 | 减少 80% 请求 |
| LLM 多 NPC 请求 | 分层模型 + 请求合并 | 节省 80% 成本 |
| LLM 上下文过长 | 摘要压缩 + 分层保留 | 减少 60% tokens |
| 图片生成限流 | 队列 + 缓存 + 降级 | 避免 API 拒绝 |
| 开发调试频繁 | 开发模式 Mock | 零 API 调用 |

**关键原则**：永远不要信任 LLM 会记住，永远不要无限制发送请求。所有状态持久化，所有请求有队列。🔥
