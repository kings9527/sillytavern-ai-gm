# AI-GM Module Format Specification

## Overview

AI-GM modules define TTRPG adventures (scenarios, NPCs, combat encounters, endings) in JSON or Markdown format. This document describes the JSON format.

---

## File Structure

```
module-name/
├── module.json          # Main module file
├── scenes/
│   ├── scene-1.md       # Optional per-scene markdown
│   └── scene-2.md
└── assets/
    └── image.png
```

---

## Module Schema

### Top-Level Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | ✅ | Unique module identifier (kebab-case) |
| `name` | string | ✅ | Display name (Chinese or English) |
| `version` | string | ✅ | SemVer version |
| `system` | string | ✅ | Rule system: `"coc7e"`, `"dnd5e"`, `"general"` |
| `description` | string | ❌ | Short description |
| `author` | string | ❌ | Author name |
| `scenes` | object | ✅ | Scene map: `{ [sceneId]: Scene }` |
| `npcs` | object | ✅ | NPC map: `{ [npcId]: NPC }` |
| `endings` | object | ❌ | Ending map: `{ [endingId]: Ending }` |
| `items` | object | ❌ | Item definitions |
| `global_events` | array | ❌ | Events that can trigger in any scene |
| `tags` | array | ❌ | String tags for categorization |

---

## Scene Object

```json
{
  "id": "library",
  "title": "密斯卡托尼克大学图书馆",
  "description": "古老的书架排列在两侧...",
  "atmosphere": "quiet",           // Optional: quiet, tense, combat, horror
  "exits": [
    {
      "target": "basement",
      "label": "前往地下室",
      "condition": {               // Optional condition
        "type": "flag",
        "key": "found_key",
        "value": true
      }
    }
  ],
  "npcs": ["librarian", "student"], // NPC IDs present in this scene
  "events": [Event],               // Scene-specific events
  "combat": {
    "enabled": false,              // Whether combat is allowed here
    "enemies": ["cultist"],        // Enemy IDs if combat enabled
    "environment": "indoor"        // Combat environment modifier
  },
  "items": ["old_book", "newspaper"], // Interactive items in scene
  "music": "library_theme.mp3",     // Optional ambient music
  "lighting": "dim"                 // Optional: bright, dim, dark
}
```

---

## NPC Object

```json
{
  "id": "librarian",
  "name": "老管理员",
  "attitude": "neutral",           // neutral | friendly | hostile | scared
  "hp": 8,
  "max_hp": 8,
  "stats": {
    "str": 35, "con": 40, "dex": 30,
    "int": 50, "pow": 40, "edu": 60,
    "siz": 50, "app": 45
  },
  "skills": {
    "图书馆使用": 65,
    "侦查": 30,
    "话术": 45
  },
  "dialogue": {
    "default": "这些书可都是珍品，别弄坏了。",
    "inspect": "那边角落有些关于本地传说的旧报纸。",
    "greet": "欢迎来到图书馆。",
    "combat": "退后！我会报警的！"
  },
  "ai": {
    "type": "rule",                // rule | llm | hybrid
    "combat_strategy": "defensive", // aggressive | defensive | support | flee
    "morale": 50                   // Willingness to fight (0-100)
  },
  "inventory": ["key", "book"],
  "knowledge": ["secret_passage"],  // Information NPC knows
  "is_enemy": false
}
```

---

## Event Object

```json
{
  "id": "hidden_door",
  "trigger": {
    "type": "action",              // action | scene | time | chance | skill
    "action": "inspect",           // For action type: move | inspect | talk | use | search
    "target": "bookshelf",         // Optional: target of action
    "chance": 100,                 // For chance type: 0-100 probability
    "time": 3,                     // For time type: turn count
    "skill": "侦查",               // For skill type: skill name
    "difficulty": "normal"          // normal | hard | extreme
  },
  "conditions": [                  // Additional conditions (all must match)
    {
      "type": "flag",              // flag | stat | item | scene | chance
      "key": "found_key",
      "value": true,
      "operator": "=="             // == | != | > | < | >= | <= | in
    }
  ],
  "effects": [
    {
      "type": "narration",
      "value": "你在书架后发现了一扇隐藏的门！"
    },
    {
      "type": "flag",
      "key": "found_hidden_door",
      "value": true
    },
    {
      "type": "stat_change",
      "target": "player",
      "stat": "sanity",
      "value": "-1d3"
    },
    {
      "type": "item",
      "action": "add",
      "item_id": "old_diary"
    },
    {
      "type": "npc_attitude",
      "npc_id": "librarian",
      "attitude": "friendly"
    },
    {
      "type": "scene_transition",
      "target": "secret_room"
    }
  ],
  "repeatable": false,             // Can this event trigger multiple times?
  "once_per_campaign": true      // Can trigger once across all saves?
}
```

---

## Effect Types

| Type | Fields | Description |
|------|--------|-------------|
| `narration` | `value` (string) | Display text to player |
| `flag` | `key`, `value` | Set campaign flag |
| `stat_change` | `target`, `stat`, `value` | Modify stat (dice expression supported) |
| `item` | `action` (add/remove), `item_id` | Modify inventory |
| `npc_attitude` | `npc_id`, `attitude` | Change NPC attitude |
| `scene_transition` | `target` | Move to another scene |
| `combat_start` | `enemies` (array) | Initiate combat |
| `sanity_check` | `difficulty`, `failure_effects` | Force SAN check |
| `sound` | `file` | Play sound effect |
| `music` | `file` | Change music |

---

## Ending Object

```json
{
  "id": "madness",
  "title": "理智的尽头",
  "description": "真相太过沉重，你的意识在恐惧中消散...",
  "type": "bad",                   // good | bad | neutral | secret
  "conditions": [                    // Optional: conditions to unlock
    {
      "type": "flag",
      "key": "sanity_below_10",
      "value": true
    }
  ],
  "epilogue": "你将在阿卡姆疗养院度过余生...",
  "unlock_hint": "让理智降至10以下" // Hint for how to unlock (if secret)
}
```

---

## Item Object

```json
{
  "id": "old_diary",
  "name": "古老的日记",
  "description": "封面写着'1865'，纸张已经泛黄...",
  "type": "clue",                  // weapon | armor | consumable | tool | clue | key
  "usable": true,
  "use_effects": [
    {
      "type": "narration",
      "value": "日记里记载了一个关于召唤仪式的传说..."
    },
    {
      "type": "flag",
      "key": "read_diary",
      "value": true
    }
  ],
  "combat_stats": {
    "damage": "1d3",
    "range": "melee"
  }
}
```

---

## Validation Rules

1. **ID uniqueness**: All IDs (scene, NPC, item, event) must be unique within module
2. **Scene references**: All `target` in exits must reference existing scene IDs
3. **NPC references**: All NPC IDs in scenes must be defined in `npcs`
4. **Circular scene prevention**: Scene exits must not create infinite loops (warning only)
5. **Required fields**: `id`, `name`, `version`, `system`, `scenes`, `npcs`
6. **Version format**: Must follow SemVer (`1.0.0`, `0.5.2-beta`, etc.)

---

## Example Minimal Module

```json
{
  "id": "test-module",
  "name": "测试模组",
  "version": "1.0.0",
  "system": "coc7e",
  "scenes": {
    "start": {
      "id": "start",
      "title": "起点",
      "description": "一切开始的地方。",
      "exits": [],
      "npcs": [],
      "combat": { "enabled": false }
    }
  },
  "npcs": {}
}
```

---

## Markdown Format (Future)

Modules may also be written in Markdown with YAML frontmatter:

```markdown
---
id: my-module
name: 我的模组
version: 1.0.0
system: coc7e
---

# 场景：图书馆

**id**: library
**atmosphere**: quiet

古老的书架排列在两侧...

## 出口
- [地下室](basement) — 需要: found_key

## NPC
- [librarian](npcs/librarian.md)

## 事件
### 隐藏的门
**触发**: 侦查技能
**效果**: 发现隐藏门
```

*Note: Markdown parser is planned for Phase 2. JSON format is fully supported now.*

---

*Specification version: 1.0.0*
*Last updated: 2026-06-07*
