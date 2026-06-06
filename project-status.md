# AI-GM 项目状态

**项目**: sillytavern-ai-gm  
**当前阶段**: Phase 1 MVP（单人 CoC 跑团）  
**最后更新**: 2026-06-06  

---

## 完成度

| 模块 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **前端 Extension** | ✅ Day1 完成 | 60% | 面板 + API连接 + 场景/NPC/玩家状态UI + 掷骰/存档弹窗 + 加载状态 |
| **后端 Plugin** | ✅ Day1 完成 | 60% | 路由完善 + 错误中间件 + dice_check分支 + 场景切换 + 中文 narration |
| **模组解析器** | ✅ 基础 | 40% | JSON 解析 + Markdown 占位 |
| **状态机** | ✅ 基础 | 40% | 场景切换 + 意图解析（关键词匹配）+ 场景出口按钮 |
| **规则引擎** | ✅ COC 7e | 55% | d100 检定 + SAN 计算 + 伤害公式 + 中文 narration |
| **骰子系统** | ✅ 完成 | 80% | 多面骰 + 表达式 + 历史记录 |
| **战斗系统** | 🚧 基础 | 40% | 先攻 + 回合 + 攻击结算 |
| **NPC 决策** | 🚧 骨架 | 25% | 规则驱动 + LLM 占位 |
| **存档系统** | 🚧 骨架 | 20% | 内存存档 + 存/读 API，SQLite 待 Phase 2 |
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

## 下一步（Day 2·Engine）

### 状态机增强
- [ ] 添加 `dice_check` 触发场景事件的条件判断
- [ ] 实现 `interact` 动作类型（检查物品、阅读古籍）
- [ ] 场景事件系统：`library_whispers` 等随机事件触发

### 战斗系统完善
- [ ] 玩家 HP 同步到前端状态条
- [ ] 敌人攻击回合自动处理
- [ ] 伤害计算公式接入 RuleEngine

### CoC 规则完善
- [ ] 技能检定请求自动生成 `[ROLL: 技能名 目标值]` 提示词标记
- [ ] SAN 损失自动计算并更新玩家状态
- [ ] 追逐规则（Chase）基础框架

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
