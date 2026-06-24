/**
 * Module Parser
 * Converts Markdown/JSON into structured module format
 *
 * Supports:
 * - JSON: Full validation with cross-reference checks
 * - Markdown: YAML frontmatter + comprehensive scene/NPC/item/ending extraction
 *
 * @version 0.3.0
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
   * Parse Markdown module source with comprehensive extraction
   * Extracts YAML frontmatter, scenes, NPCs, items, endings, and events
   * Supports the full Markdown module format defined in docs/module-format.md
   * @param {string} source - Markdown string
   * @returns {object} Parsed module with complete structure
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
      author: '',
      scenes: {},
      npcs: {},
      items: {},
      endings: {},
      global_events: [],
    };

    // 1. Extract YAML frontmatter
    const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---\n/);
    if (frontmatterMatch) {
      const frontmatter = this.parseYamlFrontmatter(frontmatterMatch[1]);
      // Copy all frontmatter fields except array-based scenes/npcs (handled below)
      for (const [key, val] of Object.entries(frontmatter)) {
        if (key === 'scenes' || key === 'npcs') continue; // handled separately
        if (val !== undefined && val !== null) {
          module[key] = val;
        }
      }

      // Merge frontmatter-defined scenes and NPCs
      if (frontmatter.scenes && Array.isArray(frontmatter.scenes)) {
        for (const scene of frontmatter.scenes) {
          if (scene.id) {
            module.scenes[scene.id] = {
              id: scene.id,
              title: scene.title || scene.id,
              description: scene.description || '暂无描述',
              ...scene,
            };
          }
        }
      }
      if (frontmatter.npcs && Array.isArray(frontmatter.npcs)) {
        for (const npc of frontmatter.npcs) {
          if (npc.id) {
            module.npcs[npc.id] = {
              id: npc.id,
              name: npc.name || npc.id,
              ...npc,
            };
          }
        }
      }
    }

    // 2. Extract global description (text between frontmatter and first heading)
    const bodyStart = frontmatterMatch ? frontmatterMatch[0].length : 0;
    const body = source.slice(bodyStart);
    const firstHeadingMatch = body.match(/^#\s/m);
    if (firstHeadingMatch) {
      module.description = body.slice(0, firstHeadingMatch.index).trim() || module.description;
    }

    // 3. Extract NPCs from dedicated sections
    const npcs = this.extractNPCs(body);
    Object.assign(module.npcs, npcs);

    // 4. Extract items from dedicated sections
    const items = this.extractItems(body);
    Object.assign(module.items, items);

    // 5. Extract endings from dedicated sections
    const endings = this.extractEndings(body);
    Object.assign(module.endings, endings);

    // 6. Extract global events
    module.global_events = this.extractGlobalEvents(body);

    // 7. Extract scenes from Markdown headers
    const scenes = this.extractScenes(body, module);
    Object.assign(module.scenes, scenes);

    // 8. Post-processing: resolve NPC/item references in scenes
    this.resolveSceneReferences(module);

    // 9. Validate and warn
    if (Object.keys(module.scenes).length === 0) {
      this.warnings.push('No scenes found in Markdown source');
    }
    if (Object.keys(module.npcs).length === 0) {
      this.warnings.push('No NPCs defined in module');
    }

    return module;
  }

  /**
   * Parse YAML frontmatter with support for multi-line values and arrays
   * @param {string} yaml - YAML content
   * @returns {object} Parsed frontmatter
   */
  /**
   * Parse YAML frontmatter with support for multi-line values, arrays, and nested objects
   * @param {string} yaml - YAML content
   * @returns {object} Parsed frontmatter
   */
  parseYamlFrontmatter(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        i++;
        continue;
      }

      const match = trimmed.match(/^([\w-]+):\s*(.*)$/);
      if (!match) {
        i++;
        continue;
      }

      const [, key, rawValue] = match;
      const value = rawValue.trim();

      // Inline array: key: [a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        i++;
        continue;
      }

      // Multi-line string: key: | or key: >
      if (value === '|' || value === '>') {
        i++;
        const ml = [];
        const baseIndent = i < lines.length ? lines[i].length - lines[i].trimStart().length : 0;
        while (i < lines.length) {
          const l = lines[i];
          if (!l.trim()) {
            if (i + 1 < lines.length) {
              const next = lines[i + 1];
              if (next.trim() && next.length - next.trimStart().length <= baseIndent) break;
            } else {
              break;
            }
            ml.push('');
            i++;
            continue;
          }
          const li = l.length - l.trimStart().length;
          if (li <= baseIndent && l.trim().match(/^[\w-]+:/)) break;
          ml.push(l.trim());
          i++;
        }
        result[key] = ml.join('\n');
        continue;
      }

      // Block value: check next line for array or nested object
      if (value === '') {
        if (i + 1 >= lines.length) {
          result[key] = '';
          i++;
          continue;
        }
        const nextLine = lines[i + 1];
        const nextTrim = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        const currentIndent = line.length - line.trimStart().length;

        if (nextTrim.startsWith('-') && nextIndent > currentIndent) {
          // Multi-line array
          i++;
          const arr = [];
          while (i < lines.length) {
            const arrLine = lines[i];
            const arrTrim = arrLine.trim();
            if (!arrTrim) {
              i++;
              continue;
            }
            const arrIndent = arrLine.length - arrLine.trimStart().length;
            if (arrIndent <= currentIndent || !arrTrim.startsWith('-')) break;

            const itemContent = arrTrim.substring(1).trim();
            // Nested object array item
            if (
              itemContent.includes(':') &&
              !itemContent.startsWith('"') &&
              !itemContent.startsWith("'")
            ) {
              const childLines = [itemContent];
              i++;
              while (i < lines.length) {
                const sub = lines[i];
                if (!sub.trim()) {
                  i++;
                  continue;
                }
                const subIndent = sub.length - sub.trimStart().length;
                if (subIndent > arrIndent) {
                  childLines.push(sub.trim());
                  i++;
                } else {
                  break;
                }
              }
              arr.push(this.parseYamlFrontmatter(childLines.join('\n')));
            } else {
              arr.push(this.parseScalar(itemContent));
              i++;
            }
          }
          result[key] = arr;
          continue;
        } else if (nextTrim.match(/^[\w-]+:/) && nextIndent > currentIndent) {
          // Nested object
          i++;
          const childLines = [];
          while (i < lines.length) {
            const sub = lines[i];
            if (!sub.trim()) {
              i++;
              continue;
            }
            const subIndent = sub.length - sub.trimStart().length;
            if (subIndent <= currentIndent) break;
            childLines.push(sub.trim());
            i++;
          }
          result[key] = this.parseYamlFrontmatter(childLines.join('\n'));
          continue;
        }
        result[key] = '';
        i++;
        continue;
      }

      result[key] = this.parseScalar(value);
      i++;
    }

    return result;
  }

  /**
   * Parse a scalar YAML value into JS type
   * @param {string} value - Raw scalar string
   * @returns {boolean|number|null|string} Parsed value
   */
  parseScalar(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    return value.replace(/^["']|["']$/g, '');
  }

  /**
   * Extract scenes from Markdown body with comprehensive parsing
   * Supports both Chinese and English heading formats
   * @param {string} body - Markdown body (without frontmatter)
   * @param {object} module - Partial module object for reference resolution
   * @returns {object} Scenes map
   */
  extractScenes(body, module) {
    const scenes = {};

    // Pattern 1: # Scene: Name or # 场景: Name
    const sceneRegex =
      /#\s*(?:场景|Scene)\s*[：:\s]\s*(.+?)\n[\s\S]*?(?=(?=\n#\s*(?:场景|Scene))|$)/gi;

    // Pattern 2: ## Name with **id**: id
    const altSceneRegex = /##\s+(.+?)\n\s*\*\*id\*\*[:\s]*([^\n]+)\n[\s\S]*?(?=(?=\n##\s+)|$)/g;

    let match;

    // Try Pattern 1
    while ((match = sceneRegex.exec(body)) !== null) {
      const sceneContent = match[0];
      const sceneName = match[1].trim();
      const sceneId =
        this.extractSceneId(sceneContent) || sceneName.toLowerCase().replace(/\s+/g, '-');

      scenes[sceneId] = this.parseSceneBlock(sceneContent, sceneId, sceneName);
    }

    // If no scenes found, try Pattern 2
    if (Object.keys(scenes).length === 0) {
      while ((match = altSceneRegex.exec(body)) !== null) {
        const sceneContent = match[0];
        const sceneName = match[1].trim();
        const sceneId = match[2].trim();

        scenes[sceneId] = this.parseSceneBlock(sceneContent, sceneId, sceneName);
      }
    }

    // Fallback: simple ## headings
    if (Object.keys(scenes).length === 0) {
      const simpleRegex = /##\s+(.+?)\n\n([\s\S]*?)(?=\n##\s+|$)/g;
      while ((match = simpleRegex.exec(body)) !== null) {
        const id = match[1]
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
        scenes[id] = {
          id,
          title: match[1].trim(),
          description: match[2].trim().substring(0, 500),
          exits: this.extractExits(match[2]),
          npcs: this.extractNpcRefs(match[2]),
          interactables: this.extractItemRefs(match[2]),
          events: this.extractEvents(match[2]),
          combat: this.extractCombatConfig(match[2]),
          atmosphere: this.extractAtmosphere(match[2]),
        };
      }
    }

    return scenes;
  }

  /**
   * Parse a single scene block into structured scene object
   * @param {string} content - Scene content
   * @param {string} id - Scene ID
   * @param {string} title - Scene title
   * @returns {object} Structured scene
   */
  parseSceneBlock(content, id, title) {
    // Extract description (text between title and first sub-heading)
    const descMatch = content.match(/(?:\*\*id\*\*[^\n]*\n)?\n?([\s\S]*?)(?=\n##|\n\*\*|\n#\s|$)/);
    const description = descMatch ? descMatch[1].trim().substring(0, 1000) : '';

    return {
      id,
      title,
      description: description || '暂无描述',
      atmosphere: this.extractAtmosphere(content),
      exits: this.extractExits(content),
      npcs: this.extractNpcRefs(content),
      interactables: this.extractItemRefs(content),
      events: this.extractEvents(content),
      combat: this.extractCombatConfig(content),
      clues: this.extractClues(content),
      skill_checks: this.extractSkillChecks(content),
      is_start: content.includes('**start**: true') || content.includes('【起始场景】'),
    };
  }

  /**
   * Extract scene ID from content
   * @param {string} content - Scene content
   * @returns {string|null} Scene ID or null
   */
  extractSceneId(content) {
    const idMatch = content.match(/\*\*id\*\*[:\s]*([^\n]+)/);
    return idMatch ? idMatch[1].trim() : null;
  }

  /**
   * Extract atmosphere description from scene content
   * @param {string} content - Scene content
   * @returns {string} Atmosphere text
   */
  extractAtmosphere(content) {
    const atmMatch = content.match(
      /\*\*(?:atmosphere|氛围|气氛)\*\*[:\s]*([^\n]+(?:\n(?!\*\*|##)[^\n]+)*)/i,
    );
    return atmMatch ? atmMatch[1].trim() : '';
  }

  /**
   * Extract clues from scene content
   * @param {string} content - Scene content
   * @returns {Array<object>} Clue objects
   */
  extractClues(content) {
    const clues = [];
    const clueRegex =
      /(?:###|####)\s*(?:线索|Clue)\s*[：:\s]*(.+?)\n[\s\S]*?\*\*(?:发现|发现方式|discover)\*\*[:\s]*(.+?)\n[\s\S]*?\*\*(?:内容|content)\*\*[:\s]*([\s\S]*?)(?=\n(?:###|####)|\n##\s|$)/gi;
    let match;
    while ((match = clueRegex.exec(content)) !== null) {
      clues.push({
        id: match[1].trim().toLowerCase().replace(/\s+/g, '_'),
        name: match[1].trim(),
        discovery: match[2].trim(),
        content: match[3].trim(),
      });
    }
    return clues;
  }

  /**
   * Extract NPC definitions from dedicated NPC sections
   * Supports both inline scene NPCs and dedicated # NPC / ## NPC 定义 sections
   * @param {string} body - Full markdown body
   * @returns {object} NPC map
   */
  extractNPCs(body) {
    const npcs = {};

    // Pattern: # NPC 定义 / # NPCs / ## NPC 定义
    const npcSectionRegex = /#\s*(?:NPC|NPCs|NPC\s*定义)\s*\n([\s\S]*?)(?=\n#\s*(?!##)|$)/i;
    const sectionMatch = body.match(npcSectionRegex);

    if (sectionMatch) {
      const npcSection = sectionMatch[1];
      // Each NPC is a ### or ## heading
      const npcRegex =
        /(?:###|##)\s+(.+?)\n[\s\S]*?\*\*id\*\*[:\s]*([^\n]+)\n[\s\S]*?(?=(?:###|##)\s+|$)/g;
      let match;
      while ((match = npcRegex.exec(npcSection)) !== null) {
        const npcName = match[1].trim();
        const npcId = match[2].trim();
        const npcContent = match[0];

        npcs[npcId] = this.parseNPCBlock(npcContent, npcId, npcName);
      }
    }

    return npcs;
  }

  /**
   * Parse a single NPC block into structured NPC object
   * @param {string} content - NPC content
   * @param {string} id - NPC ID
   * @param {string} name - NPC name
   * @returns {object} Structured NPC
   */
  parseNPCBlock(content, id, name) {
    const npc = {
      id,
      name,
      description: '',
      role: 'neutral',
      attitude: 'neutral',
      stats: {},
      secrets: [],
      dialogue: {},
      combat_skills: [],
      items: [],
      personality: '',
    };

    // Description (text after title until first ** or ##)
    const descMatch = content.match(/(?:\*\*id\*\*[^\n]*\n)?\n?([\s\S]*?)(?=\n\*\*|\n##|$)/);
    npc.description = descMatch ? descMatch[1].trim().substring(0, 500) : '';

    // Role / Attitude
    const roleMatch = content.match(/\*\*(?:role|角色|定位)\*\*[:\s]*([^\n]+)/i);
    if (roleMatch) npc.role = roleMatch[1].trim().toLowerCase();

    const attitudeMatch = content.match(/\*\*(?:attitude|态度|初始态度)\*\*[:\s]*([^\n]+)/i);
    if (attitudeMatch) npc.attitude = attitudeMatch[1].trim().toLowerCase();

    // Stats block
    const statsMatch = content.match(
      /\*\*(?:stats|属性|数值)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (statsMatch) {
      npc.stats = this.parseStatsBlock(statsMatch[1]);
    }

    // Personality
    const personalityMatch = content.match(/\*\*(?:personality|性格|个性)\*\*[:\s]*([^\n]+)/i);
    if (personalityMatch) npc.personality = personalityMatch[1].trim();

    // Secrets
    const secretsMatch = content.match(
      /\*\*(?:secrets|秘密|secrets)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (secretsMatch) {
      npc.secrets = secretsMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('-'))
        .map((s) => ({
          keyword: s.replace(/^-\s*/, '').trim(),
          reveal_text: '',
        }));
    }

    // Dialogue topics
    const dialogueMatch = content.match(
      /\*\*(?:dialogue|对话|话题)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (dialogueMatch) {
      const lines = dialogueMatch[1].split('\n').filter((s) => s.trim());
      for (const line of lines) {
        const topicMatch = line.match(/^-\s*(.+?)[:\s]*(.+)$/);
        if (topicMatch) {
          npc.dialogue[topicMatch[1].trim()] = topicMatch[2].trim();
        }
      }
    }

    // Combat skills
    const combatMatch = content.match(
      /\*\*(?:combat_skills|战斗技能|combat)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (combatMatch) {
      npc.combat_skills = combatMatch[1]
        .split(/[,，\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // HP / Sanity from stats or direct
    if (!npc.stats.HP) {
      const hpMatch = content.match(/\*\*(?:hp|HP|生命值)\*\*[:\s]*(\d+)/i);
      if (hpMatch) npc.stats.HP = parseInt(hpMatch[1]);
    }
    if (!npc.stats.SAN) {
      const sanMatch = content.match(/\*\*(?:san|SAN|理智)\*\*[:\s]*(\d+)/i);
      if (sanMatch) npc.stats.SAN = parseInt(sanMatch[1]);
    }

    return npc;
  }

  /**
   * Parse stats block into object
   * Handles formats: JSON, key-value pairs, and table rows
   * @param {string} block - Stats block content
   * @returns {object} Stats object
   */
  parseStatsBlock(block) {
    const stats = {};

    // Try JSON first
    try {
      const json = JSON.parse(block.trim());
      if (typeof json === 'object' && json !== null) return json;
    } catch {
      // Not JSON, continue with other parsers
    }

    // Key-value pairs: STR: 60, CON: 55
    const kvRegex = /([A-Z]{2,3})[:\s]*(\d+)/g;
    let match;
    while ((match = kvRegex.exec(block)) !== null) {
      stats[match[1]] = parseInt(match[2]);
    }

    // Table format rows
    const tableRegex = /\|\s*([A-Z]{2,3})\s*\|\s*(\d+)\s*\|/g;
    while ((match = tableRegex.exec(block)) !== null) {
      stats[match[1]] = parseInt(match[2]);
    }

    return stats;
  }

  /**
   * Extract item definitions from dedicated sections
   * @param {string} body - Full markdown body
   * @returns {object} Items map
   */
  extractItems(body) {
    const items = {};

    const itemSectionRegex = /#\s*(?:物品|Items|Item\s*定义)\s*\n([\s\S]*?)(?=\n#\s*(?!##)|$)/i;
    const sectionMatch = body.match(itemSectionRegex);

    if (sectionMatch) {
      const itemSection = sectionMatch[1];
      const itemRegex =
        /(?:###|##)\s+(.+?)\n[\s\S]*?\*\*id\*\*[:\s]*([^\n]+)\n[\s\S]*?(?=(?:###|##)\s+|$)/g;
      let match;
      while ((match = itemRegex.exec(itemSection)) !== null) {
        const itemName = match[1].trim();
        const itemId = match[2].trim();
        const itemContent = match[0];

        items[itemId] = this.parseItemBlock(itemContent, itemId, itemName);
      }
    }

    return items;
  }

  /**
   * Parse a single item block into structured item object
   * @param {string} content - Item content
   * @param {string} id - Item ID
   * @param {string} name - Item name
   * @returns {object} Structured item
   */
  parseItemBlock(content, id, name) {
    const item = {
      id,
      name,
      description: '',
      usable: false,
      readable: false,
      effects: [],
      content: '',
    };

    // Description
    const descMatch = content.match(/(?:\*\*id\*\*[^\n]*\n)?\n?([\s\S]*?)(?=\n\*\*|\n##|$)/);
    item.description = descMatch ? descMatch[1].trim().substring(0, 300) : '';

    // Type flags
    if (content.match(/\*\*(?:type|类型)\*\*[:\s]*(?:usable|可使用|consumable|消耗品)/i)) {
      item.usable = true;
    }
    if (content.match(/\*\*(?:type|类型)\*\*[:\s]*(?:readable|可读|book|书籍|document|文档)/i)) {
      item.readable = true;
    }

    // Effects
    const effectsMatch = content.match(
      /\*\*(?:effects|效果|effect)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (effectsMatch) {
      const effectLines = effectsMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('-'));
      item.effects = effectLines.map((line) => {
        const text = line.replace(/^-\s*/, '').trim();
        // Try to parse structured effect: "sanity_loss 1d3" or "cult_awareness + 1"
        const structured = text.match(/^(\w+)\s+([+-]?\d+d?\d*)$/);
        if (structured) {
          return { type: 'set', target: structured[1], value: structured[2] };
        }
        return text;
      });
    }

    // Content (for readable items)
    const contentMatch = content.match(
      /\*\*(?:content|内容|text|文本)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (contentMatch) item.content = contentMatch[1].trim();

    return item;
  }

  /**
   * Extract ending definitions from dedicated sections
   * @param {string} body - Full markdown body
   * @returns {object} Endings map
   */
  extractEndings(body) {
    const endings = {};

    const endingSectionRegex =
      /#\s*(?:结局|Endings|Ending\s*定义)\s*\n([\s\S]*?)(?=\n#\s*(?!##)|$)/i;
    const sectionMatch = body.match(endingSectionRegex);

    if (sectionMatch) {
      const endingSection = sectionMatch[1];
      const endingRegex =
        /(?:###|##)\s+(.+?)\n[\s\S]*?\*\*id\*\*[:\s]*([^\n]+)\n[\s\S]*?(?=(?:###|##)\s+|$)/g;
      let match;
      while ((match = endingRegex.exec(endingSection)) !== null) {
        const endingName = match[1].trim();
        const endingId = match[2].trim();
        const endingContent = match[0];

        endings[endingId] = this.parseEndingBlock(endingContent, endingId, endingName);
      }
    }

    return endings;
  }

  /**
   * Parse a single ending block into structured ending object
   * @param {string} content - Ending content
   * @param {string} id - Ending ID
   * @param {string} title - Ending title
   * @returns {object} Structured ending
   */
  parseEndingBlock(content, id, title) {
    const ending = {
      id,
      title,
      description: '',
      conditions: [],
      type: 'neutral',
    };

    // Description
    const descMatch = content.match(/(?:\*\*id\*\*[^\n]*\n)?\n?([\s\S]*?)(?=\n\*\*|\n##|$)/);
    ending.description = descMatch ? descMatch[1].trim().substring(0, 1000) : '';

    // Conditions
    const condMatch = content.match(
      /\*\*(?:conditions|条件|condition)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (condMatch) {
      const lines = condMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('-'));
      ending.conditions = lines.map((line) => {
        const text = line.replace(/^-\s*/, '').trim();
        // Parse simple condition patterns
        const clueMatch = text.match(/(?:clue|线索)[:\s]*(.+)/i);
        if (clueMatch) return { type: 'clue', clue: clueMatch[1].trim() };
        const combatMatch = text.match(/(?:combat|战斗)[:\s]*(.+)/i);
        if (combatMatch)
          return { type: 'combat', enemy: combatMatch[1].trim(), status: 'defeated' };
        const flagMatch = text.match(/(?:flag|标记)[:\s]*(.+)/i);
        if (flagMatch) return { type: 'flag', key: flagMatch[1].trim() };
        return { type: 'custom', text };
      });
    }

    // Type (good/bad/neutral)
    const typeMatch = content.match(/\*\*(?:type|类型|ending_type)\*\*[:\s]*([^\n]+)/i);
    if (typeMatch) {
      const t = typeMatch[1].trim().toLowerCase();
      if (['good', '好', 'true', 'happy'].includes(t)) ending.type = 'good';
      else if (['bad', '坏', 'false', 'sad', 'death'].includes(t)) ending.type = 'bad';
    }

    return ending;
  }

  /**
   * Extract global events from dedicated sections
   * @param {string} body - Full markdown body
   * @returns {Array<object>} Global events array
   */
  extractGlobalEvents(body) {
    const events = [];

    const eventSectionRegex =
      /#\s*(?:全局事件|Global\s*Events|Event\s*定义)\s*\n([\s\S]*?)(?=\n#\s*(?!##)|$)/i;
    const sectionMatch = body.match(eventSectionRegex);

    if (sectionMatch) {
      const eventSection = sectionMatch[1];
      const eventRegex =
        /(?:###|##)\s+(.+?)\n[\s\S]*?\*\*id\*\*[:\s]*([^\n]+)\n[\s\S]*?(?=(?:###|##)\s+|$)/g;
      let match;
      while ((match = eventRegex.exec(eventSection)) !== null) {
        const eventName = match[1].trim();
        const eventId = match[2].trim();
        const eventContent = match[0];

        events.push(this.parseEventBlock(eventContent, eventId, eventName));
      }
    }

    return events;
  }

  /**
   * Parse a single event block into structured event object
   * @param {string} content - Event content
   * @param {string} id - Event ID
   * @param {string} title - Event title
   * @returns {object} Structured event
   */
  parseEventBlock(content, id, title) {
    const event = {
      id,
      title,
      description: '',
      trigger: { type: 'action', action: 'enter_scene' },
      effects: [],
      repeatable: false,
    };

    // Description
    const descMatch = content.match(/(?:\*\*id\*\*[^\n]*\n)?\n?([\s\S]*?)(?=\n\*\*|\n##|$)/);
    event.description = descMatch ? descMatch[1].trim() : '';

    // Trigger
    const triggerMatch = content.match(
      /\*\*(?:trigger|触发|条件)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (triggerMatch) {
      const triggerText = triggerMatch[1].trim();
      const skillMatch = triggerText.match(/(?:skill|技能)[:\s]*(.+)/i);
      if (skillMatch) {
        event.trigger = {
          type: 'skill',
          skill: skillMatch[1]
            .trim()
            .split(/[,，]/)
            .map((s) => s.trim()),
        };
      }
      const actionMatch = triggerText.match(/(?:action|动作)[:\s]*(.+)/i);
      if (actionMatch) {
        event.trigger = { type: 'action', action: actionMatch[1].trim() };
      }
      const sceneMatch = triggerText.match(/(?:scene|场景)[:\s]*(.+)/i);
      if (sceneMatch) {
        event.trigger.scene = sceneMatch[1].trim();
      }
      const chanceMatch = triggerText.match(/(?:chance|概率)[:\s]*(\d+)%?/i);
      if (chanceMatch) {
        event.trigger.chance = parseInt(chanceMatch[1]) / 100;
      }
    }

    // Effects
    const effectsMatch = content.match(
      /\*\*(?:effects|效果|effect)\*\*[:\s]*\n?([\s\S]*?)(?=\n\*\*|\n##|$)/i,
    );
    if (effectsMatch) {
      const lines = effectsMatch[1]
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('-'));
      event.effects = lines.map((line) => {
        const text = line.replace(/^-\s*/, '').trim();
        const addClueMatch = text.match(/(?:add_clue|获得线索|clue)[:\s]*(.+)/i);
        if (addClueMatch) return { type: 'add_clue', clue: addClueMatch[1].trim() };
        const sanityMatch = text.match(/(?:sanity_loss|理智损失|san)[:\s]*(.+)/i);
        if (sanityMatch) return { type: 'sanity_loss', amount: sanityMatch[1].trim() };
        const narrationMatch = text.match(/(?:narration|叙述|描述)[:\s]*(.+)/i);
        if (narrationMatch) return { type: 'narration', value: narrationMatch[1].trim() };
        return { type: 'custom', text };
      });
    }

    // Repeatable
    if (content.match(/\*\*(?:repeatable|可重复|repeat)\*\*[:\s]*(?:true|是|yes)/i)) {
      event.repeatable = true;
    }

    return event;
  }

  /**
   * Extract combat configuration from scene content
   * @param {string} content - Scene content
   * @returns {object} Combat config object
   */
  extractCombatConfig(content) {
    const combat = { enabled: false, enemies: [] };

    const combatMatch = content.match(
      /##?\s*(?:战斗|Combat|敌人|Enemies)\s*\n([\s\S]*?)(?=\n##?\s|$)/i,
    );
    if (combatMatch) {
      combat.enabled = true;
      const combatContent = combatMatch[1];

      // Extract enemy references
      const enemyLines = combatContent
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.startsWith('-'));
      for (const line of enemyLines) {
        const enemyMatch = line.match(/-\s*\[(.+?)\]\((.+?)\)/);
        if (enemyMatch) {
          combat.enemies.push(
            enemyMatch[2]
              .trim()
              .replace(/\.md$/, '')
              .replace(/^npcs\//, ''),
          );
        } else {
          // Plain text reference
          const plainMatch = line.match(/-\s*(.+)/);
          if (plainMatch) {
            combat.enemies.push(plainMatch[1].trim().toLowerCase().replace(/\s+/g, '_'));
          }
        }
      }
    }

    return combat;
  }

  /**
   * Extract item references from scene content (interactables)
   * @param {string} content - Scene content
   * @returns {Array<string>} Item IDs
   */
  extractItemRefs(content) {
    const items = [];
    const itemMatch = content.match(
      /##?\s*(?:物品|Items|Interactables|可交互)\s*\n([\s\S]*?)(?=\n##?\s|$)/i,
    );
    if (itemMatch) {
      const lines = itemMatch[1].split('\n').map((s) => s.trim());
      for (const line of lines) {
        const match = line.match(/-\s*\[(.+?)\]\((.+?)\)/);
        if (match) {
          items.push(
            match[2]
              .trim()
              .replace(/\.md$/, '')
              .replace(/^items\//, ''),
          );
        }
      }
    }
    return items;
  }

  /**
   * Resolve NPC and item references in all scenes
   * Links scene NPCs to module NPCs and scene interactables to module items
   * @param {object} module - Module object to mutate
   */
  resolveSceneReferences(module) {
    for (const [sceneId, scene] of Object.entries(module.scenes)) {
      // Ensure NPCs referenced in scenes exist in module.npcs
      for (const npcId of scene.npcs || []) {
        if (!module.npcs[npcId]) {
          this.warnings.push(`Scene '${sceneId}' references undefined NPC: '${npcId}'`);
        }
      }
      // Ensure items referenced in scenes exist in module.items
      for (const itemId of scene.interactables || []) {
        if (!module.items[itemId]) {
          this.warnings.push(`Scene '${sceneId}' references undefined item: '${itemId}'`);
        }
      }
      // Ensure combat enemies exist in module.npcs
      if (scene.combat?.enabled) {
        for (const enemyId of scene.combat.enemies || []) {
          if (!module.npcs[enemyId]) {
            this.warnings.push(
              `Scene '${sceneId}' combat references undefined enemy: '${enemyId}'`,
            );
          }
        }
      }
      // Ensure exit targets exist
      if (scene.exits) {
        for (const exit of scene.exits) {
          if (exit.target && !module.scenes[exit.target] && !exit.target.startsWith('http')) {
            this.warnings.push(
              `Scene '${sceneId}' exit references undefined scene: '${exit.target}'`,
            );
          }
        }
      }
    }
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
    const exitMatch = content.match(/##?\s*(?:出口|Exits|Exit|离开)\n([\s\S]*?)(?=\n##?\s|$)/i);
    if (exitMatch) {
      const lines = exitMatch[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('-')) continue;
        const match = trimmed.match(
          /^-\s*\[(.+?)\]\((.+?)\)(?:\s*[-—]\s*(?:需要|条件|condition)?[:：]?\s*(.+))?$/,
        );
        if (match) {
          const conditionText = match[3] ? match[3].trim() : null;
          const skip =
            conditionText &&
            /^(无|无条件|none|不需要|不需要条件|no.?condition|always|任何)$/i.test(conditionText);
          const condition = conditionText && !skip ? this.parseCondition(conditionText) : null;
          exits.push({
            target: match[2].trim(),
            label: match[1].trim(),
            condition,
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

        // Validate interactables references in scene
        if (scene.interactables) {
          for (const itemId of scene.interactables) {
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

  /**
   * Extract skill checks from scene content
   * Supports Cthulhu-style skill checks with success/failure branches
   * @param {string} content - Scene content
   * @returns {Array<object>} Skill check objects
   */
  extractSkillChecks(content) {
    const checks = [];
    const checkRegex =
      /(?:###|####)\s*(?:检定点|Check|Skill Check)\s*[：:\s]*(.+?)\n[\s\S]*?(?=(?:###|####|\n##\s|$))/gi;
    let match;
    while ((match = checkRegex.exec(content)) !== null) {
      checks.push(this.parseSkillCheckBlock(match[0], match[1].trim()));
    }
    return checks;
  }

  /**
   * Parse a single skill check block
   * @param {string} content - Check content
   * @param {string} name - Check name
   * @returns {object} Structured skill check
   */
  parseSkillCheckBlock(content, name) {
    const check = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      skills: [],
      difficulty: 'normal',
      success: { description: '', goto: null, effects: [] },
      failure: { description: '', goto: null, effects: [] },
    };

    // Skills: 图书馆使用 50, 侦查 60
    const skillMatch = content.match(/\*\*(?:技能|skills|skill|检定)\*\*\s*[：:\s]*(.+?)(?:\n|$)/i);
    if (skillMatch) {
      const skillText = skillMatch[1].trim();
      const skillParts = skillText.split(/\s*(?:或|or|,)\s*/i);
      for (const part of skillParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const m = trimmed.match(/^(.+?)\s+(\d+)$/);
        if (m) {
          check.skills.push({ name: m[1].trim(), target: parseInt(m[2]) });
        } else {
          check.skills.push({ name: trimmed, target: null });
        }
      }
    }

    // Difficulty
    const diffMatch = content.match(/\*\*(?:难度|difficulty)\*\*\s*[：:\s]*(.+?)(?:\n|$)/i);
    if (diffMatch) {
      const d = diffMatch[1].trim().toLowerCase();
      if (['easy', '简单'].includes(d)) check.difficulty = 'easy';
      else if (['hard', '困难', '极难'].includes(d)) check.difficulty = 'hard';
      else if (['extreme', '极限'].includes(d)) check.difficulty = 'extreme';
    }

    // Success outcome
    const successMatch = content.match(
      /\*\*(?:成功|success)\*\*\s*[：:\s]*\n?([\s\S]*?)(?=\n\*\*|\n(?:###|####)|\n##\s|$)/i,
    );
    if (successMatch) {
      check.success = this.parseCheckOutcome(successMatch[1].trim());
    }

    // Failure outcome
    const failureMatch = content.match(
      /\*\*(?:失败|failure)\*\*\s*[：:\s]*\n?([\s\S]*?)(?=\n\*\*|\n(?:###|####)|\n##\s|$)/i,
    );
    if (failureMatch) {
      check.failure = this.parseCheckOutcome(failureMatch[1].trim());
    }

    return check;
  }

  /**
   * Parse a skill check outcome text into structured object
   * @param {string} text - Outcome text
   * @returns {object} Parsed outcome
   */
  parseCheckOutcome(text) {
    const outcome = {
      description: text,
      goto: null,
      effects: [],
    };

    // Goto: 前往 [场景名](#scene-id)
    const gotoMatch = text.match(/(?:前往|goto|跳转)[:\s]*\[(.+?)\]\((.+?)\)/i);
    if (gotoMatch) {
      outcome.goto = gotoMatch[2].trim().replace(/^#/, '');
      outcome.description = text.replace(gotoMatch[0], '').trim();
    }

    // Effects
    const clueMatch = text.match(/(?:获得线索|clue)[:\s]*(.+?)(?:[,，\n]|$)/i);
    if (clueMatch) outcome.effects.push({ type: 'add_clue', clue: clueMatch[1].trim() });

    const sanityMatch = text.match(/(?:理智损失|sanity_loss|san)[:\s]*(.+?)(?:[,，\n]|$)/i);
    if (sanityMatch) outcome.effects.push({ type: 'sanity_loss', amount: sanityMatch[1].trim() });

    const flagMatch = text.match(/(?:设置标记|set flag|flag)[:\s]*(.+?)(?:[,，\n]|$)/i);
    if (flagMatch)
      outcome.effects.push({ type: 'set_flag', key: flagMatch[1].trim(), value: true });

    return outcome;
  }

  /**
   * Parse condition text into structured condition object
   * Supports: flag, skill_check, item, clue, compound (and/or)
   * @param {string} text - Condition text
   * @returns {object|null} Parsed condition or null
   */
  parseCondition(text) {
    if (!text) return null;

    // Compound conditions: A 且 B, A 或 B
    const andParts = text.split(/\s*且\s*|\s*and\s*/i);
    if (andParts.length > 1) {
      return {
        type: 'compound',
        operator: 'and',
        conditions: andParts.map((p) => this.parseCondition(p.trim())).filter(Boolean),
      };
    }

    const orParts = text.split(/\s*或\s*|\s*or\s*/i);
    if (orParts.length > 1) {
      return {
        type: 'compound',
        operator: 'or',
        conditions: orParts.map((p) => this.parseCondition(p.trim())).filter(Boolean),
      };
    }

    // Skill check: 图书馆使用 50, skill_check(图书馆使用, 50)
    const skillMatch =
      text.match(/^(?:skill_check|技能检定|检定)?[:\s]*(.+?)\s+(\d+)$/i) ||
      text.match(/(?:skill_check)\s*\(\s*(.+?)\s*,\s*(\d+)\s*\)/i);
    if (skillMatch) {
      return {
        type: 'skill_check',
        skill: skillMatch[1].trim(),
        target: parseInt(skillMatch[2]),
      };
    }

    // Flag: flag(has_key), has_key
    const flagMatch = text.match(/(?:flag|标记)[:\s]*\(?\s*([^)\s]+)\s*\)?/i);
    if (flagMatch) return { type: 'flag', key: flagMatch[1].trim() };

    // Item: item(ancient_key), 物品(ancient_key)
    const itemMatch = text.match(/(?:item|物品)[:\s]*\(?\s*([^)\s]+)\s*\)?/i);
    if (itemMatch) return { type: 'item', item_id: itemMatch[1].trim() };

    // Clue: clue(ancient_scroll), 线索(ancient_scroll)
    const clueMatch = text.match(/(?:clue|线索)[:\s]*\(?\s*([^)\s]+)\s*\)?/i);
    if (clueMatch) return { type: 'clue', clue_id: clueMatch[1].trim() };

    // Default to flag
    return { type: 'flag', key: text };
  }
}
