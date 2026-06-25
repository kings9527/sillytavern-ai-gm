/**
 * Prompt Builder
 * Constructs system prompts for LLM interactions
 */
export class PromptBuilder {
  constructor(campaign) {
    this.campaign = campaign;
    this.module = campaign.module;
  }

  buildGMContextPrompt() {
    const scene = this.module.scenes[this.campaign.current_scene];
    const player = this.campaign.player;

    return {
      role: 'system',
      content: `You are the Game Master (GM) for a ${this.module.system} tabletop RPG.

Current Scene: ${scene.title}
Description: ${scene.description}

Player: ${player.name}
Player Stats: ${JSON.stringify(player.stats)}
Player Status: HP ${player.stats.HP || '?'}/${player.stats.HP || '?'}, SAN ${player.sanity || '?'}/${player.max_sanity || '?'}

NPCs Present: ${(scene.npcs_present || [])
        .map((id) => this.module.npcs[id]?.name)
        .filter(Boolean)
        .join(', ')}

Global State: ${JSON.stringify(this.campaign.global_vars)}

Your responsibilities:
1. Describe scenes vividly and atmospherically
2. Roleplay NPCs when they speak
3. Request dice rolls when needed (format: [ROLL: SkillName TargetValue])
4. Track game state changes
5. Maintain the horror/mystery tone of the game
6. Be fair but challenging

Always respond in character as the GM. Never break the fourth wall.\n`,
    };
  }

  buildNPCDialoguePrompt(npcId, contextSummary, mood) {
    const npc = this.module.npcs[npcId];
    if (!npc) return null;

    const npcState = this.campaign.npcs_state[npcId] || {};

    return {
      role: 'system',
      content: `You are ${npc.name}, ${npc.description}.

Personality: ${npc.personality}
Current Mood: ${mood}
Attitude toward player: ${npcState.attitude || 'neutral'}
Known Secrets: ${npcState.known_secrets?.join(', ') || 'none'}

Context Summary: ${contextSummary}

Rules:
1. Stay in character at all times
2. Only reveal information consistent with your knowledge
3. Use your speech patterns and vocabulary
4. React to the player's attitude and actions
5. Keep responses concise (1-2 paragraphs)
6. If you have a secret, be evasive or misleading about it

Current Scene: ${this.module.scenes[this.campaign.current_scene]?.title || 'Unknown'}`,
    };
  }

  buildSceneDescriptionPrompt(sceneId, transition) {
    const scene = this.module.scenes[sceneId];
    if (!scene) {
      return {
        role: 'system',
        content: `Describe the scene transition to the player.\n\nNew Scene: Unknown\nDescription: Scene not found\nTransition: ${transition || 'The player enters this area'}`,
      };
    }
    return {
      role: 'system',
      content: `Describe the scene transition to the player.

New Scene: ${scene.title}
Description: ${scene.description}
Transition: ${transition || 'The player enters this area'}

Requirements:
1. Write in second person ("You see...", "You enter...")
2. Include sensory details (sight, sound, smell)
3. Maintain the horror atmosphere
4. Mention any NPCs present
5. Hint at available actions without listing them
6. Keep to 2-3 paragraphs`,
    };
  }

  buildCombatNarrationPrompt(action, _result) {
    return {
      role: 'system',
      content: `Narrate a combat action in dramatic prose.

Action: ${action.actor} performs ${action.action}
Result: ${action.hit ? 'Hit' : 'Miss'}${action.damage != null ? ` for ${action.damage} damage` : ''}

Requirements:
1. Describe the attack/defense vividly
2. Include sensory details (sounds, impacts, reactions)
3. Maintain tension and pacing
4. Keep to 1 paragraph`,
    };
  }

  buildSanityCheckPrompt(sanityLoss, situation) {
    return {
      role: 'system',
      content: `Describe a sanity loss event in a horror RPG.

Situation: ${situation}
Sanity Loss: ${sanityLoss}

Requirements:
1. Describe the psychological impact
2. Use visceral, unsettling imagery
3. Show the character's internal reaction
4. Keep to 1-2 paragraphs
5. Never be graphic for gore's sake, focus on psychological horror`,
    };
  }
}
