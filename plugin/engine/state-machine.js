/**
 * Game State Machine
 * Manages scene transitions, player actions, and game flow
 */
export class GameStateMachine {
    constructor(module, campaign) {
        this.module = module;
        this.campaign = campaign;
        this.currentScene = module.scenes[campaign.current_scene];
    }

    async processAction(action) {
        const { action_type, player_input } = action;

        // 1. Parse intent from player input
        const intent = await this.parseIntent(player_input, action_type);

        // 2. Check scene exits
        const matchedExit = this.findMatchingExit(intent);
        if (matchedExit) {
            return this.transitionTo(matchedExit.target_scene, { intent, matchedExit });
        }

        // 3. Handle scene interaction
        return this.handleSceneInteraction(intent);
    }

    async parseIntent(input, actionType) {
        // For MVP, simple keyword matching
        // Phase 2: Use LLM for intent classification
        const keywords = {
            move: ['去', '走', '到', '前往', 'enter', 'go to', 'move to'],
            talk: ['说', '问', 'talk', 'ask', 'speak', 'tell'],
            inspect: ['看', '检查', 'inspect', 'check', 'look', 'examine'],
            attack: ['攻击', '打', 'attack', 'fight', 'hit'],
            use: ['用', '使用', 'use', 'activate'],
            flee: ['跑', '逃跑', 'flee', 'run', 'escape']
        };

        const inputLower = (input || '').toLowerCase();
        for (const [intent, words] of Object.entries(keywords)) {
            if (words.some(w => inputLower.includes(w.toLowerCase()))) {
                return { type: intent, raw: input };
            }
        }
        return { type: actionType || 'inspect', raw: input };
    }

    findMatchingExit(intent) {
        if (!this.currentScene.exits) return null;
        return this.currentScene.exits.find(exit => {
            if (exit.condition === 'always') return true;
            if (typeof exit.condition === 'object') {
                return this.evaluateCondition(exit.condition);
            }
            return false;
        });
    }

    evaluateCondition(condition) {
        // Simple condition evaluation
        for (const [key, value] of Object.entries(condition)) {
            if (!this.campaign.global_vars[key] === value) {
                return false;
            }
        }
        return true;
    }

    async handleSceneInteraction(intent) {
        // Handle NPC interaction, item inspection, etc.
        const result = {
            type: 'interaction',
            scene: this.currentScene.id,
            narration: '你环顾四周...',
            available_actions: this.getAvailableActions()
        };

        if (intent.type === 'talk') {
            result.narration = '你想和谁交谈？';
            result.available_actions = this.currentScene.npcs_present?.map(id => ({
                type: 'talk_to',
                target: id,
                label: this.module.npcs[id]?.name || id
            })) || [];
        }

        if (intent.type === 'inspect') {
            result.narration = this.currentScene.description;
        }

        return result;
    }

    getAvailableActions() {
        const actions = [];
        if (this.currentScene.exits) {
            actions.push(...this.currentScene.exits.map(e => ({
                type: 'move',
                target: e.target_scene,
                label: e.description
            })));
        }
        if (this.currentScene.npcs_present?.length > 0) {
            actions.push({ type: 'talk', label: '交谈' });
        }
        return actions;
    }

    async transitionTo(sceneId, metadata = {}) {
        const scene = this.module.scenes[sceneId];
        if (!scene) {
            throw new Error(`Scene not found: ${sceneId}`);
        }

        this.campaign.scene_history.push(sceneId);
        this.campaign.current_scene = sceneId;
        this.currentScene = scene;

        return {
            type: 'scene_change',
            from: this.campaign.scene_history[this.campaign.scene_history.length - 2] || null,
            to: sceneId,
            scene: {
                id: scene.id,
                title: scene.title,
                description: scene.description,
                npcs_present: scene.npcs_present || []
            },
            narration: `你来到了${scene.title}。${scene.description}`,
            available_actions: this.getAvailableActions()
        };
    }
}
