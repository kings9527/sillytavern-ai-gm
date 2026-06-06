# AI-GM 开发上下文保护机制

## 问题
在 7 天冲刺期间，AI-GM 开发需要跨会话保持上下文。防止上下文丢失导致项目混乱。

## 解决方案：三层上下文保护

### 第一层：会话检查点（SESSION_CHECKPOINT.md）
每次 AI-GM 开发会话结束后，立即写入检查点文件。

**内容格式**：
```markdown
# 检查点：YYYY-MM-DD HH:MM

## 本次完成
- 修改的文件：plugin/engine/npc-decision.js
- 关键代码变更：...（100字内摘要）
- 测试结果：通过/失败

## 当前代码状态
- 正在修改的模块：NPC 决策引擎
- 当前进度：第 X 行附近 / 第 Y 个函数
- 已知问题：...

## 下次任务
- 优先级1：...
- 优先级2：...

## 决策记录
- 决定 X：原因...
- 放弃 Y：原因...

## 文件指纹（关键函数签名）
- npc-decision.js: `decideCombatAction()` 返回 `{action, target, reason}`
- state-machine.js: `interact` 分支已接入 NPC 对话
```

### 第二层：项目状态看板（project-status.md）
每次会话结束后更新项目状态看板，保持完成度准确。

### 第三层：MEMORY.md 长期记录
重大决策和技术选型写入 MEMORY.md 的 Decisions Log。

---

## 执行协议

### 每次 AI-GM 会话开始前（21:00）
1. **读取 SESSION_CHECKPOINT.md**（最近一条）
2. **读取 project-status.md**
3. **确认当前任务**：与检查点中的"下次任务"对齐

### 每次 AI-GM 会话结束时（23:00 或任务完成）
1. **写入 SESSION_CHECKPOINT.md**（新条目追加到顶部）
2. **更新 project-status.md**（完成度、已知问题、文件清单）
3. **如发生异常或错误**：写入 memory/YYYY-MM-DD.md

### 安全规则
- SESSION_CHECKPOINT.md 只追加，不覆盖
- 如果会话中断，下次从最近检查点恢复
- 检查点包含足够信息，让下一个会话能无缝续写代码
- 关键代码片段（>3行）直接写入检查点，防止文件位置偏移

---

## 检查点文件位置
`sillytavern-ai-gm/SESSION_CHECKPOINT.md`

*创建时间: 2026-06-06*
*目的: 7 天冲刺期间防止上下文丢失*
