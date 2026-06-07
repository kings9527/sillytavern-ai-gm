/**
 * Game State Machine
 * Manages scene transitions, player actions, and game flow
 * 
 * @version 0.2.0
 */
export class GameStateMachine {
    constructor(module, campaign) {
        this.module = module;
        this.campaign = campaign;
        this.currentScene = module.scenes[campaign.current_scene];
    }

    /**
     * Process player action and return game state update
     * @param {object} action - Player action
     * @param {string} action.action_type - Action type
     * @param {string} action.player_input - Raw player input text
     * @param {object} action.action_data - Additional action data
     * @returns {Promise<object>} Game state result
     * @throws {Error} If action is invalid or missing required fields
     */
    async processAction(action) {
        if (!action || typeof action !== 'object') {
            throw new Error('Invalid action: must be an object');
        }
        const { action_type, player_input } = action;

        // 1. Parse intent from player input
        const intent = await this.parseIntent(player_input || '', action_type);

        // 2. Check scene events (random or condition-based triggers)
        const eventResult = this.checkSceneEvents(intent);
        if (eventResult) {
            return eventResult;
        }

        // 3. Check scene exits for movement intents
        if (intent.type === 'move') {
            const matchedExit = this.findMatchingExit(action.action_data?.direction, player_input);
            if (matchedExit) {
                return this.transitionTo(matchedExit.target, { intent, matchedExit });
            }
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: '你想去那个方向，但似乎没有路。',
                available_actions: this.getAvailableActions()
            };
        }

        // 4. Handle dice check for scene interactions
        if (intent.type === 'dice_check' || action_type === 'dice_check') {
            return this.handleDiceCheckInteraction(action.action_data, player_input);
        }

        // 5. Handle interact (items, objects, clues)
        if (intent.type === 'interact' || intent.type === 'inspect') {
            return this.handleInteract(intent, player_input);
        }

        // 6. Handle NPC interaction (now async with decision engine)
        if (intent.type === 'talk') {
            return await this.handleTalk(intent, player_input);
        }

        // 7. Handle combat initiation
        if (intent.type === 'attack') {
            return this.handleCombatInitiation(intent, player_input);
        }

        // 8. Default: scene interaction
        return this.handleSceneInteraction(intent);
    }

    /**
     * Parse player intent from input text
     * @param {string} input - Player input
     * @param {string} actionType - Explicit action type if provided
     * @returns {Promise<object>} Parsed intent
     */
    async parseIntent(input, actionType) {
        // For MVP, simple keyword matching
        // Phase 2: Use LLM for intent classification
        const keywords = {
            move: ['去', '走', '到', '前往', 'enter', 'go to', 'move to', 'move'],
            talk: ['说', '问', 'talk', 'ask', 'speak', 'tell', 'chat', 'conversation', '对话'],
            inspect: ['看', '检查', 'inspect', 'check', 'look', 'examine', '查看', '观察'],
            interact: ['拿', '取', '拾', '读', '打开', '翻', 'search', 'pick', 'take', 'open', 'read', 'search', 'touch', 'use', '搜索'],
            attack: ['攻击', '打', 'attack', 'fight', 'hit', 'strike', 'shoot', 'stab', '射击'],
            use: ['用', '使用', 'use', 'activate', 'cast', 'invoke'],
            flee: ['跑', '逃跑', 'flee', 'run', 'escape', 'retreat'],
            dice_check: ['检定', '骰', 'check', 'roll', 'dice', 'test']
        };

        const inputLower = (input || '').toLowerCase();
        for (const [intent, words] of Object.entries(keywords)) {
            if (words.some(w => inputLower.includes(w.toLowerCase()))) {
                return { type: intent, raw: input };
            }
        }
        return { type: actionType || 'inspect', raw: input };
    }

    /**
     * Check scene events based on current scene and action
     * Prevents duplicate triggers for one-time events.
     * @param {object} intent - Current intent
     * @returns {object|null} Event result if triggered
     */
    checkSceneEvents(intent) {
        if (!this.module.events) return null;

        for (const [eventId, event] of Object.entries(this.module.events)) {
            const trigger = event.trigger;
            if (!trigger) continue;

            // Check scene match
            if (trigger.scene && trigger.scene !== this.currentScene.id) continue;

            // Check action type match
            if (trigger.action && trigger.action !== intent.type) continue;

            // Check time condition (if applicable)
            if (trigger.time && trigger.time !== this.getCurrentTime()) continue;

            // Check if event has already been triggered (one-time events)
            const eventKey = `event_triggered:${eventId}`;
            if (this.campaign.global_vars[eventKey]) continue;

            // Check random chance
            if (trigger.chance && Math.random() > trigger.chance) continue;

            // Check custom condition if defined
            if (trigger.condition && !this.evaluateCondition(trigger.condition)) continue;

            // Mark as triggered (if not repeatable)
            if (!event.repeatable) {
                this.campaign.global_vars[eventKey] = true;
            }

            // Apply event effects
            if (event.effect) {
                this.applyEventEffects(event.effect);
            }

            // Build narration
            let narration = this.sanitizeNarration(event.description || '发生了一些事情...');

            // Add sanity check if required
            if (event.sanity_check) {
                const checkResult = this.performSanityCheck(event.sanity_check);
                narration += `\n\n${checkResult.narration}`;
            }

            return {
                type: 'event',
                event_id: eventId,
                scene: this.currentScene.id,
                narration,
                available_actions: this.getAvailableActions()
            };
        }

        return null;
    }

    /**
     * Perform sanity check (CoC)
     * @param {object} check - Sanity check definition
     * @returns {object} Check result
     */
    performSanityCheck(check) {
        const target = check.target || this.campaign.player.sanity || 50;
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= target;

        let narration = `SAN 检定：${roll} / ${target} — `;

        if (success) {
            narration += '成功。你保持理智。';
        } else {
            // Calculate sanity loss
            const lossExpr = check.failure || '1d6';
            const loss = this.parseDiceExpression(lossExpr);
            const oldSanity = this.campaign.player.sanity || 50;
            const newSanity = Math.max(0, oldSanity - loss);
            this.campaign.player.sanity = newSanity;

            narration += `失败。你失去 ${loss} 点 SAN。(${oldSanity} → ${newSanity})`;

            // Check for temporary insanity
            if (loss >= 5) {
                narration += '\n\n你受到了巨大的精神冲击，暂时陷入疯狂状态！';
                this.campaign.player.status_effects = this.campaign.player.status_effects || [];
                this.campaign.player.status_effects.push({
                    type: 'temp_insanity',
                    duration: '1d10 rounds',
                    description: '暂时性疯狂'
                });
            }
        }

        return { roll, target, success, narration };
    }

    /**
     * Apply event effects to campaign state
     * Supports: set, increment, decrement, dice, sanity_loss
     * @param {object} effects - Event effects
     */
    applyEventEffects(effects) {
        for (const [key, value] of Object.entries(effects)) {
            if (key.includes('+')) {
                const baseKey = key.replace('+', '').trim();
                this.campaign.global_vars[baseKey] = (this.campaign.global_vars[baseKey] || 0) + value;
            } else if (key.includes('-')) {
                const baseKey = key.replace('-', '').trim();
                this.campaign.global_vars[baseKey] = (this.campaign.global_vars[baseKey] || 0) - value;
            } else if (key === 'sanity_loss') {
                const loss = this.parseDiceExpression(value);
                const oldSanity = this.campaign.player.sanity || 50;
                this.campaign.player.sanity = Math.max(0, oldSanity - loss);
            } else {
                this.campaign.global_vars[key] = value;
            }
        }
    }

    /**
     * Find matching exit from current scene
     * @param {object} intent - Player intent
     * @param {string} input - Raw player input for matching
     * @returns {object|null} Matched exit
     */
    findMatchingExit(intent, input = '') {
        if (!this.currentScene.exits) return null;

        return this.currentScene.exits.find(exit => {
            // Check direct match on target or label
            if (exit.target === intent || exit.label === intent) return true;
            // Check condition
            if (exit.condition === 'always') return true;
            if (exit.condition && typeof exit.condition === 'object') {
                return this.evaluateCondition(exit.condition);
            }
            // Check keyword match in input
            if (input && exit.description) {
                const keywords = exit.description.toLowerCase().split(/\s+/);
                return keywords.some(k => input.toLowerCase().includes(k));
            }
            return false;
        });
    }

    /**
     * Evaluate a condition object against campaign state
     * @param {object} condition - Condition to evaluate
     * @returns {boolean} True if condition is met
     */
    evaluateCondition(condition) {
        for (const [key, value] of Object.entries(condition)) {
            const campaignValue = this.campaign.global_vars[key];
            if (Array.isArray(value)) {
                // Range check: [min, max]
                if (campaignValue < value[0] || campaignValue > value[1]) {
                    return false;
                }
            } else if (typeof value === 'boolean') {
                if (!!campaignValue !== value) return false;
            } else if (typeof value === 'number') {
                if (campaignValue !== value) return false;
            } else if (typeof value === 'string') {
                if (campaignValue !== value) return false;
            }
        }
        return true;
    }

    /**
     * Handle interact action (items, objects, clues)
     * @param {object} intent - Player intent
     * @param {string} input - Raw input for item matching
     * @returns {object} Interaction result
     */
    handleInteract(intent, input = '') {
        const interactables = this.currentScene.interactables || [];
        const items = this.module.items || {};

        // Ensure player inventory exists
        if (!this.campaign.player.inventory) {
            this.campaign.player.inventory = [];
        }
        // Try to find a matching item in the scene
        let matchedItem = null;
        for (const itemId of interactables) {
            const item = items[itemId];
            if (!item) continue;
            // Match by name or ID in input
            if (input.toLowerCase().includes(item.name.toLowerCase()) ||
                input.toLowerCase().includes(itemId.toLowerCase())) {
                matchedItem = { id: itemId, ...item };
                break;
            }
        }

        // If no item matched, return generic inspect response
        if (!matchedItem) {
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: this.currentScene.description || '你环顾四周，没有发现特别的东西。',
                available_actions: this.getAvailableActions()
            };
        }

        // Handle item interaction based on type
        let narration = '';
        const effects = [];

        if (matchedItem.readable) {
            narration = `你拿起${matchedItem.name}开始阅读。\n\n${matchedItem.content || '上面写满了你看不懂的文字。'}`;
        } else if (matchedItem.usable) {
            narration = `你使用了${matchedItem.name}。`;
        } else {
            narration = `你检查了${matchedItem.name}。\n\n${matchedItem.description}`;
        }

        // Apply item effects
        if (matchedItem.effects) {
            for (const effect of matchedItem.effects) {
                let parsed;
                if (typeof effect === 'string') {
                    parsed = this.parseEffectString(effect);
                } else if (typeof effect === 'object' && effect !== null) {
                    parsed = effect;
                }
                if (parsed) {
                    if (parsed.type === 'dice_check') {
                        return this.handleDiceCheckInteraction(parsed, input);
                    }
                    this.applyEffect(parsed);
                    effects.push(parsed);
                }
            }
            // Add effect descriptions to narration
            const effectDesc = effects.map(e => this.describeEffect(e)).join('，');
            if (effectDesc) {
                narration += `\n\n效果：${effectDesc}`;
            }
        }

        // Add to inventory if it's an item
        if (!matchedItem.readable && !this.campaign.player.inventory.includes(matchedItem.id)) {
            this.campaign.player.inventory.push(matchedItem.id);
            narration += `\n\n${matchedItem.name}已加入你的物品栏。`;
        }

        return {
            type: 'interaction',
            interaction_type: 'item',
            item_id: matchedItem.id,
            scene: this.currentScene.id,
            narration,
            effects,
            available_actions: this.getAvailableActions()
        };
    }

    /**
     * Handle dice check interaction (e.g., "检定图书馆使用")
     * @param {object} actionData - Action data with skill info
     * @param {string} input - Raw input for skill extraction
     * @returns {object} Dice check result
     */
    handleDiceCheckInteraction(actionData, input) {
        // Extract skill from input if not provided in actionData
        let skill = actionData?.skill;
        let skillValue = actionData?.skill_value;

        if (!skill && input) {
            // Try to extract skill from input text
            const skillKeywords = {
                '图书馆使用': 50, 'library_use': 50, 'library': 50,
                '侦查': 60, 'spot_hidden': 60, 'spot': 60,
                '聆听': 50, 'listen': 50,
                '格斗': 40, 'brawl': 40, 'fight': 40,
                '射击': 40, 'firearms': 40, 'shoot': 40,
                '闪避': 40, 'dodge': 40,
                '急救': 30, 'first_aid': 30,
                '医学': 40, 'medicine': 40,
                '说服': 50, 'persuade': 50,
                '心理学': 50, 'psychology': 50,
                '历史': 40, 'history': 40,
                '神秘学': 30, 'occult': 30
            };

            for (const [keyword, defaultValue] of Object.entries(skillKeywords)) {
                if (input.toLowerCase().includes(keyword.toLowerCase())) {
                    skill = keyword;
                    skillValue = defaultValue;
                    break;
                }
            }
        }

        if (!skill) {
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: '你想检定什么技能？请明确说明。',
                available_actions: this.getAvailableActions()
            };
        }

        // Perform dice check
        const roll = Math.floor(Math.random() * 100) + 1;
        const target = (skillValue || this.campaign.player.stats[skill] || 50) + (actionData?.modifier || 0);
        const success = roll <= target;
        const critical = roll <= 5;
        const fumble = roll >= 96;

        let degree = null;
        if (roll <= Math.floor(target / 5)) degree = 'extreme';
        else if (roll <= Math.floor(target / 2)) degree = 'hard';

        const result = fumble ? 'fumble' : critical ? 'critical' : success ? 'success' : 'fail';

        // Build narration
        let narration = buildCheckNarration(skill, roll, target, result);

        // Check if skill check triggers scene events
        if (success) {
            const triggeredEvent = this.checkSkillSuccessEvents(skill, roll, target);
            if (triggeredEvent) {
                narration += `\n\n${triggeredEvent.narration}`;
            }
        }

        return {
            type: 'dice_check',
            skill,
            roll,
            target,
            result,
            degree,
            narration,
            available_actions: this.getAvailableActions()
        };
    }

    /**
     * Check events triggered by skill check success
     * Uses module events configuration for flexible scene event triggers.
     * @param {string} skill - Skill name
     * @param {number} roll - Dice roll
     * @param {number} target - Target value
     * @returns {object|null} Triggered event
     */
    checkSkillSuccessEvents(skill, roll, target) {
        // Check if current scene has skill-triggered events configured
        if (!this.module.events) return null;

        for (const [eventId, event] of Object.entries(this.module.events)) {
            const trigger = event.trigger;
            if (!trigger) continue;
            
            // Only match events for current scene with skill trigger
            if (trigger.scene && trigger.scene !== this.currentScene.id) continue;
            if (!trigger.skill) continue;
            
            // Check skill match (supports partial match)
            const skillMatch = trigger.skill.some(s => 
                skill.toLowerCase().includes(s.toLowerCase()) || 
                s.toLowerCase().includes(skill.toLowerCase())
            );
            if (!skillMatch) continue;
            
            // Check if already triggered
            const eventKey = `event_triggered:${eventId}`;
            if (this.campaign.global_vars[eventKey]) continue;
            
            // Check success condition
            if (trigger.require_success !== false && roll > target) continue;
            
            // Mark as triggered
            if (!event.repeatable) {
                this.campaign.global_vars[eventKey] = true;
            }
            
            // Apply effects
            if (event.effect) {
                this.applyEventEffects(event.effect);
            }
            
            return {
                narration: this.sanitizeNarration(event.description || '你的技能发现了一些新线索...')
            };
        }
        
        return null;
    }

    /**
     * Handle NPC talk interaction — now with NPC decision engine
     * @param {object} intent - Player intent
     * @param {string} input - Raw input for NPC matching
     * @returns {Promise<object>} Talk interaction result
     */
    async handleTalk(intent, input = '') {
        const npcs = this.currentScene.npcs || [];
        if (npcs.length === 0) {
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: '这里没有可以交谈的人。',
                available_actions: this.getAvailableActions()
            };
        }

        // Try to match specific NPC from input
        let matchedNPC = null;
        for (const npcId of npcs) {
            const npc = this.module.npcs?.[npcId];
            if (!npc) continue;
            if (input.toLowerCase().includes(npc.name.toLowerCase()) ||
                input.toLowerCase().includes(npcId.toLowerCase())) {
                matchedNPC = { id: npcId, ...npc };
                break;
            }
        }

        // If single NPC present, default to them
        if (!matchedNPC && npcs.length === 1) {
            const npcId = npcs[0];
            const npc = this.module.npcs?.[npcId];
            if (npc) matchedNPC = { id: npcId, ...npc };
        }

        if (matchedNPC) {
            // --- NPC Decision Engine integration ---
            const { NPCDecisionEngine } = await import('./npc-decision.js');
            const engine = new NPCDecisionEngine(this.campaign, matchedNPC.id);
            
            const decision = await engine.decide({
                type: 'player_talk',
                player_input: input
            });

            const dialogueResult = await engine.generateDialogue(
                `Player says: "${input}"`,
                decision.mood,
                decision.dialogue_topic
            );

            // Update NPC state based on interaction outcome
            engine.updateState(decision, {
                trust_delta: (decision.mood === 'friendly' || decision.mood === 'grateful' || decision.action === 'talk') ? 5 : 0,
                fear_delta: (decision.mood === 'terrified' || decision.mood === 'scared') ? 5 : 0
            });

            return {
                type: 'interaction',
                interaction_type: 'talk',
                npc_id: matchedNPC.id,
                scene: this.currentScene.id,
                narration: `${matchedNPC.name}：${dialogueResult.dialogue}`,
                npc_decision: {
                    action: decision.action,
                    mood: decision.mood,
                    confidence: decision.confidence
                },
                available_actions: [
                    ...this.getAvailableActions(),
                    { type: 'ask', target: matchedNPC.id, label: `继续询问${matchedNPC.name}` }
                ]
            };
        }

        return {
            type: 'interaction',
            scene: this.currentScene.id,
            narration: '你想和谁交谈？',
            available_actions: npcs.map(id => {
                const npc = this.module.npcs?.[id];
                return {
                    type: 'talk_to',
                    target: id,
                    label: npc?.name || id
                };
            }) || []
        };
    }

    /**
     * Handle combat initiation
     * @param {object} intent - Player intent
     * @param {string} input - Raw input
     * @returns {object} Combat initiation result
     */
    handleCombatInitiation(intent, input) {
        // Check if current scene has combat enabled
        if (!this.currentScene.combat?.enabled) {
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: '这里没有敌人。你的攻击只是打在了空气里。',
                available_actions: this.getAvailableActions()
            };
        }

        const enemies = this.currentScene.combat.enemies || [];
        if (enemies.length === 0) {
            return {
                type: 'interaction',
                scene: this.currentScene.id,
                narration: '场景中没有可攻击的敌人。',
                available_actions: this.getAvailableActions()
            };
        }

        // Find target from input
        let target = enemies[0]; // Default to first enemy
        for (const enemyId of enemies) {
            const npc = this.module.npcs?.[enemyId];
            if (npc && input.toLowerCase().includes(npc.name.toLowerCase())) {
                target = enemyId;
                break;
            }
        }

        return {
            type: 'combat_start',
            scene: this.currentScene.id,
            narration: `战斗开始！你面对${enemies.length}个敌人：${enemies.map(e => this.module.npcs?.[e]?.name || e).join('、')}。`,
            enemies,
            target,
            available_actions: [
                { type: 'combat_attack', target, label: `攻击${this.module.npcs?.[target]?.name || target}` },
                { type: 'combat_flee', label: '逃跑' },
                { type: 'combat_skill', label: '使用技能' }
            ]
        };
    }

    /**
     * Generic scene interaction handler
     * @param {object} intent - Player intent
     * @returns {object} Interaction result
     */
    async handleSceneInteraction(intent) {
        const result = {
            type: 'interaction',
            scene: this.currentScene.id,
            narration: '你环顾四周...',
            available_actions: this.getAvailableActions()
        };

        if (intent.type === 'talk') {
            return this.handleTalk(intent);
        }

        if (intent.type === 'inspect') {
            result.narration = this.currentScene.description || '这里没有什么特别的东西。';
        }

        if (intent.type === 'flee') {
            result.narration = '你想逃跑，但...去哪里？';
            result.available_actions = this.currentScene.exits?.map(e => ({
                type: 'move',
                target: e.target_scene,
                label: e.description
            })) || [];
        }

        return result;
    }

    /**
     * Get list of available actions in current scene
     * @returns {Array<object>} Available actions
     */
    getAvailableActions() {
        const actions = [];

        // Exits
        if (this.currentScene.exits) {
            this.currentScene.exits.forEach(e => {
                if (e.condition === 'always' || (e.condition && this.evaluateCondition(e.condition))) {
                    actions.push({
                        type: 'move',
                        target: e.target,
                        label: e.label
                    });
                }
            });
        }

        // NPCs
        if (this.currentScene.npcs?.length > 0) {
            this.currentScene.npcs.forEach(npcId => {
                const npc = this.module.npcs?.[npcId];
                actions.push({
                    type: 'talk',
                    target: npcId,
                    label: `与${npc?.name || npcId}交谈`
                });
            });
        }

        // Items
        if (this.currentScene.interactables?.length > 0) {
            this.currentScene.interactables.forEach(itemId => {
                const item = this.module.items?.[itemId];
                actions.push({
                    type: 'interact',
                    target: itemId,
                    label: `检查${item?.name || itemId}`
                });
            });
        }

        // Combat
        if (this.currentScene.combat?.enabled) {
            actions.push({ type: 'attack', label: '进入战斗' });
        }

        return actions;
    }

    /**
     * Transition to a new scene
     * @param {string} sceneId - Target scene ID
     * @param {object} metadata - Transition metadata
     * @returns {object} Scene transition result
     * @throws {Error} If scene does not exist
     */
    async transitionTo(sceneId, metadata = {}) {
        const scene = this.module.scenes[sceneId];
        if (!scene) {
            throw new Error(`Scene not found: ${sceneId}`);
        }

        // Clear combat state when leaving a combat scene (if not moving to another combat scene)
        if (this.currentScene?.combat?.enabled && !scene.combat?.enabled) {
            this.campaign.combat_state = null;
        }

        this.campaign.scene_history.push(sceneId);
        this.campaign.current_scene = sceneId;
        this.currentScene = scene;

        // Check for ending
        if (scene.ending) {
            return {
                type: 'ending',
                from: this.campaign.scene_history[this.campaign.scene_history.length - 2] || null,
                to: sceneId,
                scene: {
                    id: scene.id,
                    title: scene.title,
                    description: scene.description
                },
                ending: scene.ending,
                narration: `${scene.title}\n\n${scene.description}\n\n${scene.ending.description}`,
                available_actions: [
                    { type: 'restart', label: '重新开始' },
                    { type: 'load_save', label: '读取存档' }
                ]
            };
        }

        // Check for combat on scene entry
        if (scene.combat?.enabled) {
            const enemies = scene.combat.enemies || [];
            return {
                type: 'scene_change_combat',
                from: this.campaign.scene_history[this.campaign.scene_history.length - 2] || null,
                to: sceneId,
                scene: {
                    id: scene.id,
                    title: scene.title,
                    description: scene.description,
                    npcs_present: scene.npcs_present || [],
                    combat: scene.combat
                },
                narration: `你来到了${scene.title}。${scene.description}\n\n⚔️ 敌人出现！${enemies.map(e => this.module.npcs?.[e]?.name || e).join('、')}正挡在你面前。`,
                combat: {
                    enemies,
                    alert: true
                },
                available_actions: [
                    { type: 'combat_start', label: '开始战斗' },
                    ...this.getAvailableActions()
                ]
            };
        }

        return {
            type: 'scene_change',
            from: this.campaign.scene_history[this.campaign.scene_history.length - 2] || null,
            to: sceneId,
            scene: {
                id: scene.id,
                title: scene.title,
                description: scene.description,
                npcs_present: scene.npcs_present || [],
                interactables: scene.interactables || []
            },
            narration: `你来到了${scene.title}。${scene.description}`,
            available_actions: this.getAvailableActions()
        };
    }

    // ==================== Utility Methods ====================

    /**
     * Sanitize narration text to prevent XSS injection
     * @param {string} text - Raw text to sanitize
     * @returns {string} Sanitized text
     */
    sanitizeNarration(text) {
        if (typeof text !== 'string') return String(text);
        // Remove HTML tags to prevent XSS
        return text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                   .replace(/javascript:/gi, '')
                   .replace(/on\w+\s*=/gi, '');
    }

    /**
     * Parse effect string (e.g., "cult_awareness + 1", "sanity_loss 1d3")
     * @param {string} effectStr - Effect string
     * @returns {object|null} Parsed effect
     */
    parseEffectString(effectStr) {
        const match = effectStr.match(/^(.+?)\s*([+-])\s*(\d+)|(.+?)\s+(\d+d\d+)|(.+?)\s+(\d+)$/);
        if (!match) return null;

        if (match[1]) {
            return { target: match[1].trim(), operation: match[2], value: parseInt(match[3]) };
        } else if (match[4]) {
            return { target: match[4].trim(), operation: 'dice', value: match[5] };
        } else if (match[6]) {
            return { target: match[6].trim(), operation: 'set', value: parseInt(match[7]) };
        }
        return null;
    }

    /**
     * Apply effect to campaign state
     * @param {object} effect - Parsed effect
     */
    applyEffect(effect) {
        if (effect.operation === '+' || effect.operation === '-') {
            const current = this.campaign.global_vars[effect.target] || 0;
            this.campaign.global_vars[effect.target] = effect.operation === '+'
                ? current + effect.value
                : current - effect.value;
        } else if (effect.operation === 'dice') {
            const loss = this.parseDiceExpression(effect.value);
            if (effect.target === 'sanity_loss') {
                const oldSanity = this.campaign.player.sanity || 50;
                this.campaign.player.sanity = Math.max(0, oldSanity - loss);
            }
        } else if (effect.operation === 'set') {
            this.campaign.global_vars[effect.target] = effect.value;
        }
    }

    /**
     * Describe effect in human-readable text
     * @param {object} effect - Parsed effect
     * @returns {string} Effect description
     */
    describeEffect(effect) {
        if (effect.operation === '+' || effect.operation === '-') {
            const sign = effect.operation === '+' ? '增加' : '减少';
            return `${effect.target}${sign}${effect.value}`;
        } else if (effect.operation === 'dice') {
            if (effect.target === 'sanity_loss') {
                const loss = this.parseDiceExpression(effect.value);
                return `失去${loss}点SAN值`;
            }
            return `${effect.target} ${effect.value}`;
        }
        return '';
    }

    /**
     * Parse dice expression (e.g., "1d6", "2d10+3")
     * @param {string} expression - Dice expression
     * @returns {number} Roll result
     */
    parseDiceExpression(expression) {
        if (typeof expression === 'number') return expression;
        const match = expression.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
        if (!match) return 0;
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const mod = match[4] ? (match[3] === '+' ? 1 : -1) * parseInt(match[4]) : 0;
        let total = mod;
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        return total;
    }

    /**
     * Get current time (for time-based events)
     * @returns {string} Current time of day
     */
    getCurrentTime() {
        const hour = new Date().getHours();
        if (hour < 6) return 'night';
        if (hour < 12) return 'morning';
        if (hour < 18) return 'afternoon';
        return 'night';
    }
}

/**
 * Build narration text for dice check results
 * @param {string} skill - Skill name
 * @param {number} roll - Dice roll result
 * @param {number} target - Target value
 * @param {string} result - Check result
 * @returns {string} Narration text
 */
function buildCheckNarration(skill, roll, target, result) {
    const diff = target - roll;
    switch (result) {
        case 'critical':
            return `大成功！你的${skill}检定结果${roll}，远超预期！`;
        case 'extreme':
            return `极难成功！${skill}检定${roll}，近乎完美的表现。`;
        case 'hard':
            return `困难成功！${skill}检定${roll}，你的技巧令人印象深刻。`;
        case 'success':
            return `成功！${skill}检定${roll}，刚好在范围内。`;
        case 'fumble':
            return `大失败！${skill}检定${roll}...灾难性的失误。`;
        case 'fail':
            return `失败。${skill}检定${roll}，还差${diff}点。`;
        default:
            return `${skill}检定：${roll} / ${target}`;
    }
}
