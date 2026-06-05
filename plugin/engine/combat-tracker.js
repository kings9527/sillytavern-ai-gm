/**
 * Combat Tracker
 * Manages turn-based combat encounters
 */
export class CombatTracker {
    constructor(campaign) {
        this.campaign = campaign;
        this.state = campaign.combat_state || null;
    }

    initCombat(enemies) {
        const initiative = [];
        
        // Add player
        const playerInit = this.rollInitiative(this.campaign.player);
        initiative.push({
            entity_id: 'player_1',
            name: this.campaign.player.name,
            roll: playerInit,
            type: 'player'
        });

        // Add enemies
        enemies.forEach(enemyId => {
            const npc = this.campaign.npcs_state[enemyId];
            if (npc) {
                const npcInit = this.rollInitiative(npc);
                initiative.push({
                    entity_id: enemyId,
                    name: this.campaign.module.npcs[enemyId]?.name || enemyId,
                    roll: npcInit,
                    type: 'enemy'
                });
            }
        });

        // Sort by initiative (highest first)
        initiative.sort((a, b) => b.roll - a.roll);

        this.state = {
            active: true,
            round: 1,
            initiative: initiative,
            current_turn_index: 0,
            current_turn: initiative[0].entity_id,
            log: [`Combat started! Round 1. ${initiative[0].name} acts first.`]
        };

        return this.getState();
    }

    rollInitiative(entity) {
        // For CoC: DEX-based or simple d100
        // For D&D: d20 + DEX modifier
        const dex = entity.stats?.DEX || 50;
        return Math.floor(Math.random() * 100) + 1; // Simplified for MVP
    }

    processAction(actor, action, target, params) {
        if (!this.state || !this.state.active) {
            throw new Error('No active combat');
        }

        const currentActor = this.state.initiative[this.state.current_turn_index];
        if (currentActor.entity_id !== actor) {
            throw new Error(`Not your turn. Current turn: ${currentActor.name}`);
        }

        let result = { action, actor, log: '' };

        switch (action) {
            case 'attack':
                result = this.resolveAttack(actor, target, params);
                break;
            case 'move':
                result = { action: 'move', actor, log: `${currentActor.name} moves.` };
                break;
            case 'flee':
                result = this.resolveFlee(actor);
                break;
            case 'item':
                result = { action: 'item', actor, log: `${currentActor.name} uses an item.` };
                break;
            default:
                result = { action, actor, log: `${currentActor.name} performs ${action}.` };
        }

        this.state.log.push(result.log);
        
        // Advance turn
        this.advanceTurn();

        return { ...result, ...this.getState() };
    }

    resolveAttack(attacker, target, params) {
        const attackerData = this.state.initiative.find(i => i.entity_id === attacker);
        const targetData = this.state.initiative.find(i => i.entity_id === target);

        // Simplified combat resolution for MVP
        const attackRoll = Math.floor(Math.random() * 100) + 1;
        const success = attackRoll <= 50; // 50% base chance

        if (success) {
            const damage = Math.floor(Math.random() * 6) + 1; // 1d6 damage
            this.applyDamage(target, damage);
            return {
                action: 'attack',
                actor: attacker,
                target,
                hit: true,
                damage,
                log: `${attackerData.name} hits ${targetData.name} for ${damage} damage!`
            };
        } else {
            return {
                action: 'attack',
                actor: attacker,
                target,
                hit: false,
                damage: 0,
                log: `${attackerData.name} misses ${targetData.name}!`
            };
        }
    }

    resolveFlee(actor) {
        const fleeRoll = Math.floor(Math.random() * 100) + 1;
        const success = fleeRoll <= 50;

        if (success) {
            this.state.active = false;
            return {
                action: 'flee',
                actor,
                success: true,
                log: 'You successfully escape!'
            };
        }
        return {
            action: 'flee',
            actor,
            success: false,
            log: 'You failed to escape!'
        };
    }

    applyDamage(target, damage) {
        // Update target HP
        const npc = this.campaign.npcs_state[target];
        if (npc) {
            npc.current_hp = Math.max(0, npc.current_hp - damage);
        }
        
        // Check if combat should end
        const enemiesAlive = this.state.initiative.filter(
            i => i.type === 'enemy' && this.campaign.npcs_state[i.entity_id]?.current_hp > 0
        );
        
        if (enemiesAlive.length === 0) {
            this.state.active = false;
            this.state.log.push('All enemies defeated! Combat ends.');
        }
    }

    advanceTurn() {
        if (!this.state.active) return;

        this.state.current_turn_index++;
        if (this.state.current_turn_index >= this.state.initiative.length) {
            this.state.current_turn_index = 0;
            this.state.round++;
            this.state.log.push(`Round ${this.state.round} begins.`);
        }
        this.state.current_turn = this.state.initiative[this.state.current_turn_index].entity_id;
    }

    getState() {
        return this.state;
    }

    loadState(state) {
        this.state = state;
    }
}
