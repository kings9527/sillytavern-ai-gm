# AI-GM 项目状态

**项目**: sillytavern-ai-gm  
**当前阶段**: Phase 1 MVP（单人 CoC 跑团）  
**最后更新**: 2026-06-06  

---

## 完成度

| 模块 | 状态 | 完成度 | 说明 |
|------|------|--------|------|
| **前端 Extension** | 🚧 骨架 | 20% | manifest + 面板 HTML + CSS，事件绑定待完善 |
| **后端 Plugin** | 🚧 骨架 | 30% | 路由注册 + 测试模组 + 引擎接口 |
| **模组解析器** | ✅ 基础 | 40% | JSON 解析 + Markdown 占位 |
| **状态机** | 🚧 基础 | 30% | 场景切换 + 意图解析（关键词匹配） |
| **规则引擎** | ✅ COC 7e | 50% | d100 检定 + SAN 计算 + 伤害公式 |
| **骰子系统** | ✅ 完成 | 80% | 多面骰 + 表达式 + 历史记录 |
| **战斗系统** | 🚧 基础 | 40% | 先攻 + 回合 + 攻击结算 |
| **NPC 决策** | 🚧 骨架 | 25% | 规则驱动 + LLM 占位 |
| **存档系统** | 📋 待实现 | 0% | 需要 SQLite 集成 |
| **提示词构建** | ✅ 完成 | 70% | GM/NPC/场景/战斗/SAN 提示词 |
| **测试模组** | ✅ 完成 | 100% | 「阿卡姆之夜」5 场景 4 NPC 2 结局 |
| **限流方案** | ✅ 文档 | 100% | 已写入 docs/rate-limiting.md |

---

## 下一步（Day 1·Surface）

### 09:00 开发任务

1. **前端面板完善**
   - 连接后端 API（health check → 模组加载 → 场景显示）
   - 添加场景切换按钮
   - NPC 状态显示

2. **后端路由补全**
   - 补完 `/campaign/create` 的完整逻辑
   - 实现 `/state/action` 的 dice_check 分支
   - 添加错误处理中间件

3. **开发环境配置**
   - 创建 `.env.example`
   - 配置 mock 模式开关
   - 添加测试脚本

---

## 已知问题

1. 前端 Extension 未实际连接后端 API（仅有占位函数）
2. 状态机意图解析仅用关键词匹配，需 LLM 升级
3. NPC 决策的 LLM 调用尚未接入 SillyTavern 生成系统
4. 存档系统使用内存存储，重启丢失
5. 缺少 ESLint 配置和测试框架

---

## 文件清单

```
sillytavern-ai-gm/
├── manifest.json              ✅
├── index.js                   ✅ 前端骨架
├── style.css                  ✅
├── README.md                  ✅
├── docs/
│   ├── rate-limiting.md       ✅ 限流方案
│   └── module-format.md       📋 待写
└── plugin/
    ├── index.js               ✅ 路由 + 测试模组
    ├── package.json           ✅
    ├── engine/
    │   ├── module-parser.js   ✅
    │   ├── state-machine.js   ✅
    │   ├── rule-engine.js     ✅
    │   ├── dice.js            ✅
    │   ├── combat-tracker.js  ✅
    │   └── npc-decision.js    ✅
    ├── storage/
    │   └── campaign.js        ✅ 骨架
    └── utils/
        └── prompt-builder.js  ✅
```

---

## 技术债务

- [ ] 添加 Jest 测试框架
- [ ] 配置 ESLint + Prettier
- [ ] 实现 SQLite 持久化
- [ ] 接入 SillyTavern 的 LLM 生成系统（而非独立调用）
- [ ] 添加日志系统（Winston/Pino）
- [ ] 实现错误追踪（Sentry 或简单文件日志）

---

*状态更新：2026-06-06 02:10*
