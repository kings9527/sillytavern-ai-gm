/**
 * NPC Decision Engine
 * AI-powered NPC behavior and dialogue generation
 */
export class NPCDecisionEngine {
    constructor(campaign, npcId) {
        this.campaign = campaign;
        this.npcId = npcId;
        this.npc = campaign.npcs_state[npcId];
        this.npcTemplate = campaign.module.npcs[npcId];
    }

    async decide(situation) {
        const context = this.buildContext(situation);
        
        // Fast rule-based decision for clear cases
        const ruleDecision = this.ruleBasedDecision(context);
        if (ruleDecision.confidence > 0.85) {
            return ruleDecision;
        }

        // For complex situations, use LLM (Phase 2)
        return this.llmDecision(context);
    }

    buildContext(situation) {
        return {
            npc: this.npc,
            template: this.npcTemplate,
            situation: situation || 'normal',
            campaign_state: {
                current_scene: this.campaign.current_scene,
                player_stats: this.campaign.player.stats,
                global_vars: this.campaign.global_vars
            },
            available_actions: this.getAvailableActions()
        };
    }

    getAvailableActions() {
        const actions = ['talk', 'emote', 'ignore'];
        if (this.npcTemplate.role === 'enemy') {
            actions.push('attack', 'flee');
        }
        if (this.npcTemplate.role === 'Boss') {
            actions.push('special_attack', 'summon');
        }
        return actions;
    }

    ruleBasedDecision(context) {
        const { npc, template, situation } = context;

        // HP critical → flee
        if (npc.current_hp / (template.stats?.HP || 10) < 0.25) {
            if (template.role === 'enemy') {
                return { decision: 'flee', confidence: 0.95, reasoning: 'HP critical' };
            }
        }

        // Player threatens → hostile reaction
        if (situation.includes('threat') || situation.includes('attack')) {
            if (template.role === 'enemy') {
                return { decision: 'attack', confidence: 0.9, reasoning: 'Player is hostile' };
            }
        }

        // Cult-related trigger → nervous/secrecy
        if (situation.includes('cult') && template.secrets?.length > 0) {
            return { decision: 'evade', confidence: 0.88, reasoning: 'Cult topic triggers secrecy' };
        }

        return { decision: null, confidence: 0 };
    }

    llmDecision(context) {
        // Phase 2: Integrate with SillyTavern's LLM generation
        // For MVP, return a generic decision based on role
        const { template, situation } = context;
        
        let decision = 'talk';
        if (template.role === 'enemy') decision = 'attack';
        if (template.role === 'Boss') decision = 'special_attack';
        if (situation.includes('friendly')) decision = 'talk';

        return {
            decision,
            confidence: 0.6,
            reasoning: 'Default role-based decision (MVP)',
            system_prompt_addition: `NPC is ${template.role}, respond accordingly.`
        };
    }

    async generateDialogue(contextSummary, mood) {
        const template = this.npcTemplate;
        
        // Build system prompt for NPC
        const prompt = {
            role: 'system',
            content: `You are ${template.name}, ${template.description}.
Your personality: ${template.personality}.
Current mood: ${mood}.
Context: ${contextSummary}.
Respond in character, maintaining consistency. Keep responses concise (1-2 paragraphs).`
        };

        // Phase 2: Send to SillyTavern's generation system
        return {
            dialogue: `[${template.name} responds in ${mood} mood]`,
            actions: []
        };
    }
}
