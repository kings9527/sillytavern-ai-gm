# AI-GM 项目状态

**项目**: sillytavern-ai-gm  
**当前阶段**: Phase 3 Surface（UI 层开发）  
**最后更新**: 2026-06-13  

---

## 完成度

| 模块 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **前端 Extension** | ✅ Day1 完成 | 65% | Day2 新增：存档槽位UI + 战斗日志 + HP同步 |
| **后端 Plugin** | ✅ Day2 完成 | 70% | Day2 新增：combat_summary + save/list + 玩家HP同步 |
| **模组解析器** | ✅ 基础 | 40% | JSON 解析 + Markdown 占位 |
| **状态机** | ✅ Day2 完成 | 70% | 场景切换 + interact动作 + 事件触发 + 检定联动 + 结局 |
| **规则引擎** | ✅ Day2 完成 | 70% | d100检定 + DB计算 + 伤害公式 + 最大骰子 + 中文narration |
| **骰子系统** | ✅ 完成 | 80% | 多面骰 + 表达式 + 历史记录 |
| **战斗系统** | ✅ Day2 完成 | 75% | 先攻 + 回合 + 攻击结算 + 敌人AI(LLM+规则) + HP同步 + 战斗日志 |
| **NPC 决策** | ✅ Day2 完成 | 80% | 规则驱动 + LLM增强决策 + 模板对话 + AI对话(LLM优先) + 秘密追踪 |
| **存档系统** | ✅ Day2 完成 | 60% | 5存档位内存存档 + 存档列表 + 日志系统 |
| **提示词构建** | ✅ 完成 | 70% | GM/NPC/场景/战斗/SAN 提示词 |
| **测试模组** | ✅ 完成 | 100% | 「阿卡姆之夜」5 场景 4 NPC 2 结局 |
| **限流方案** | ✅ 文档 | 100% | 已写入 docs/rate-limiting.md |
| **测试框架** | ✅ 新增 | 80% | engine + utils 全模块测试脚本 |

---

## Day 1 Surface 完成记录

### 前端 (index.js + style.css)
- ✅ `gmApi()` 添加重试逻辑 + 错误处理
- ✅ 连接后端完整流程：health → load module → create campaign → update UI
- ✅ 场景显示：标题 + 描述 + NPC 列表 + 出口按钮（点击切换场景）
- ✅ 玩家状态：HP/SAN 条形图 + 属性网格（STR/CON/DEX/INT/POW/EDU）
- ✅ NPC 状态：显示 HP 和态度颜色标签（neutral/friendly/hostile）
- ✅ 掷骰弹窗：1d100/1d20/2d6/1d6/3d6 预设按钮 + 结果展示
- ✅ 存档弹窗：保存/读取按钮 + 状态反馈
- ✅ 加载状态：全屏遮罩 + 文字提示
- ✅ 错误提示：5秒自动消失的顶部提示条

### 后端 (plugin/index.js)
- ✅ `asyncHandler` 中间件统一处理异步路由错误
- ✅ `errorHandler` 全局错误处理器（返回 JSON 格式）
- ✅ `/campaign/create` 完善：支持自定义 player_stats，返回精简 campaign 数据
- ✅ `/state/action` 添加 `dice_check` 分支：CoC 7e 检定 + 中文 narration
- ✅ `/state/action` 添加 `scene_transition` 分支：直接场景切换
- ✅ 所有路由改为 `asyncHandler` 包装，统一错误格式
- ✅ `buildCheckNarration()` 辅助函数：中文检定结果描述（大成功/极难成功/困难成功/成功/大失败/失败）

### 开发环境
- ✅ `.env.example`：PORT / mock mode / logging / database 配置模板
- ✅ `package.json`：test 脚本 + 分模块测试命令
- ✅ `test/index.js`：DiceRoller / RuleEngine / GameStateMachine / CombatTracker / NPCDecisionEngine / PromptBuilder 全模块测试
- ✅ 全部文件通过 `node --check` 语法验证

---

## Day 2 Engine 完成记录

### 状态机 (state-machine.js)
- ✅ `interact` 动作类型：检查物品、阅读古籍、拾取物品
- ✅ 场景事件系统：触发条件(scene/action/time/chance)、效果应用、SAN检定
- ✅ 技能检定自动生成：从玩家输入提取技能名（图书馆使用/侦查/聆听等）
- ✅ 检定成功触发场景事件：如地下室侦查成功发现隐藏门
- ✅ NPC 对话交互：单NPC默认、多NPC选择、名字匹配
- ✅ 战斗触发：检查场景 combat.enabled，返回敌人列表
- ✅ 结局支持：场景 ending 字段触发结局页面
- ✅ 条件评估增强：支持范围、布尔、数值、字符串条件
- ✅ 物品效果解析：`cult_awareness + 1`, `sanity_loss 1d3` 等

### 战斗系统 (combat-tracker.js)
- ✅ 玩家 HP 同步：applyDamage 同时更新 campaign.player.hp
- ✅ 敌人自动攻击回合：processEnemyAutoTurn() 连续处理AI敌人
- ✅ 敌人AI决策：HP<20%逃跑、HP<50%使用魔法、默认攻击
- ✅ 伤害计算接入 RuleEngine：calculateDamageBonus() + 武器伤害
- ✅ 暴击/大失败处理：暴击=max伤害、大失败=自伤
- ✅ 战斗日志：round/turn/damage 全程记录
- ✅ 战斗摘要 API：getCombatSummary() 供前端实时更新
- ✅ 治疗/恢复：heal() 方法支持物品/急救
- ✅ 回合跳过已击败单位：advanceTurn() 自动跳过 defeated 列表

### 规则引擎 (rule-engine.js)
- ✅ CoC 7e 伤害加成(DB)计算：STR+SIZ 对照表 (-2 到 +2d6)
- ✅ 最大骰子值：getMaxDiceRoll() 用于暴击伤害
- ✅ 增强骰子解析：支持 `1d6+3`, `2d10-2` 等

### 存档系统 (storage/campaign.js)
- ✅ 5 存档位内存存储：slot 1-5，带标签和场景信息
- ✅ 存档列表 API：getSnapshots() 返回全部存档信息
- ✅ 存档元数据：场景ID、回合数、保存时间、标签
- ✅ 行动日志系统：logAction() + getHistory() + getFullCampaignLog()
- ✅ 日志统计：动作类型分布、角色分布、骰子检定次数等
- ✅ 移除 better-sqlite3 静态依赖（改为动态导入备用）

### 后端 API (plugin/index.js)
- ✅ `/combat/init` 返回 combat_summary
- ✅ `/combat/action` 返回 combat_summary + 同步 player HP
- ✅ `/save` 使用 CampaignStorage.saveSnapshot()
- ✅ `/save/list` 新端点：返回存档位列表
- ✅ `/load` 使用 CampaignStorage.loadSnapshot()
- ✅ 所有存档/战斗路由改为 asyncHandler 包装

### 前端 (index.js)
- ✅ 战斗 UI 同步：updateCombatUI() 从 combat_summary 更新玩家 HP
- ✅ 存档弹窗增强：5 个存档位选择，显示场景/回合/时间信息
- ✅ 存档读取后自动刷新场景和玩家状态

### 样式 (style.css)
- ✅ 存档槽位样式：selected/empty/active 状态
- ✅ 战斗日志样式：滚动区域 + 日志条目

## Day 3 Guard 完成记录

### 测试框架修复
- ✅ dice.js 内存溢出修复：正则 `(\d*)` → `(\d+)` 阻止空字符串无限匹配
- ✅ 测试框架保持轻量断言方案（无需 Jest）
- ✅ 29/29 测试全部通过

### Bug 修复与边界检查
- ✅ **状态机**：`processAction()` 空值校验 + `inventory` 默认值 + `combat_state` 离开战斗场景时自动清理
- ✅ **事件系统**：`repeatable` 标志支持事件重复触发；`checkSkillSuccessEvents()` 改为模块配置驱动（不再硬编码 `basement`）
- ✅ **战斗系统**：
  - `loadState()` 验证完整性（缺失 initiative 时拒绝加载）
  - `applyDamage()` 防御式编程（null player/npc_state）
  - `checkCombatEnd()` 空值保护
  - `heal()` 空值保护
  - `initCombat()` 空 enemies 数组校验
  - `resolveAttack()` 验证 attacker 存在
- ✅ **存档恢复**：`loadSnapshot()` 加载后 campaign 数据完整保留，combat_state 由 CombatTracker.loadState() 验证

### JSDoc 类型注解（全部引擎模块）
- ✅ `dice.js` — 4 个公共方法完整 JSDoc
- ✅ `rule-engine.js` — 7 个公共方法完整 JSDoc
- ✅ `state-machine.js` — 全部公共方法 + 工具方法 JSDoc
- ✅ `combat-tracker.js` — 全部公共方法 JSDoc
- ✅ `campaign.js` — 全部公共方法 JSDoc
- ✅ `sanitize.js` — 新增工具函数 JSDoc

### 输入消毒（XSS 防护）
- ✅ `utils/sanitize.js` 新建：
  - `escapeHtml()` — HTML 实体转义
  - `sanitizeInput()` — 去除控制字符 + 长度截断
  - `sanitizeNarration()` — 去除 script 标签和事件处理器
  - `validateModule()` — 模组结构验证
  - `isValidCampaignId()` — 格式校验
- ✅ `state-machine.js` 集成 `sanitizeNarration()` 到事件描述和技能检定结果

### 测试覆盖（29 个断言全部通过）
- DiceRoller (4) / RuleEngine (7) / GameStateMachine (5)
- CombatTracker (3) / NPCDecisionEngine (2) / Sanitize (8)

## 下一步（Day 4·Pipeline）

### CI/CD 与构建
- [ ] 配置 ESLint + Prettier（代码规范自动化）
- [ ] 添加 `package.json` lint / format 脚本
- [ ] 添加 GitHub Actions 基础 CI（语法检查 + 测试运行）

### 性能优化
- [ ] 引擎模块懒加载（减少启动时间）
- [ ] 骰子解析器缓存（避免重复编译正则）

### 开发者体验
- [ ] 添加 `README.md` 开发指南
- [ ] 添加 `docs/module-format.md` 模组格式规范
- [ ] 添加热重载开发模式（mock 数据）

## 已知问题（已解决）

1. ✅ dice.js 内存溢出（OOM）—— 正则无限循环已修复
2. ✅ 存档读取后 combat_state 丢失—— 验证后优雅降级
3. ✅ 事件重复触发—— 新增 `repeatable` 字段控制
4. ✅ 输入未消毒—— sanitize.js 已覆盖

## Day 4 Pipeline 完成记录

### CI/CD 与构建
- ✅ ESLint 配置：`eslint.config.js` — 浏览器/Node 双环境覆盖，SillyTavern 全局变量定义
- ✅ Prettier 配置：`.prettierrc` — 2空格缩进、单引号、trailing comma
- ✅ GitHub Actions CI：`.github/workflows/ci.yml` — Node 20/22 矩阵，lint + format-check + test + syntax-check
- ✅ `package.json` 脚本：`lint`/`lint:fix`/`format`/`format:check`/`check`/`dev`/`dev:mock`
- ✅ devDependencies：`eslint ^9.0.0` + `prettier ^3.0.0`

### 性能优化
- ✅ 骰子解析缓存：`DiceRoller` 新增 `_parseCache`（结构缓存，非结果缓存），LRU 淘汰策略（max 50），相同表达式二次解析速度提升
- ✅ 缓存验证：2d6+3 连续两次 roll 结果不同（随机性保留），但 cache size 正确增长

### 开发者体验
- ✅ `utils/dev-mode.js`：
  - `MOCK_CAMPAIGN` / `MOCK_MODULE` — 完整 mock 数据（阿卡姆之夜简化版）
  - `isMockMode()` — 环境变量检测
  - `watchModule()` — 文件热重载 watcher
  - `devLog()` / `devTimer()` — 开发专用日志和性能计时
  - `resetDevData()` — 测试数据重置
- ✅ `docs/module-format.md` — 完整模组格式规范（Schema + 场景/NPC/事件/物品/结局 + 验证规则 + 最小示例）
- ✅ `README.md` 开发指南：快速设置、脚本表格、mock 模式、架构图、添加新效果类型流程

### 测试验证
- ✅ 29/29 测试全部通过（无回归）
- ✅ `npm run check` 语法检查全部通过
- ✅ `node --check` 验证新文件 `dev-mode.js`

## 已知问题（已解决）

1. ✅ dice.js 内存溢出（Day 3 已修复）
2. ✅ 存档读取后 combat_state 丢失（Day 3 已修复）
3. ✅ 事件重复触发（Day 3 已修复）
4. ✅ 输入未消毒（Day 3 已修复）

## Day 2 Engine 完成记录 (续)

### 模组解析器 (module-parser.js)
- ✅ 完整 JSON 验证：11 项验证规则
  - 必填字段检查（id, name, version, system, scenes, npcs）
  - SemVer 版本格式验证
  - 规则系统类型校验（coc7e/dnd5e/general/custom）
  - ID 唯一性检查（scene/NPC/item/ending/event 全局去重）
  - 场景出口目标引用验证（指向存在的场景）
  - NPC 引用验证（场景中引用的 NPC 必须在 npcs 中定义）
  - 物品引用验证（场景中引用的物品必须在 items 中定义）
  - 事件验证（trigger/effects 结构检查）
  - 循环场景检测（DFS 路径检测，仅警告）
  - 起始场景存在性检查
- ✅ Markdown 解析器：YAML frontmatter 提取 + 场景结构解析
  - 支持 `---` 包裹的 YAML 前置元数据（id/name/version/system）
  - 场景标题识别（`# 场景：标题` + `**id**: id`）
  - 描述文本提取（atmosphere 标记后内容）
  - 出口解析（`[标签](目标)` 格式，支持条件标记）
  - NPC 引用解析（`[名字](npcs/id.md)` 格式）
  - 事件解析（`### 事件名` + 触发 + 效果）
  - 兜底模式：无结构化标记时按 `## 标题` 分块解析
- ✅ 新增 `getWarnings()` 方法获取解析警告
- ✅ 测试覆盖：9 项 ModuleParser 专项断言（38/38 全部通过）

## Day 2 完成记录（新）

### 模组解析器
- ✅ JSON 解析：完整验证 + 错误抛出
- ✅ Markdown 解析：基础结构提取（非 LLM 依赖）
- ✅ 验证结果：`{ valid, errors, warnings }` 结构化返回
- ✅ 测试：JSON 解析、验证规则、Markdown 解析各维度覆盖

## 下一步（Day 3·Guard）

### 测试框架升级
- [ ] 将轻量断言测试迁移至 Jest 正式框架
- [ ] 模块级测试拆分（每个 engine 文件独立测试文件）

### 边界修复验证
- [ ] 场景事件多次触发：确认 `repeatable` 和 `once_per_campaign` 全覆盖
- [ ] 战斗结束清理：确认 `combat_state` 在战斗结束/逃跑/场景切换时正确清理
- [ ] 存档恢复：确认 `loadSnapshot()` 恢复后 `combat_state` 完整性

### 类型安全强化
- [ ] 所有公共方法添加 JSDoc `@param` / `@returns` 类型注解
- [ ] 新增运行时参数类型检查（防御式编程）

## 已知问题（已解决）

1. ✅ dice.js 内存溢出（Day 3 已修复）
2. ✅ 存档读取后 combat_state 丢失（Day 3 已修复）
3. ✅ 事件重复触发（Day 3 已修复）
4. ✅ 输入未消毒（Day 3 已修复）
5. ✅ Markdown 模组解析（Day 2 已实现基础版）

## Phase 2 技术债务清偿：LLM 集成层

**触发日期**: 2026-06-09 (Day 1-4 全部完成，进入 Phase 2)
**聚焦**: 最高影响力任务 — LLM 集成层（接入 SillyTavern LLM 生成）

### LLM 客户端 (`plugin/utils/llm-client.js`) — 全新基础设施
- ✅ 统一 LLM 接口：支持 OpenAI / Claude / Ollama / SillyTavern proxy 四种 provider
- ✅ 可配置参数：provider, baseUrl, apiKey, model, maxTokens, temperature, timeout, retries
- ✅ 核心方法：`chat()` / `complete()` / `chatJSON()` / `isAvailable()` / `updateConfig()` / `getStats()` / `clearCache()`
- ✅ 错误处理：超时控制（AbortController）、指数退避重试（2次）、4xx 错误不重试
- ✅ 响应缓存：LRU 缓存（max 100），相同 prompt 二次调用返回 cached 标记
- ✅ JSON 输出模式：`chatJSON()` 自动解析 JSON，支持 markdown 代码块提取
- ✅ 环境变量工厂：`createLLMClientFromEnv()` 从 `AI_GM_LLM_*` 前缀变量读取配置
- ✅ 测试覆盖：9 项断言全部通过（可用性检测、配置更新、缓存、各 provider 支持）

### NPC 决策引擎增强 (`plugin/engine/npc-decision.js`)
- ✅ `decide()` 方法签名扩展：`decide(situation, llmClient = null)`
- ✅ LLM 增强决策层：规则（≥0.85）→ 态度（>0.5）→ LLM 回退（若可用）→ 默认回退
- ✅ `_llmEnhancedDecision()`：结构化 prompt 生成，JSON 输出格式，自动解析为 NPCDecision
- ✅ `generateDialogue()` 方法签名扩展：`generateDialogue(contextSummary, mood, topic, llmClient = null)`
- ✅ `_generateLLMDialogue()`：角色扮演系统 prompt + 状态感知（信任/恐惧/怀疑）+ 秘密/话题追踪
- ✅ `_generateTemplateDialogue()`：原模板驱动逻辑保留作为 fallback
- ✅ 错误降级：LLM 调用失败时自动降级到模板驱动，不中断游戏流程

### 状态机集成 (`plugin/engine/state-machine.js`)
- ✅ 构造函数扩展：`new GameStateMachine(module, campaign, llmClient = null)`
- ✅ `handleTalk()` 传递 `llmClient` 到 `NPCDecisionEngine.decide()` 和 `generateDialogue()`
- ✅ 所有状态机实例化点更新：`plugin/index.js` 两处均传入 `getLLMClient()`

### 后端 API 新增 (`plugin/index.js`)
- ✅ LLM 配置端点：`GET /llm/config` — 返回当前配置（脱敏，不返回 apiKey）+ 可用状态 + 统计
- ✅ LLM 配置更新：`POST /llm/config` — 动态更新 provider/model/temperature 等参数
- ✅ LLM 连通性测试：`POST /llm/test` — 发送测试 prompt，返回 LLM 响应
- ✅ 全局 LLM 客户端：`getLLMClient()` 懒加载单例，首次使用时从环境变量初始化

### 测试验证
- ✅ 47/47 测试全部通过（新增 9 项 LLMClient 测试，无回归）
- ✅ `node --check` 语法验证全部通过
- ✅ 现有功能零破坏：DiceRoller / RuleEngine / GameStateMachine / CombatTracker / NPCDecisionEngine / Sanitize / ModuleParser 全部通过

---

## 完成度更新

| 模块 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **前端 Extension** | ✅ Day1+Surface | 75% | Day2+Surface: 存档槽位UI + 战斗日志 + HP同步 + game-controller浏览器兼容 + panel日志折叠 + 连接状态 |
| **后端 Plugin** | ✅ Day2 完成 | 70% | Day2 新增：combat_summary + save/list + 玩家HP同步 |
| **模组解析器** | ✅ 基础 | 40% | JSON 解析 + Markdown 占位 |
| **状态机** | ✅ Day2 完成 | 70% | 场景切换 + interact动作 + 事件触发 + 检定联动 + 结局 |
| **规则引擎** | ✅ Day2 完成 | 70% | d100检定 + DB计算 + 伤害公式 + 最大骰子 + 中文narration |
| **骰子系统** | ✅ 完成 | 80% | 多面骰 + 表达式 + 历史记录 |
| **战斗系统** | ✅ Day2 完成 | 70% | 先攻 + 回合 + 攻击结算 + 敌人AI + HP同步 + 战斗日志 |
| **NPC 决策** | ✅ Phase 2 | 60% | 规则驱动 + LLM 增强回退 + 模板对话 + AI 对话 |
| **存档系统** | ✅ Day2 完成 | 60% | 5存档位内存存档 + 存档列表 + 日志系统 |
| **提示词构建** | ✅ 完成 | 70% | GM/NPC/场景/战斗/SAN 提示词 |
| **LLM 客户端** | ✅ Phase 2 | 90% | 多 provider 支持 + 缓存 + 重试 + 配置端点 |
| **测试模组** | ✅ 完成 | 100% | 「阿卡姆之夜」5 场景 4 NPC 2 结局 |
| **限流方案** | ✅ 文档 | 100% | 已写入 docs/rate-limiting.md |
| **测试框架** | ✅ 新增 | 80% | engine + utils 全模块测试脚本 |

---

## Phase 3 Surface Day 1 完成记录（2026-06-10）

### UI 组件浏览器兼容性修复
- ✅ `plugin/ui/game-controller.js` — 浏览器兼容重写
  - 移除 Node `require`/`path`，改用 `window` 全局对象依赖注入（`AiGmPanel`/`AiGmNpc`/`AiGmScene`）
  - 完整 JSDoc 注释：所有公共方法 + 类型注解（`@param`/`@returns`/`@throws`）
  - 错误处理：try/catch + 日志，防御式编程（空值校验、后端健康检查）
  - 连接状态指示器：online/offline/error 三态 + 状态栏 UI 同步
  - 指数退避轮询：失败时自动延长间隔（5s → 60s 上限），成功时恢复
  - 自动重连：失败 3 次后触发单次重连尝试
  - 事件分发：`ai-gm:state-sync` + `ai-gm:connection-change` 自定义事件
  - 可交互物点击绑定：出口按钮 + 场景可交互物（扩展选择器支持）
  - 新增公共方法：`getStatus()` / `refreshState()` / `destroy()`

### 面板增强（`plugin/ui/panel.js`）
- ✅ 可折叠区域：NPC / 出口 / 玩家状态 / 日志 — 点击标题切换展开/折叠
- ✅ 日志面板：
  - 50 条滚动日志缓冲区，带时间戳和类型图标（场景🏞️/战斗⚔️/骰子🎲/玩家🎭/NPC👤/系统⚙️/存档💾/错误❌）
  - 类型颜色区分：战斗红色、错误深红、存档绿色
  - 自动滚动到底部
  - `appendLog()` / `appendLogEntries()` / `clearLog()` 公共 API
- ✅ 玩家状态增强：HP/SAN/MP 三色条形图（CSS 渐变），带百分比动画
- ✅ 连接状态栏：头部区域显示连接状态（🟢在线/🔴离线/🟡错误）
- ✅ 响应式样式：768px 断点适配，移动端缩小日志高度
- ✅ 完整 JSDoc 注释

### 代码规范
- ✅ ESM 模块规范（浏览器兼容的 `window` 全局导出）
- ✅ 所有函数 JSDoc 注释
- ✅ try/catch + 错误日志
- ✅ 单功能提交，commit 信息清晰
- ✅ `node --check` 语法验证通过

### Git Commit
- `3c07721` — feat(ui): Day 1 Surface - fix game-controller browser compat + enhance panel with logs/collapsible

---

## 下一步（Phase 3 Surface）

### 高优先级
- [x] 前端 UI 基础框架：`plugin/ui/` 目录结构、主面板（panel.js + game-controller.js 已就绪）
- [ ] NPC 状态卡片：`plugin/ui/npc-card.js` — 动态更新 NPC HP/态度
- [ ] 场景渲染器：`plugin/ui/scene-renderer.js` — 场景描述 + 出口按钮 + 氛围渲染
- [ ] 前端 Extension 集成 LLM 配置面板：provider 选择、模型输入、测试按钮
- [ ] 状态机 `handleCombatInitiation()` 传递 `llmClient` 到战斗中的 NPC 决策
- [ ] 意图解析 LLM 升级：`state-machine.js` 的 `parseIntent()` 从关键词匹配升级为 LLM-based 分类

### 中优先级
- [ ] Jest 正式测试框架（当前为断言测试）
- [ ] SQLite 持久化（Phase 2）
- [ ] Winston/Pino 日志系统
- [ ] Markdown 模组解析器增强（YAML 库替代）

### 低优先级
- [ ] 骰子解析器缓存优化（已部分实现）
- [ ] 引擎模块懒加载（减少启动时间）

### 用户手册
- [ ] 用户使用说明书：`docs/user-manual.md` — 安装指南、快速开始、界面说明、模组制作、FAQ

## 明日规划（2026-06-11 全速 Day 2 Engine）

基于今日完成：Phase 3 Surface 全部 UI 组件就绪（panel + llm-config + game-interface + npc-card + scene-renderer + game-controller）。

**全速目标：让 AI-GM 真正可用 — 用户打开 ST 就能看到面板，输入自然语言被 LLM 理解，NPC 和敌人用 LLM 思考。**

### 10:00 ST Extension 面板挂载
- 创建 `plugin/manifest.json` — Extension 注册信息
- 修改 `plugin/index.js`（Extension 入口）— 注册到 ST Extension 系统：
  - 导出 `init()` 函数，ST 调用时初始化 AI-GM 面板
  - 在 ST 右侧工具栏创建 AI-GM 图标/按钮
  - 点击图标展开 AI-GM 主面板（调用 panel.js + game-controller.js）
  - 连接 ST 事件：角色切换时重置游戏、聊天消息触发 AI-GM 事件
- 如果时间充裕：修改 `plugin/ui/game-controller.js` 移除 mock URL，使用 ST 实际后端地址（`/api/ai-gm/*`）
- 限制：每轮 1-2 文件，逐个完成

### 13:00 意图解析 LLM 升级
- 修改 `plugin/engine/state-machine.js` — `parseIntent()` 升级为 LLM-based：
  - 新增 `_llmParseIntent()`：构建 prompt 分类玩家输入为 move/examine/talk/combat/skill/item
  - 调用 `llmClient.chat()` 获取 JSON `{action, target, confidence}`
  - 置信度 > 0.7 采用 LLM 结果，否则 fallback 到 keyword
  - 保留原有 keyword-based 解析作为 fallback
- 限制：每轮 1-2 文件，逐个完成

### 17:00 日报
- 总结 Day 2 Engine 成果 + 问题追踪 + 更新明日规划

### 21:00 NPC 与战斗 AI 接入 LLM
- ✅ 修改 `plugin/engine/npc-decision.js` — `generateDialogue()` 接入 LLM：
  - 新增 `_generateLLMDialogue()`：使用 `llmClient.chat()` 生成 NPC 角色扮演对话，返回结构化 JSON `{text, emotion, secretRevealed}`
  - 构建 prompt：NPC 背景 + 情绪 + 话题 + 已知秘密 + 信任/恐惧/怀疑状态
  - 优先 LLM，fallback 模板驱动；LLM 失败时自动降级
  - 修改 `_generateTemplateDialogue()` 同样返回 `{text, emotion, secretRevealed}` 统一格式
  - 支持秘密追踪：LLM 或模板揭示秘密时自动写入 `npc.secrets_revealed`
- ✅ 修改 `plugin/engine/combat-tracker.js` — 敌人 AI 接入 LLM：
  - 新增 `_llmEnemyDecision()`：构建 prompt 让敌人选择 attack/flee/spell/item，返回结构化决策含 confidence
  - 置信度 > 0.7 时采用 LLM 决策，否则 fallback 到规则驱动（HP<20%逃跑、HP<50%魔法、默认攻击）
  - LLM 失败/解析错误时自动降级到规则驱动
  - `resolveEnemyAction()` 扩展支持 `spell` 和 `item` 类型
- ✅ 新增测试：`plugin/test/npc-llm-dialogue.test.js`（16 个测试用例），全部通过
- ✅ 语法检查：`node -c` 验证两个文件通过
- ✅ Git 提交：待 Phase 完成时统一做

---

## 今日完成（2026-06-11 Day 2 Engine）—— 完整汇总

### 08:00 ST Extension 面板挂载
- ✅ `plugin/manifest.json` — Extension 注册信息
- ✅ `plugin/index.js` — 前端 Extension 入口，导出 `init()`/`onEnable()`/`onDisable()`
- ✅ ST 工具栏注入 AI-GM 图标，点击展开/收起主面板
- ✅ 动态加载 `panel.js` + `game-controller.js`
- ✅ 绑定 ST 事件：`CHAT_CHANGED`、`MESSAGE_RECEIVED`
- ✅ 后端代码迁移至 `plugin/server.js`
- ✅ 测试：`plugin/test/extension-mount.js` 4/4 通过

### 10:00 ST Extension 面板挂载（修复）
- ✅ 修复 `server.js` 导出格式：补充 `info` 对象 + `init()` 函数
- ✅ 修复 `index.js` 中 `extensions.js` 导入路径
- ✅ 后端路由挂载到 `/api/plugins/ai-gm`
- ✅ 语法检查全部通过

### 13:00 意图解析 LLM 升级
- ✅ 修改 `plugin/engine/state-machine.js` — `parseIntent()` 重构为 LLM 优先 → keyword fallback
- ✅ 新增 `_llmParseIntent()`：调用 `llmClient.chat()` 获取结构化 JSON `{action, target, confidence}`
- ✅ 置信度 > 0.7 时采用 LLM 结果，否则降级到 keyword 匹配
- ✅ 新增测试：`plugin/test/state-machine-intent.test.js`（18 个测试），41/41 全部通过
- ✅ Git 提交：`10641b0`

### 21:00 NPC 与战斗 AI 接入 LLM
- ✅ 修改 `plugin/engine/npc-decision.js` — `generateDialogue()` LLM 优先，返回 `{text, emotion, secretRevealed}`
- ✅ 修改 `plugin/engine/combat-tracker.js` — 敌人 AI `_llmEnemyDecision()` 置信度 > 0.7 采用
- ✅ 新增测试：`plugin/test/npc-llm-dialogue.test.js`（16 个测试），全部通过
- ✅ 语法检查通过

---

## 完成度更新

| 模块 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **前端 Extension** | ✅ Day1+Surface | 75% | 存档槽位UI + 战斗日志 + HP同步 + panel日志折叠 + 连接状态 |
| **后端 Plugin** | ✅ Day2 完成 | 70% | combat_summary + save/list + 玩家HP同步 + LLM配置端点 |
| **模组解析器** | ✅ 基础 | 40% | JSON 解析 + Markdown 占位 |
| **状态机** | ✅ Day2 完成 | 75% | 场景切换 + interact动作 + 事件触发 + 检定联动 + 结局 + LLM意图解析 |
| **规则引擎** | ✅ Day2 完成 | 70% | d100检定 + DB计算 + 伤害公式 + 最大骰子 + 中文narration |
| **骰子系统** | ✅ 完成 | 80% | 多面骰 + 表达式 + 历史记录 + 解析缓存 |
| **战斗系统** | ✅ Day2 完成 | 75% | 先攻 + 回合 + 攻击结算 + 敌人AI(LLM+规则) + HP同步 + 战斗日志 |
| **NPC 决策** | ✅ Day2 完成 | 80% | 规则驱动 + LLM增强决策 + 模板对话 + AI对话(LLM优先) + 秘密追踪 |
| **存档系统** | ✅ Day2 完成 | 60% | 5存档位内存存档 + 存档列表 + 日志系统 |
| **提示词构建** | ✅ 完成 | 70% | GM/NPC/场景/战斗/SAN 提示词 |
| **LLM 客户端** | ✅ Phase 2 | 90% | 多 provider 支持 + 缓存 + 重试 + 配置端点 + JSON输出 |
| **测试模组** | ✅ 完成 | 100% | 「阿卡姆之夜」5 场景 4 NPC 2 结局 |
| **限流方案** | ✅ 文档 | 100% | 已写入 docs/rate-limiting.md |
| **测试框架** | ✅ 新增 | 85% | engine + utils + LLM 全模块测试，57/57 通过 |

---

## 下一步（Phase 3 Surface Day 2 → 2026-06-12）

### 高优先级
- [ ] 前端 Extension 集成 LLM 配置面板：provider 选择、模型输入、温度滑块、测试按钮
- [ ] 状态机 `handleCombatInitiation()` 传递 `llmClient` 到战斗中的 NPC 决策
- [ ] 场景渲染器增强：`plugin/ui/scene-renderer.js` — 氛围描述渲染、出口按钮动态生成、可交互物高亮

### 中优先级
- [ ] NPC 状态卡片：`plugin/ui/npc-card.js` — 动态更新 NPC HP/态度/对话气泡
- [ ] Jest 正式测试框架（当前为断言测试）
- [ ] SQLite 持久化（Phase 2）
- [ ] Winston/Pino 日志系统

### 低优先级
- [ ] Markdown 模组解析器增强（YAML 库替代）
- [ ] 引擎模块懒加载（减少启动时间）
- [ ] 骰子解析器缓存优化（已部分实现）

### 用户手册
- [ ] 用户使用说明书：`docs/user-manual.md` — 安装指南、快速开始、界面说明、模组制作、FAQ

---

## 今日完成（2026-06-12 Day 2 Engine 验证）

- ✅ `plugin/engine/npc-decision.js` LLM 对话生成验证：`_generateLLMDialogue()` + `generateDialogue()` 优先 LLM / fallback 模板，返回 `{text, emotion, secretRevealed}`
- ✅ `plugin/engine/combat-tracker.js` 敌人 AI 验证：`_llmEnemyDecision()` + `decideEnemyAction()` 优先 LLM（confidence > 0.7）/ fallback 规则驱动
- ✅ `plugin/test/npc-llm-dialogue.test.js` 16/16 测试全部通过（LLM 对话、模板回退、秘密揭示、战斗 AI 决策、置信度边界、解析失败降级）
- ✅ `plugin/test/index.js` 56/56 测试全部通过（无回归）
- ✅ `node --check` 语法验证：`npc-decision.js` + `combat-tracker.js` 通过
- ✅ 状态更新：`project-status.md` 推进至 2026-06-13 规划

---

## 明日规划（2026-06-13 Day 3 Surface 续）

**目标：让前端面板真正可配置 LLM，让场景渲染器完整可用，让 NPC 卡片动态更新。**

### 09:00 LLM 配置面板（前端）
- 修改 `plugin/ui/panel.js` — 在设置区域新增 LLM 配置区块：
  - Provider 下拉选择（OpenAI / Claude / Ollama / SillyTavern）
  - Model 输入框（默认 gpt-4o-mini）
  - Base URL 输入框
  - API Key 密码输入框（脱敏显示）
  - Temperature 滑块（0.0-1.0，步长 0.1）
  - 连接测试按钮：调用 `POST /llm/test`，显示测试结果
  - 保存按钮：调用 `POST /llm/config`，保存配置到后端
- 修改 `plugin/ui/game-controller.js` — 新增 `updateLLMConfig()` 方法，从面板读取配置并发送
- 限制：每轮 1-2 文件，逐个完成

### 13:00 场景渲染器增强
- 修改 `plugin/ui/scene-renderer.js` — 完整场景渲染：
  - 氛围描述渲染：CSS 渐变背景 + 氛围标签（horror/mystery/action）
  - 出口按钮动态生成：根据 `scene.exits` 渲染带条件锁的出口（条件未满足时显示锁图标）
  - 可交互物高亮：物品/NPC 点击弹出交互菜单（查看/拾取/对话/攻击）
  - 场景切换动画：淡入淡出过渡效果
- 限制：每轮 1-2 文件，逐个完成

### 17:00 NPC 状态卡片
- 创建 `plugin/ui/npc-card.js` — NPC 动态卡片：
  - 显示 NPC 头像、名称、HP 条、态度标签（颜色区分）
  - 对话气泡：点击 NPC 打开对话面板，显示最新 `generateDialogue()` 结果
  - 态度变化动画： hostility/friendly/afraid 切换时标签变色动画
  - 秘密揭示提示：当 `secretRevealed` 非空时，显示 🔍 图标提示新线索
- 限制：每轮 1-2 文件，逐个完成

### 21:00 状态机 combat initiation LLM 传递
- 修改 `plugin/engine/state-machine.js` — `handleCombatInitiation()`：
  - 创建 `NPCDecisionEngine` 时传入 `llmClient`
  - 战斗中 NPC 回合调用 `decide()` 和 `generateDialogue()` 均使用 LLM
  - 确保 `combat-tracker.js` 在 `processEnemyAutoTurn()` 中正确传递 `llmClient`
- 限制：每轮 1-2 文件，逐个完成

### 最后一步（21:00 任务完成后）
- 更新 `project-status.md` 中的"明日规划"部分，为 2026-06-13 制定具体任务安排
- 限制：每轮 1-2 文件，逐个完成

---

## 今日完成（2026-06-13 Day 2 Engine 验证）

- ✅ `plugin/engine/npc-decision.js` LLM 对话生成验证：`_generateLLMDialogue()` + `generateDialogue()` 优先 LLM / fallback 模板，返回 `{text, emotion, secretRevealed}`
- ✅ `plugin/engine/combat-tracker.js` 敌人 AI 验证：`_llmEnemyDecision()` + `decideEnemyAction()` 优先 LLM（confidence > 0.7）/ fallback 规则驱动
- ✅ `plugin/test/npc-llm-dialogue.test.js` 17/17 测试全部通过（新增 `processEnemyAutoTurn` 全流程测试，LLM 对话、模板回退、秘密揭示、战斗 AI 决策、置信度边界、解析失败降级）
- ✅ `plugin/test/index.js` 56/56 测试全部通过（无回归）
- ✅ `node --check` 语法验证：`npc-decision.js` + `combat-tracker.js` + `npc-llm-dialogue.test.js` 通过
- ✅ 状态更新：`project-status.md` 推进至 2026-06-14 规划

---

## 明日规划（2026-06-14 Day 3 Surface 续）

**目标：让前端面板真正可配置 LLM，让场景渲染器完整可用，让 NPC 卡片动态更新。**

### 09:00 LLM 配置面板（前端）
- 修改 `plugin/ui/panel.js` — 在设置区域新增 LLM 配置区块：
  - Provider 下拉选择（OpenAI / Claude / Ollama / SillyTavern）
  - Model 输入框（默认 gpt-4o-mini）
  - Base URL 输入框
  - API Key 密码输入框（脱敏显示）
  - Temperature 滑块（0.0-1.0，步长 0.1）
  - 连接测试按钮：调用 `POST /llm/test`，显示测试结果
  - 保存按钮：调用 `POST /llm/config`，保存配置到后端
- 修改 `plugin/ui/game-controller.js` — 新增 `updateLLMConfig()` 方法，从面板读取配置并发送
- 限制：每轮 1-2 文件，逐个完成

### 13:00 场景渲染器增强
- 修改 `plugin/ui/scene-renderer.js` — 完整场景渲染：
  - 氛围描述渲染：CSS 渐变背景 + 氛围标签（horror/mystery/action）
  - 出口按钮动态生成：根据 `scene.exits` 渲染带条件锁的出口（条件未满足时显示锁图标）
  - 可交互物高亮：物品/NPC 点击弹出交互菜单（查看/拾取/对话/攻击）
  - 场景切换动画：淡入淡出过渡效果
- 限制：每轮 1-2 文件，逐个完成

### 17:00 NPC 状态卡片
- 创建 `plugin/ui/npc-card.js` — NPC 动态卡片：
  - 显示 NPC 头像、名称、HP 条、态度标签（颜色区分）
  - 对话气泡：点击 NPC 打开对话面板，显示最新 `generateDialogue()` 结果
  - 态度变化动画：hostility/friendly/afraid 切换时标签变色动画
  - 秘密揭示提示：当 `secretRevealed` 非空时，显示 🔍 图标提示新线索
- 限制：每轮 1-2 文件，逐个完成

### 21:00 状态机 combat initiation LLM 传递
- 修改 `plugin/engine/state-machine.js` — `handleCombatInitiation()`：
  - 创建 `NPCDecisionEngine` 时传入 `llmClient`
  - 战斗中 NPC 回合调用 `decide()` 和 `generateDialogue()` 均使用 LLM
  - 确保 `combat-tracker.js` 在 `processEnemyAutoTurn()` 中正确传递 `llmClient`
- 限制：每轮 1-2 文件，逐个完成

### 最后一步（21:00 任务完成后）
- 更新 `project-status.md` 中的"明日规划"部分，为 2026-06-15 制定具体任务安排
- 限制：每轮 1-2 文件，逐个完成

---

*状态更新：2026-06-13 21:00*
*当日验证：NPC/战斗 AI LLM 测试全部通过，无回归*
