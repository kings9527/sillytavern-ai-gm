# AI-GM 用户使用说明书

**项目**: sillytavern-ai-gm
**版本**: v1.0.0（待发布）
**最后更新**: 2026-06-10

---

## 目录

1. [安装指南](#安装指南)
2. [快速开始](#快速开始)
3. [界面说明](#界面说明)
4. [模组制作](#模组制作)
5. [FAQ](#faq)

---

## 安装指南

### 前置条件

- SillyTavern 已安装并运行（版本 ≥ 1.12.0）
- Node.js ≥ 18.0.0
- （可选）Ollama / OpenAI API Key / Claude API Key

### 安装步骤

1. 下载 AI-GM 插件包
2. 解压到 `SillyTavern/data/default-user/extensions/sillytavern-ai-gm/`
3. 重启 SillyTavern
4. 在 SillyTavern 设置面板中启用 AI-GM 插件
5. 配置 LLM 参数（见下方）

### LLM 配置

AI-GM 支持四种 LLM 后端：

| Provider | 配置项 | 说明 |
|----------|--------|------|
| **SillyTavern Proxy** | 无需配置 | 直接使用 ST 的 LLM 连接 |
| **OpenAI** | `AI_GM_LLM_PROVIDER=openai` + `AI_GM_LLM_API_KEY=sk-...` | GPT-4 / GPT-3.5 |
| **Claude** | `AI_GM_LLM_PROVIDER=claude` + `AI_GM_LLM_API_KEY=sk-ant-...` | Claude 3 系列 |
| **Ollama** | `AI_GM_LLM_PROVIDER=ollama` + `AI_GM_LLM_BASE_URL=http://localhost:11434` | 本地模型 |

配置方式：
- 方式一：环境变量（`.env` 文件）
- 方式二：AI-GM 配置面板（SillyTavern 插件设置）
- 方式三：后端 API `POST /llm/config`

---

## 快速开始

### 1. 启动游戏

在 SillyTavern 聊天界面中：
- 点击 AI-GM 面板上的 **"开始新游戏"**
- 选择模组（如「阿卡姆之夜」）
- 输入角色名，分配属性点（STR/CON/DEX/INT/POW/EDU）
- 点击 **"创建角色并进入"**

### 2. 基本操作

| 操作 | 方式 |
|------|------|
| **移动** | 点击场景下方的出口按钮（如「前往图书馆」） |
| **调查** | 输入文字如「调查书架」或「使用侦查」 |
| **对话** | 点击 NPC 头像或输入「和[名字]说话」 |
| **战斗** | 进入战斗场景后自动触发，选择「攻击/逃跑/使用物品」 |
| **检定** | 输入技能名自动触发（如「图书馆使用」「聆听」） |
| **存档** | 点击面板上的「存档」按钮，选择存档位 |
| **读档** | 点击「读档」按钮，选择之前保存的存档 |

### 3. 检定系统（CoC 7e）

- **普通成功**：骰子 ≤ 技能值
- **困难成功**：骰子 ≤ 技能值/2
- **极难成功**：骰子 ≤ 技能值/5
- **大成功**：骰子 = 1
- **失败**：骰子 > 技能值
- **大失败**：骰子 = 100（或 96-100，取决于技能值）

---

## 界面说明

### 主面板

```
┌─────────────────────────────────────┐
│  AI-GM 面板                          │
├─────────────────────────────────────┤
│  [场景标题]                          │
│  场景描述文字...                      │
│                                     │
│  [NPC1] [NPC2] [NPC3]              │
│                                     │
│  [出口1] [出口2] [出口3]           │
├─────────────────────────────────────┤
│  玩家状态                            │
│  HP: ████████░░  SAN: ██████░░░░    │
│  STR: 60 CON: 55 DEX: 70            │
│  INT: 80 POW: 65 EDU: 75            │
├─────────────────────────────────────┤
│  [掷骰] [存档] [读档] [设置]       │
└─────────────────────────────────────┘
```

### 战斗面板

```
┌─────────────────────────────────────┐
│  ⚔️ 战斗回合 3                       │
│                                     │
│  玩家 HP: 12/15 | SAN: 45/60        │
│                                     │
│  敌人:                             │
│  - 深潜者 A: HP 3/8 (敌对)         │
│  - 深潜者 B: HP 0/8 (已击败)       │
│                                     │
│  [攻击] [逃跑] [使用物品] [跳过]    │
│                                     │
│  战斗日志:                         │
│  回合2: 玩家攻击 → 深潜者A 受到 5 点伤害│
│  回合2: 深潜者A 攻击 → 玩家 受到 2 点伤害│
└─────────────────────────────────────┘
```

### LLM 配置面板

在 SillyTavern 设置中找到 AI-GM 插件设置：
- **Provider**: 选择 LLM 后端
- **Model**: 输入模型名（如 gpt-4, claude-3-opus）
- **Temperature**: 控制随机性（0.0-1.0，建议 0.7）
- **Max Tokens**: 最大输出长度（建议 2048）
- **测试连通性**: 点击「测试」按钮验证 LLM 连接

---

## 模组制作

### 模组结构

模组是一个 JSON 文件或 Markdown 文件，包含：

```json
{
  "id": "my-module",
  "name": "我的模组",
  "version": "1.0.0",
  "system": "coc7e",
  "scenes": [...],
  "npcs": [...],
  "items": [...],
  "endings": [...]
}
```

### 场景定义

```json
{
  "id": "library",
  "name": "密斯卡托尼克大学图书馆",
  "description": "古老的书架排列在阴影中...",
  "atmosphere": "阴冷、潮湿，充满霉味",
  "exits": [
    { "label": "前往大厅", "target": "hall", "condition": null },
    { "label": "调查禁书区", "target": "forbidden", "condition": { "skill": "图书馆使用", "value": 50 } }
  ],
  "npcs": ["librarian"],
  "events": [
    {
      "id": "find_clue",
      "trigger": { "type": "skill", "skill": "图书馆使用", "min_value": 50 },
      "effects": [
        { "type": "add_clue", "clue": "古老仪式的记载" },
        { "type": "sanity_loss", "amount": "1d3" }
      ]
    }
  ]
}
```

### NPC 定义

```json
{
  "id": "librarian",
  "name": "亨利·阿米蒂奇",
  "description": "年迈的图书馆管理员，对古籍了如指掌",
  "stats": { "HP": 10, "STR": 40, "CON": 50, "DEX": 30, "INT": 80, "POW": 60, "EDU": 90 },
  "attitude": "neutral",
  "secrets": ["知道禁书区的秘密入口"],
  "topics": {
    "禁书区": { "response": "那里...不，你不该去那里", "requires_knowledge": null },
    "古老仪式": { "response": "我在一本1832年的手稿中见过类似的描述", "requires_knowledge": "find_clue" }
  }
}
```

### 结局定义

```json
{
  "id": "good_ending",
  "name": "真相大白",
  "description": "你成功阻止了邪教徒的阴谋，阿卡姆恢复了平静",
  "conditions": [
    { "type": "clue", "clue": "邪教计划" },
    { "type": "combat", "enemy": "cult_leader", "status": "defeated" }
  ]
}
```

### Markdown 格式（可选）

```markdown
---
id: my-module
name: 我的模组
version: 1.0.0
system: coc7e
---

# 场景：图书馆

**id**: library

古老的书架排列在阴影中，只有几盏昏黄的灯照亮着角落。

**atmosphere**: 阴冷、潮湿，充满霉味

## 出口

- [前往大厅](hall)
- [调查禁书区](forbidden)（需要：图书馆使用 ≥ 50）

## NPC

- [亨利·阿米蒂奇](npcs/librarian.md)

### 事件：发现线索

**触发**：图书馆使用 ≥ 50

**效果**：
- 获得线索：古老仪式的记载
- 理智损失 1d3
```

---

## FAQ

### Q: 为什么 NPC 不说话？
A: 检查 LLM 配置是否正确。如果使用 SillyTavern Proxy，确保 ST 已连接 LLM。如果 LLM 不可用，NPC 会自动降级到模板对话。

### Q: 战斗太简单/太难了？
A: 模组中的敌人 stats 可以调整。HP、STR、DEX 等属性直接影响战斗难度。建议在模组 JSON 中平衡敌人属性。

### Q: 如何添加自定义技能？
A: 在模组 JSON 的 `player_skills` 字段中添加，格式与 `player_stats` 相同。AI-GM 会自动识别任何输入中的技能名。

### Q: 存档可以跨模组使用吗？
A: 不可以。存档与模组绑定，加载其他模组的存档会导致数据不匹配。

### Q: 如何制作多结局？
A: 在模组 JSON 的 `endings` 数组中定义多个结局，每个结局有 `conditions` 字段。游戏结束时，状态机会按顺序检查所有结局条件，第一个满足的即为结局。

### Q: 支持多人游戏吗？
A: 当前版本仅支持单人模式。多人模式在路线图（Phase 3）中规划。

### Q: 如何报告 Bug？
A: 在 GitHub 仓库提交 issue，附上模组文件、存档文件和错误日志。

---

*本手册随项目更新，如有疑问请查阅最新版本。*
