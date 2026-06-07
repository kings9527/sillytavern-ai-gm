# 🤖 AI-GM — SillyTavern AI Game Master Plugin

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![SillyTavern Version](https://img.shields.io/badge/SillyTavern-%3E%3D1.18.0-green)](https://github.com/SillyTavern/SillyTavern)

> **AI-powered Game Master for SillyTavern** — Automated TTRPG hosting with NPC AI, rule engine, and dynamic story management.

## Features

- 🎲 **Automated GM**: AI-driven narrative, NPC roleplay, and rules adjudication
- 👤 **Single Player (MVP)**: Solo investigative horror with CoC 7e rules
- 🗺️ **Scene Management**: Dynamic scene transitions with state machine
- ⚔️ **Combat System**: Turn-based combat with initiative tracking
- 🧠 **NPC AI**: Independent decision-making and dialogue generation
- 💾 **Save/Load**: Campaign persistence with snapshot slots
- 🎭 **Horror Atmosphere**: Optimized for Cthulhu Mythos investigations

## Installation

### Prerequisites

- SillyTavern >= 1.18.0
- `enableServerPlugins: true` in `config.yaml`

### Method A: Git Clone (Recommended)

```bash
# Frontend Extension
cd SillyTavern/public/scripts/extensions/third-party
git clone https://github.com/kings9527/sillytavern-ai-gm.git

# Backend Plugin
ln -s sillytavern-ai-gm/plugin ../../../plugins/ai-gm

# Restart SillyTavern
```

### Method B: URL Install (when released)

1. In SillyTavern UI: **Extensions → Install Extension**
2. Enter: `https://github.com/kings9527/sillytavern-ai-gm`
3. Enable backend plugin in `plugins/` directory

## Quick Start

1. Load the **"Arkham Night"** test module (built-in Cthulhu scenario)
2. Create your investigator character
3. Start investigating!

## Architecture

```
sillytavern-ai-gm/
├── manifest.json              # Extension metadata
├── index.js                   # Frontend UI (GM Console panel)
├── style.css                  # Panel styles
└── plugin/                    # Backend Plugin
    ├── index.js               # API routes & game logic
    ├── engine/                # Core game engines
    │   ├── module-parser.js   # Markdown/JSON → module
    │   ├── state-machine.js   # Scene transitions & actions
    │   ├── rule-engine.js     # COC/D&D rules adjudication
    │   ├── dice.js            # Dice rolling
    │   ├── combat-tracker.js  # Turn-based combat
    │   └── npc-decision.js    # NPC AI behavior
    ├── storage/               # Persistence layer
    │   └── campaign.js        # SQLite save/load
    └── utils/
        └── prompt-builder.js  # LLM prompt construction
```

## Development

### Quick Setup

```bash
cd plugin
npm install
npm test        # Run all tests
npm run lint    # Check code style
npm run check   # Syntax check all files
```

### Dev Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `npm test` | Run all 29 tests |
| `test:dice` | `npm run test:dice` | Dice system tests |
| `lint` | `npm run lint` | ESLint check |
| `lint:fix` | `npm run lint:fix` | Auto-fix ESLint issues |
| `format` | `npm run format` | Prettier format all files |
| `check` | `npm run check` | Node syntax check |
| `dev` | `npm run dev` | Hot reload dev mode (Node 20+) |
| `dev:mock` | `npm run dev:mock` | Dev mode with mock data |

### Mock Development Mode

Run without SillyTavern backend:

```bash
MOCK_MODE=true npm run dev
```

This loads mock campaign/module data for isolated frontend/backend testing.

### Code Style

- ESM modules (`"type": "module"`)
- JSDoc comments for all public functions
- Single-purpose commits with clear messages
- `try/catch` + error logging for all async operations

### Architecture

```
plugin/
├── index.js              # Express routes & API
├── engine/               # Core game engines
│   ├── dice.js           # Dice roller (cached parsing)
│   ├── rule-engine.js    # CoC/D&D rules adjudication
│   ├── state-machine.js  # Scene transitions & actions
│   ├── combat-tracker.js # Turn-based combat
│   ├── npc-decision.js   # NPC AI behavior
│   └── module-parser.js  # JSON/Markdown module loading
├── storage/
│   └── campaign.js       # Save/load persistence
├── utils/
│   ├── prompt-builder.js # LLM prompt construction
│   └── sanitize.js       # Input validation & XSS prevention
│   └── dev-mode.js       # Mock data & hot reload helpers
└── test/
    └── index.js          # Test suite (29 assertions)
```

### Adding a New Effect Type

1. Define in `docs/module-format.md` Effect Types table
2. Implement in `engine/state-machine.js` `_applyEffect()`
3. Add test in `test/index.js`
4. Update test module JSON if needed

## Development Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| **Phase 1: MVP** | 🚧 In Progress | Single player, CoC 7e, basic scene/combat |
| **Phase 2: Core** | 📋 Planned | Save/load, full rules, NPC AI via LLM |
| **Phase 3: Multiplayer** | 📋 Planned | WebSocket sync, 2-4 players |
| **Phase 4: Ecosystem** | 📋 Planned | Module editor, custom rules, market |

## Test Module: "Arkham Night" (阿卡姆之夜)

A classic Cthulhu Mythos investigation:
- **5 scenes**: Library → Basement → Ritual Chamber → Streets → Asylum
- **4 NPCs**: Librarian, Cultist, Cult Leader, Doctor
- **2 endings**: Madness or Sanity
- **CoC 7e**: d100 skill checks, SAN loss, combat

## Contributing

- PR target: `staging` branch
- Single PR soft limit: 200 lines
- Run `npm run lint` before submitting
- All discussions in English

## License

AGPL-3.0 — See [LICENSE](LICENSE)

## Acknowledgments

- Built on [SillyTavern](https://github.com/SillyTavern/SillyTavern)
- Inspired by Call of Cthulhu 7th Edition by Chaosium
- Dice roller based on [dice-roller](https://github.com/dice-roller)
