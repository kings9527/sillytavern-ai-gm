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

## 下一步（Day 3·Guard）

### 测试框架
- [ ] 修复 test/index.js 内存溢出问题（Node 16 环境循环引用？）
- [ ] 添加 Jest 测试框架或改用轻量测试方案
- [ ] 编写单元测试覆盖所有 engine 模块

### Bug 修复
- [ ] 测试场景事件在多次触发的边界处理
- [ ] 战斗结束时清理 combat_state 的边界检查
- [ ] 存档读取后恢复 combat_state 的完整性

### 类型安全
- [ ] 添加 JSDoc 类型注解到所有公共 API
- [ ] 参数验证中间件（统一 schema 验证）
- [ ] 输入 sanitization（防止 XSS 注入到 narration）

---

## 已知问题

1. ✅ 前端 Extension 已连接后端 API（health check → 模组加载 → 场景显示）
2. 状态机意图解析仅用关键词匹配，需 LLM 升级（Phase 2）
3. NPC 决策的 LLM 调用尚未接入 SillyTavern 生成系统
4. 存档系统使用内存存储，重启丢失（SQLite 待 Phase 2）
5. 缺少 ESLint 配置（Day 4 Pipeline）

---

## 文件清单

```
sillytavern-ai-gm/
├── manifest.json              ✅
├── index.js                   ✅ Day1 完善：API连接 + UI交互
├── style.css                  ✅ Day1 新增：状态条/出口/加载/弹窗样式
├── README.md                  ✅
├── docs/
│   ├── rate-limiting.md       ✅
│   └── module-format.md       📋 待写
└── plugin/
    ├── index.js               ✅ Day1 完善：错误处理 + dice_check + 场景切换
    ├── package.json           ✅ Day1 新增：测试脚本
    ├── .env.example           ✅ Day1 新增：环境配置模板
    ├── test/
    │   └── index.js           ✅ Day1 新增：全模块测试
    ├── engine/
    │   ├── module-parser.js   ✅
    │   ├── state-machine.js   ✅
    │   ├── rule-engine.js     ✅
    │   ├── dice.js            ✅
    │   ├── combat-tracker.js  ✅
    │   └── npc-decision.js    ✅
    ├── storage/
    │   └── campaign.js        ✅
    └── utils/
        └── prompt-builder.js  ✅
```

## 技术债务

- [ ] 添加 Jest 测试框架（当前为简单 Node.js 测试）
- [ ] 配置 ESLint + Prettier（Day 4）
- [ ] 实现 SQLite 持久化（Phase 2）
- [ ] 接入 SillyTavern 的 LLM 生成系统（Phase 2）
- [ ] 添加日志系统（Winston/Pino）
- [ ] 实现错误追踪（Sentry 或简单文件日志）

---

*状态更新：2026-06-06 09:15*  
*Git Commit: 10f0dfe - feat(surface): Day 1 frontend panel + backend API + error handling*
