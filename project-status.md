# AI-GM 项目状态

**项目**: sillytavern-ai-gm  
**当前阶段**: Phase 1 MVP（单人 CoC 跑团）  
**最后更新**: 2026-06-06  

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
| **战斗系统** | ✅ Day2 完成 | 70% | 先攻 + 回合 + 攻击结算 + 敌人AI + HP同步 + 战斗日志 |
| **NPC 决策** | 🚧 骨架 | 25% | 规则驱动 + LLM 占位 |
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

## 技术债务（移至 Phase 2）

- [ ] Jest 正式测试框架（当前为断言测试）
- [ ] SQLite 持久化（Phase 2）
- [ ] 接入 SillyTavern LLM 生成（Phase 2）
- [ ] Winston/Pino 日志系统
- [ ] Markdown 模组解析器增强（YAML 库替代、更复杂的 Markdown 结构）
- [ ] 意图解析关键词匹配 → LLM 升级（Phase 2）

---

*状态更新：2026-06-08 21:00*  
*Git Commit: 5f57837 - feat(parser): Day 2 Engine - complete module parser with full validation + markdown support*
