/**
 * Module Parser
 * Converts Markdown/JSON into structured module format
 *
 * Supports:
 * - JSON: Full validation with cross-reference checks
 * - Markdown: YAML frontmatter + scene extraction (basic)
 *
 * @version 0.2.0
 */

/**
 * SemVer validation regex
 */
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

/**
 * Valid rule systems
 */
const VALID_SYSTEMS = ['coc7e', 'dnd5e', 'general', 'custom'];

export class ModuleParser {
  constructor(format = 'json') {
    this.format = format;
    this.warnings = [];
  }

  /**
   * Parse module source into structured format
   * @param {string|object} source - Module source (JSON string or object, or Markdown string)
   * @returns {Promise<object>} Parsed module object
   * @throws {Error} If format is unsupported or parsing fails
   */
  async parse(source) {
    this.warnings = [];

    if (this.format === 'json') {
      return this.parseJSON(source);
    }
    if (this.format === 'markdown') {
      return this.parseMarkdown(source);
    }
    throw new Error(`Unsupported format: ${this.format}`);
  }

  /**
   * Parse JSON module source
   * @param {string|object} source - JSON string or object
   * @returns {object} Parsed and validated module
   * @throws {Error} If JSON is invalid or validation fails
   */
  parseJSON(source) {
    let module;
    try {
      module = typeof source === 'string' ? JSON.parse(source) : source;
    } catch (e) {
      throw new Error(`JSON parse error: ${e.message}`);
    }

    const result = this.validate(module);
    if (!result.valid) {
      throw new Error(`Module validation failed: ${result.errors.join(', ')}`);
    }

    return module;
  }

  /**
   * Parse Markdown module source
   * Extracts YAML frontmatter and basic scene structure
   * @param {string} source - Markdown string
   * @returns {object} Parsed module with basic structure
   */
  parseMarkdown(source) {
    if (!source || typeof source !== 'string') {
      throw new Error('Markdown source must be a non-empty string');
    }

    const module = {
      id: 'parsed_module',
      name: 'Parsed Module',
      version: '0.1.0',
      system: 'custom',
      description: '',
      scenes: {},
      npcs: {},
      items: {},
      endings: {},
    };

    // Extract YAML frontmatter
    const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
    if (frontmatterMatch) {
      const frontmatter = this.parseYamlFrontmatter(frontmatterMatch[1]);
      Object.assign(module, {
        id: frontmatter.id || module.id,
        name: frontmatter.name || module.name,
        version: frontmatter.version || module.version,
        system: frontmatter.system || module.system,
        description: frontmatter.description || '',
      });
    }

    // Extract scenes from Markdown headers
    const sceneMatches = source.matchAll(
      /#\s*场景[：:]?\s*(.+?)\n\*\*id\*\*[:：]?\s*(\S+)\n[\s\S]*?(?=#\s*场景|$)/g,
    );
    for (const match of sceneMatches) {
      const sceneName = match[1].trim();
      const sceneId = match[2].trim();
      const sceneContent = match[0];

      module.scenes[sceneId] = {
        id: sceneId,
        title: sceneName,
        description: this.extractDescription(sceneContent),
        exits: this.extractExits(sceneContent),
        npcs: this.extractNpcRefs(sceneContent),
        events: this.extractEvents(sceneContent),
        combat: { enabled: false },
      };
    }

    // If no scenes found via regex, try simple heading extraction
    if (Object.keys(module.scenes).length === 0) {
      const simpleScenes = source.matchAll(/##\s+(.+?)\n\n([\s\S]*?)(?=\n##\s+|$)/g);
      for (const match of simpleScenes) {
        const id = match[1].toLowerCase().replace(/\s+/g, '-');
        module.scenes[id] = {
          id,
          title: match[1].trim(),
          description: match[2].trim().substring(0, 500),
          exits: this.extractExits(match[2]),
          npcs: this.extractNpcRefs(match[2]),
          events: [],
          combat: { enabled: false },
        };
      }
    }

    if (Object.keys(module.scenes).length === 0) {
      this.warnings.push('No scenes found in Markdown source');
    }

    return module;
  }

  /**
   * Parse YAML frontmatter string into object
   * @param {string} yaml - YAML content
   * @returns {object} Parsed frontmatter
   */
  parseYamlFrontmatter(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    for (const line of lines) {
      const match = line.match(/^([\w-]+):\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        result[key] = value.trim().replace(/^["']|["']$/g, '');
      }
    }
    return result;
  }

  /**
   * Extract description from scene content
   * @param {string} content - Scene content
   * @returns {string} Description text
   */
  extractDescription(content) {
    const descMatch = content.match(
      /\*\*atmosphere\*\*[:：]?\s*(\S+)\n([\s\S]*?)(?=\n##|\n\*\*|\n#\s*|$)/,
    );
    if (descMatch) return descMatch[2].trim().substring(0, 1000);

    // Try to get text after frontmatter-like markers until next section
    const lines = content.split('\n');
    const descLines = [];
    let collecting = false;
    for (const line of lines) {
      if (line.match(/^\*\*id\*\*/)) {
        collecting = true;
        continue;
      }
      if (collecting && line.match(/^\*\*|^##|^#/)) break;
      if (collecting) descLines.push(line);
    }
    return descLines.join('\n').trim().substring(0, 1000) || '暂无描述';
  }

  /**
   * Extract exits from scene content
   * @param {string} content - Scene content
   * @returns {Array<object>} Exit objects
   */
  extractExits(content) {
    const exits = [];
    const exitMatch = content.match(/##?\s*出口\n([\s\S]*?)(?=\n##?\s|$)/);
    if (exitMatch) {
      const lines = exitMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/-\s*\[(.+?)\]\((.+?)\)(?:\s*[-—]\s*需要[:：]?\s*(.+))?/);
        if (match) {
          exits.push({
            target: match[2].trim(),
            label: match[1].trim(),
            condition: match[3] ? { type: 'flag', key: match[3].trim() } : null,
          });
        }
      }
    }
    return exits;
  }

  /**
   * Extract NPC references from scene content
   * @param {string} content - Scene content
   * @returns {Array<string>} NPC IDs
   */
  extractNpcRefs(content) {
    const npcs = [];
    const npcMatch = content.match(/##?\s*NPC\n([\s\S]*?)(?=\n##?\s|$)/);
    if (npcMatch) {
      const lines = npcMatch[1].split('\n');
      for (const line of lines) {
        const match = line.match(/-\s*\[(.+?)\]\((.+?)\)/);
        if (match) {
          npcs.push(
            match[2]
              .trim()
              .replace(/\.md$/, '')
              .replace(/^npcs\//, ''),
          );
        }
      }
    }
    return npcs;
  }

  /**
   * Extract events from scene content
   * @param {string} content - Scene content
   * @returns {Array<object>} Event objects
   */
  extractEvents(content) {
    const events = [];
    const eventMatches = content.matchAll(
      /###\s*(.+?)\n\*\*触发\*\*[:：]?\s*(\S+)[\s\S]*?\*\*效果\*\*[:：]?\s*(.+)/g,
    );
    for (const match of eventMatches) {
      events.push({
        id: match[1].trim().toLowerCase().replace(/\s+/g, '_'),
        trigger: { type: 'action', action: match[2].trim() },
        effects: [{ type: 'narration', value: match[3].trim() }],
        repeatable: false,
      });
    }
    return events;
  }

  /**
   * Validate module structure comprehensively
   * @param {object} module - Module object to validate
   * @returns {{valid: boolean, errors: string[], warnings: string[]}} Validation result
   */
  validate(module) {
    const errors = [];
    const warnings = [];

    if (!module || typeof module !== 'object') {
      return { valid: false, errors: ['Module must be an object'], warnings: [] };
    }

    // 1. Required top-level fields
    const requiredFields = ['id', 'name', 'version', 'system', 'scenes', 'npcs'];
    for (const field of requiredFields) {
      if (!module[field]) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // 2. Version format (SemVer)
    if (module.version && !SEMVER_REGEX.test(module.version)) {
      errors.push(`Invalid version format: ${module.version} (must be SemVer)`);
    }

    // 3. System validation
    if (module.system && !VALID_SYSTEMS.includes(module.system)) {
      warnings.push(
        `Unknown system: ${module.system} (expected one of: ${VALID_SYSTEMS.join(', ')})`,
      );
    }

    // 4. ID uniqueness tracking
    const allIds = new Set();
    const checkUnique = (id, context) => {
      if (!id) return;
      if (allIds.has(id)) {
        errors.push(`Duplicate ID: ${id} (${context})`);
      }
      allIds.add(id);
    };

    // 5. Scene validation
    const sceneIds = new Set();
    if (module.scenes && typeof module.scenes === 'object') {
      for (const [sceneId, scene] of Object.entries(module.scenes)) {
        checkUnique(sceneId, 'scene');
        sceneIds.add(sceneId);

        if (!scene.id) errors.push(`Scene ${sceneId} missing id`);
        if (!scene.title) errors.push(`Scene ${sceneId} missing title`);
        if (!scene.description) errors.push(`Scene ${sceneId} missing description`);

        // Validate exits reference existing scenes
        if (scene.exits) {
          for (const exit of scene.exits) {
            if (
              exit.target &&
              !sceneIds.has(exit.target) &&
              module.scenes[exit.target] === undefined
            ) {
              // Target may be defined later in the object, so check at end
            }
          }
        }

        // Validate NPC references in scene
        if (scene.npcs) {
          for (const npcId of scene.npcs) {
            if (!module.npcs || !module.npcs[npcId]) {
              errors.push(`Scene ${sceneId} references undefined NPC: ${npcId}`);
            }
          }
        }

        // Validate item references in scene
        if (scene.items) {
          for (const itemId of scene.items) {
            if (!module.items || !module.items[itemId]) {
              errors.push(`Scene ${sceneId} references undefined item: ${itemId}`);
            }
          }
        }
      }
    }

    // Check exit targets after all scenes are indexed
    if (module.scenes) {
      for (const [sceneId, scene] of Object.entries(module.scenes)) {
        if (scene.exits) {
          for (const exit of scene.exits) {
            if (exit.target && !sceneIds.has(exit.target) && !module.scenes[exit.target]) {
              errors.push(`Scene ${sceneId} exit references undefined scene: ${exit.target}`);
            }
          }
        }
      }
    }

    // 6. NPC validation
    if (module.npcs && typeof module.npcs === 'object') {
      for (const [npcId, npc] of Object.entries(module.npcs)) {
        checkUnique(npcId, 'npc');
        if (!npc.id) errors.push(`NPC ${npcId} missing id`);
        if (!npc.name) errors.push(`NPC ${npcId} missing name`);
        if (!npc.attitude && !npc.role) {
          warnings.push(`NPC ${npcId} has no attitude or role defined`);
        }
      }
    } else {
      errors.push('Module must have at least one NPC defined');
    }

    // 7. Item validation
    if (module.items) {
      for (const [itemId, item] of Object.entries(module.items)) {
        checkUnique(itemId, 'item');
        if (!item.id) errors.push(`Item ${itemId} missing id`);
        if (!item.name) errors.push(`Item ${itemId} missing name`);
      }
    }

    // 8. Ending validation
    if (module.endings) {
      for (const [endingId, ending] of Object.entries(module.endings)) {
        checkUnique(endingId, 'ending');
        if (!ending.id) errors.push(`Ending ${endingId} missing id`);
        if (!ending.title) errors.push(`Ending ${endingId} missing title`);
      }
    }

    // 9. Event validation (global and per-scene)
    const validateEvents = (events, context) => {
      if (!events) return;
      for (const event of events) {
        if (!event.id) {
          errors.push(`${context} event missing id`);
          continue;
        }
        checkUnique(event.id, `${context} event`);
        if (!event.trigger) errors.push(`Event ${event.id} (${context}) missing trigger`);
        if (!event.effects || event.effects.length === 0) {
          warnings.push(`Event ${event.id} (${context}) has no effects`);
        }
      }
    };

    if (module.global_events) {
      validateEvents(module.global_events, 'global');
    }

    if (module.scenes) {
      for (const [sceneId, scene] of Object.entries(module.scenes)) {
        if (scene.events) {
          validateEvents(scene.events, `scene ${sceneId}`);
        }
      }
    }

    // 10. Circular scene detection (warning only)
    if (module.scenes) {
      const visited = new Set();
      const path = [];
      const detectCycle = (sceneId) => {
        if (path.includes(sceneId)) {
          const cycleStart = path.indexOf(sceneId);
          const cycle = path.slice(cycleStart).concat(sceneId);
          warnings.push(`Circular scene path detected: ${cycle.join(' -> ')}`);
          return;
        }
        if (visited.has(sceneId)) return;
        visited.add(sceneId);
        path.push(sceneId);

        const scene = module.scenes[sceneId];
        if (scene && scene.exits) {
          for (const exit of scene.exits) {
            if (exit.target && module.scenes[exit.target]) {
              detectCycle(exit.target);
            }
          }
        }
        path.pop();
      };

      for (const sceneId of Object.keys(module.scenes)) {
        if (!visited.has(sceneId)) {
          detectCycle(sceneId);
        }
      }
    }

    // 11. Start scene check
    if (
      module.start_scene &&
      !sceneIds.has(module.start_scene) &&
      !module.scenes[module.start_scene]
    ) {
      errors.push(`Start scene not found: ${module.start_scene}`);
    }

    this.warnings = warnings;
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get parser warnings from last operation
   * @returns {string[]} Warning messages
   */
  getWarnings() {
    return this.warnings;
  }
}
