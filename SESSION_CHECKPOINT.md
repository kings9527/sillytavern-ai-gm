# AI-GM 开发会话检查点

## 检查点：2026-06-06 18:20（方法论确认）

### 用户关键指令
- **Day 1 开始时间**：今晚 21:00（不是明天）
- **衔接要求**：紧跟上一次项目代码，不从头开始
- **方法论**：已确认五层衔接防护方案（契约文件/集成测试/事件总线/验证中间件/同文件文档）
- **Day 1 任务**：NPC 决策引擎（`plugin/engine/npc-decision.js`），从骨架补全为规则驱动

### 五层衔接防护（已确认）
1. **契约文件**：`plugin/contracts/index.js` — 先定义接口，再写实现
2. **集成测试**：`plugin/test/integration.js` — 每完成模块立即跑全流程
3. **事件总线**：`plugin/engine/event-bus.js` — 模块间不直接调用
4. **验证中间件**：`plugin/middleware/validator.js` — 边界处强制验证数据格式
5. **同文件文档**：JSDoc 注释 — 接口格式与代码同文件

### 21:00 开始时的读取顺序
1. 读 `SESSION_CHECKPOINT.md`（本文件）
2. 读 `project-status.md`（模块完成度）
3. 读 `plugin/engine/npc-decision.js`（当前骨架代码）
4. 读 `plugin/contracts/index.js`（如果已存在）
5. 开始写：先创建契约文件，再补全 NPC 决策引擎

---

## 检查点：2026-06-06 18:10（计划日）

### 当前冲刺阶段
- **Day 0**（计划日）
- 7 天冲刺计划已制定：`plan-week-1-sprint.md`
- 目标：2026-06-13 首次单人跑团测试

### 当前代码状态（全局快照）

#### 已完成模块（可直接复用）
| 模块 | 文件 | 状态 | 关键接口 |
|------|------|------|----------|
| 状态机 | `plugin/engine/state-machine.js` | ✅ 70% | `processAction(type, action)` |
| 规则引擎 | `plugin/engine/rule-engine.js` | ✅ 70% | `d100Check(skill, difficulty)`, `calculateDamageBonus()` |
| 骰子系统 | `plugin/engine/dice.js` | ✅ 80% | `roll(expression)`, `history` |
| 战斗系统 | `plugin/engine/combat-tracker.js` | ✅ 70% | `initCombat(actors)`, `processTurn(action)`, `getCombatSummary()` |
| 存档系统 | `plugin/storage/campaign.js` | ✅ 60% | `saveSnapshot(slot, label)`, `loadSnapshot(slot)` |
| 提示词构建 | `plugin/utils/prompt-builder.js` | ✅ 70% | `buildGmPrompt()`, `buildNpcPrompt()` |
| 模组解析器 | `plugin/engine/module-parser.js` | ✅ 40% | `parseModule(json)` — JSON 可用，Markdown 待实现 |
| 测试模组 | `plugin/test/index.js` | ✅ 80% | 全模块测试（内存溢出待修复） |

#### 未完成模块（当前缺口）
| 模块 | 文件 | 进度 | 关键缺口 |
|------|------|------|----------|
| **NPC 决策引擎** | `plugin/engine/npc-decision.js` | **25%** | 骨架状态，需补全规则驱动逻辑 |
| 模组解析器 | `plugin/engine/module-parser.js` | 40% | Markdown 解析待实现 |

#### 测试模组数据（「阿卡姆之夜」）
- 5 场景：`entrance`, `lobby`, `library`, `basement`, `cellar`
- 4 NPC：馆长、图书管理员、地下研究员、邪教首领
- 2 结局：`escape`（成功逃脱）、`insane`（SAN 归零疯狂）
- 文件：`plugin/test/module-data.json`（或类似位置）

### 待执行栈（按优先级排序）

1. **Day 1 (06-07)** — NPC 决策引擎补全
   - 目标：规则驱动的 NPC 行为（对话/战斗/逃跑）
   - 关键文件：`plugin/engine/npc-decision.js`
   - 已知接口：NPC 有 `attitude` 字段（neutral/friendly/hostile）
   - 状态机已接入 NPC 对话分支，但决策逻辑未实现

2. **Day 2 (06-08)** — 模组解析器 + 边界修复
   - Markdown 解析（或确认用 JSON 暂代）
   - 场景事件多次触发边界
   - 战斗结束清理边界

3. **Day 3 (06-09)** — 存档修复 + 测试修复
   - 存档读取后 combat_state 恢复
   - test/index.js 内存溢出

4. **Day 4 (06-10)** — 类型安全 + 输入验证

5. **Day 5 (06-11)** — 集成测试（端到端跑通）

6. **Day 6 (06-12)** — 性能优化

7. **Day 7 (06-13)** — 测试准备日

---

## 技术债务记录（滚动更新）
- 存档内存存储，重启丢失（SQLite 待 Phase 2）
- 状态机意图解析仅关键词匹配（LLM 升级 Phase 2）
- NPC 决策 LLM 调用未接入 SillyTavern 生成系统（Phase 2）
- 缺少 ESLint/Prettier 配置（Day 4 Pipeline）
- 日志系统未实现（Winston/Pino 待 Phase 2）

---

## 关键决策记录
- 2026-06-06：AI-GM 是 SillyTavern 插件，不是独立项目。复用 ST 端点：角色系统、图像生成、聊天记录、WorldInfo、向量检索。
- 2026-06-06：卸载 `dnd-character-generator` 技能，ST 已有 `/api/sd/generate` 和 `/api/comfy/generate`。
- 2026-06-06：7 天冲刺计划制定，不影响每日 ST 任务。

---

*检查点格式：新条目追加到顶部，旧条目保留供追溯*
*本文件由 AI-GM 开发会话结束时更新，由新会话开始时读取*

---

## 检查点：2026-06-07 23:55（Day 1 完成）

### Day 1 任务：NPC 决策引擎 ✅ 完成

#### 交付成果
| 文件 | 状态 | 说明 |
|------|------|------|
| `plugin/contracts/index.js` | ✅ 新增 | 三层契约：NPCDecisionEngineContract、EventBusContract、ValidatorContract |
| `plugin/engine/npc-decision.js` | ✅ 从 25% → 100% | 规则驱动决策引擎：态度状态机、对话生成、状态更新、状态摘要 |
| `plugin/engine/state-machine.js` | ✅ 修改 | `handleTalk` 异步化并接入 NPCDecisionEngine；`processAction` 调用处加 `await` |
| `plugin/test/integration.js` | ✅ 修改 | 18 项断言（Step 9 新增 4 项 NPC 决策引擎专项断言） |

#### 集成测试：18/18 passing ✅
```
Step 1: Campaign Creation       ✅
Step 2: Scene Loading           ✅
Step 3: NPC Interaction         ✅
Step 4: Scene Transition        ✅
Step 5: Skill Check             ✅
Step 6: Basement Combat         ✅
Step 7: Combat System           ✅
Step 8: Save/Load               ✅
Step 9: NPC Decision Engine     ✅ (4/4)
```

#### 关键修复记录
1. **`findMatchingExit` confidence 阈值**：`> 0.85` → `>= 0.85`（0.85 的 evade 规则被正确触发）
2. **`handleTalk` 中 `updateState` trust 逻辑**：`decision.action === 'talk'` 时默认 +5 trust
3. **测试场景路径修复**：cultist 测试需要从 entrance → library → basement（entrance 无直达 basement 的 exit）
4. **单 NPC 默认匹配陷阱**：`handleTalk` 中 `!matchedNPC && npcs.length === 1` 导致错误场景下匹配到 guard

#### 契约验证
- ✅ NPCDecisionEngineContract 被 `NPCDecisionEngine` 继承（`extends`）
- ✅ 集成测试覆盖：guard 对话（neutral → 友好）、cultist 邪教话题（evade + suspicious）、状态摘要（is_alive + attitude）

#### 方法论执行
- 五层衔接防护：契约文件 → 集成测试 → 状态机接入 → 验证通过
- 不请示、直接执行、不重复询问打包/交付
- 当前时间：2026-06-07 23:55，未到交付时间（周六 2026-06-12）

#### 下一步（Day 2）
根据 `plan-week-1-sprint.md`：模组解析器 + 边界修复（Markdown 解析或 JSON 暂代、场景事件多次触发边界、战斗结束清理边界）

---
