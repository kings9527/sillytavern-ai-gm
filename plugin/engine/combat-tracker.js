/**
 * Combat Tracker
 * Manages turn-based combat encounters with CoC 7e rules
 * 
 * Features:
 * - Initiative tracking (DEX-based or d100)
 * - Player HP sync to campaign state
 * - Enemy auto-attack turns
 * - Damage calculation via RuleEngine
 * - Combat log
 * 
 * @version 0.2.0
 */
import { RuleEngine } from './rule-engine.js';

export class CombatTracker {
    constructor(campaign) {
        this.campaign = campaign;
        this.state = campaign.combat_state || null;
        this.rules = new RuleEngine(campaign.module?.system || 'coc');
    }

    /**
     * Initialize combat with enemies
     * @param {Array<string>} enemies - Array of enemy NPC IDs
     * @returns {object} Combat state
     */
    initCombat(enemies) {
        const initiative = [];

        // Add player
        const playerInit = this.rollInitiative(this.campaign.player);
        initiative.push({
            entity_id: 'player_1',
            name: this.campaign.player.name,
            roll: playerInit,
            type: 'player',
            stats: this.campaign.player.stats
        });

        // Add enemies
        enemies.forEach(enemyId => {
            const npcTemplate = this.campaign.module?.npcs?.[enemyId];
            const npcState = this.campaign.npcs_state[enemyId];
            if (npcState && npcTemplate) {
                const npcInit = this.rollInitiative(npcTemplate.stats);
                initiative.push({
                    entity_id: enemyId,
                    name: npcTemplate.name || enemyId,
                    roll: npcInit,
                    type: 'enemy',
                    stats: npcTemplate.stats,
                    combat_skills: npcTemplate.combat_skills || []
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
            log: [`⚔️ 战斗开始！第1回合。${initiative[0].name}先行动。`],
            defeated: [],
            total_damage_dealt: 0,
            total_damage_taken: 0
        };

        this.campaign.combat_state = this.state;
        return this.getState();
    }

    /**
     * Roll initiative for an entity
     * CoC: d100 (simplified) or DEX-based
     * @param {object} stats - Entity stats
     * @returns {number} Initiative roll
     */
    rollInitiative(stats) {
        if (!stats) return Math.floor(Math.random() * 100) + 1;
        // CoC: use DEX as tiebreaker, roll d100 for order
        const dex = stats.DEX || 50;
        const roll = Math.floor(Math.random() * 100) + 1;
        // Weighted by DEX: roll + (100 - DEX) * 0.5
        return Math.floor(roll + (100 - dex) * 0.5);
    }

    /**
     * Process player action in combat
     * @param {string} actor - Actor entity ID
     * @param {string} action - Action type (attack, move, flee, item, skill)
     * @param {string} target - Target entity ID
     * @param {object} params - Additional parameters
     * @returns {object} Action result with combat state
     */
    processAction(actor, action, target, params = {}) {
        if (!this.state || !this.state.active) {
            throw new Error('没有活跃的战斗');
        }

        const currentActor = this.state.initiative[this.state.current_turn_index];
        if (currentActor.entity_id !== actor) {
            throw new Error(`不是${currentActor.name}的回合。当前回合：${this.state.initiative[this.state.current_turn_index]?.name}`);
        }

        let result = { action, actor, log: '' };

        switch (action) {
            case 'attack':
                result = this.resolveAttack(actor, target, params);
                break;
            case 'move':
                result = { action: 'move', actor, log: `${currentActor.name} 移动了位置。` };
                break;
            case 'flee':
                result = this.resolveFlee(actor);
                break;
            case 'item':
                result = { action: 'item', actor, log: `${currentActor.name} 使用了物品。` };
                break;
            case 'skill':
                result = this.resolveSkillUse(actor, target, params);
                break;
            default:
                result = { action, actor, log: `${currentActor.name} 执行了${action}。` };
        }

        this.state.log.push(result.log);
        this.campaign.combat_state = this.state;

        // Advance turn
        this.advanceTurn();

        // Check if next turn is enemy auto-attack
        const nextResult = this.processEnemyAutoTurn();

        return { ...result, ...this.getState(), enemy_turns: nextResult || [] };
    }

    /**
     * Resolve attack action
     * @param {string} attacker - Attacker entity ID
     * @param {string} target - Target entity ID
     * @param {object} params - Attack parameters
     * @returns {object} Attack result
     */
    resolveAttack(attacker, target, params = {}) {
        const attackerData = this.state.initiative.find(i => i.entity_id === attacker);
        const targetData = this.state.initiative.find(i => i.entity_id === target);

        if (!targetData) {
            return {
                action: 'attack',
                actor: attacker,
                target,
                hit: false,
                damage: 0,
                log: `${attackerData?.name} 攻击了空气——目标不存在。`
            };
        }

        // Get attack skill
        const skillName = params.skill || '格斗';
        const skillValue = attackerData.stats?.[skillName] || attackerData.stats?.['STR'] || 50;

        // Roll attack
        const attackRoll = Math.floor(Math.random() * 100) + 1;
        const targetValue = skillValue + (params.modifier || 0);
        const success = attackRoll <= targetValue;
        const critical = attackRoll <= 5;
        const fumble = attackRoll >= 96;

        let result = {
            action: 'attack',
            actor: attacker,
            target,
            hit: false,
            damage: 0,
            critical: false,
            fumble: false,
            log: ''
        };

        if (fumble) {
            result.fumble = true;
            result.log = `${attackerData.name} 攻击大失败！${attackRoll}... 灾难性的失误！`;
            // Self-damage on fumble
            const selfDamage = 1;
            this.applyDamage(attacker, selfDamage);
            result.log += ` ${attackerData.name} 伤到了自己，受到${selfDamage}点伤害。`;
            return result;
        }

        if (critical) {
            result.critical = true;
            result.hit = true;
            // Critical hit: max damage
            const damage = this.calculateDamage(attackerData, targetData, { critical: true });
            this.applyDamage(target, damage.total);
            result.damage = damage.total;
            result.log = `${attackerData.name} 大成功！攻击${attackRoll}，造成致命一击！${targetData.name} 受到${damage.total}点伤害。${damage.formula}`;
            this.state.total_damage_dealt += damage.total;
            return result;
        }

        if (success) {
            result.hit = true;
            // Regular hit: roll damage
            const damage = this.calculateDamage(attackerData, targetData, { critical: false });
            this.applyDamage(target, damage.total);
            result.damage = damage.total;
            result.log = `${attackerData.name} 攻击成功(${attackRoll}/${targetValue})，${targetData.name} 受到${damage.total}点伤害。${damage.formula}`;
            this.state.total_damage_dealt += damage.total;
        } else {
            result.log = `${attackerData.name} 攻击失败(${attackRoll}/${targetValue})，没有击中${targetData.name}。`;
        }

        return result;
    }

    /**
     * Calculate damage using RuleEngine
     * @param {object} attacker - Attacker data
     * @param {object} target - Target data
     * @param {object} options - Damage options
     * @returns {object} Damage result with total and formula
     */
    calculateDamage(attacker, target, options = {}) {
        const stats = attacker.stats || {};
        const weapon = options.weapon || { damage: '1d6' };

        // Calculate damage bonus (DB) based on STR+SIZ
        const db = this.rules.calculateDamageBonus(stats);

        // Roll weapon damage
        let weaponDamage = this.rules.parseDiceExpression(weapon.damage);

        // Critical hit: max damage
        if (options.critical) {
            weaponDamage = this.rules.getMaxDiceRoll(weapon.damage);
        }

        // Add DB
        let totalDamage = weaponDamage + db.total;

        return {
            total: Math.max(1, totalDamage), // Minimum 1 damage
            formula: `伤害: ${weaponDamage} ${db.formula} = ${totalDamage}`,
            breakdown: {
                weapon: weaponDamage,
                db: db.total,
                db_formula: db.formula
            }
        };
    }

    /**
     * Apply damage to target
     * @param {string} target - Target entity ID
     * @param {number} damage - Damage amount
     */
    applyDamage(target, damage) {
        // Handle player damage
        if (target === 'player_1') {
            const oldHp = this.campaign.player.hp || 10;
            const newHp = Math.max(0, oldHp - damage);
            this.campaign.player.hp = newHp;
            this.state.total_damage_taken += damage;

            // Check for unconscious/death
            if (newHp <= 0) {
                this.state.active = false;
                this.state.log.push(`${this.campaign.player.name} 倒下——失去意识！战斗结束。`);
            }
            return;
        }

        // Handle NPC damage
        const npc = this.campaign.npcs_state[target];
        if (npc) {
            npc.current_hp = Math.max(0, npc.current_hp - damage);

            // Check if defeated
            if (npc.current_hp <= 0) {
                this.state.defeated.push(target);
                this.state.log.push(`${this.state.initiative.find(i => i.entity_id === target)?.name || target} 被击败了！`);
            }
        }

        // Check if all enemies are defeated
        this.checkCombatEnd();
    }

    /**
     * Check if combat should end
     */
    checkCombatEnd() {
        const enemiesAlive = this.state.initiative.filter(
            i => i.type === 'enemy' && this.campaign.npcs_state[i.entity_id]?.current_hp > 0
        );

        const playerAlive = this.campaign.player.hp > 0;

        if (enemiesAlive.length === 0) {
            this.state.active = false;
            this.state.log.push('🎉 所有敌人被击败！战斗结束。');
        } else if (!playerAlive) {
            this.state.active = false;
            this.state.log.push('💀 你倒下了。战斗失败。');
        }
    }

    /**
     * Resolve flee action
     * @param {string} actor - Actor entity ID
     * @returns {object} Flee result
     */
    resolveFlee(actor) {
        const actorData = this.state.initiative.find(i => i.entity_id === actor);
        const dex = actorData.stats?.DEX || 50;
        const fleeRoll = Math.floor(Math.random() * 100) + 1;
        // Flee based on DEX (or dodge skill if available)
        const success = fleeRoll <= dex;

        if (success) {
            this.state.active = false;
            return {
                action: 'flee',
                actor,
                success: true,
                log: `🏃 ${actorData.name} 成功逃跑！战斗结束。`
            };
        }
        return {
            action: 'flee',
            actor,
            success: false,
            log: `❌ ${actorData.name} 逃跑失败！${fleeRoll} vs ${dex}`
        };
    }

    /**
     * Resolve skill use in combat
     * @param {string} actor - Actor entity ID
     * @param {string} target - Target entity ID
     * @param {object} params - Skill parameters
     * @returns {object} Skill result
     */
    resolveSkillUse(actor, target, params = {}) {
        const actorData = this.state.initiative.find(i => i.entity_id === actor);
        const skill = params.skill || '闪避';
        const skillValue = actorData.stats?.[skill] || 40;
        const roll = Math.floor(Math.random() * 100) + 1;
        const success = roll <= skillValue;

        if (success) {
            return {
                action: 'skill',
                actor,
                skill,
                success: true,
                log: `${actorData.name} 使用${skill}成功(${roll}/${skillValue})！`
            };
        }
        return {
            action: 'skill',
            actor,
            skill,
            success: false,
            log: `${actorData.name} 使用${skill}失败(${roll}/${skillValue})。`
        };
    }

    /**
     * Process enemy auto-turns (for AI enemies)
     * @returns {Array<object>} Enemy action results
     */
    processEnemyAutoTurn() {
        const results = [];

        while (this.state.active && this.state.initiative[this.state.current_turn_index]?.type === 'enemy') {
            const enemy = this.state.initiative[this.state.current_turn_index];
            const action = this.decideEnemyAction(enemy);
            const result = this.resolveEnemyAction(enemy, action);
            results.push(result);
            this.state.log.push(result.log);
            this.advanceTurn();
        }

        this.campaign.combat_state = this.state;
        return results;
    }

    /**
     * Decide enemy action based on AI rules
     * @param {object} enemy - Enemy entity data
     * @returns {object} Enemy action decision
     */
    decideEnemyAction(enemy) {
        const enemyHP = this.campaign.npcs_state[enemy.entity_id]?.current_hp || 0;
        const maxHP = enemy.stats?.HP || 10;
        const hpPercent = enemyHP / maxHP;

        // Flee if HP < 20%
        if (hpPercent < 0.2) {
            return { type: 'flee', target: 'player_1' };
        }

        // Use occult magic if available and HP < 50%
        if (hpPercent < 0.5 && enemy.combat_skills?.includes('occult_magic')) {
            return { type: 'skill', skill: 'occult_magic', target: 'player_1' };
        }

        // Default: attack player
        return { type: 'attack', target: 'player_1', skill: '格斗' };
    }

    /**
     * Resolve enemy action
     * @param {object} enemy - Enemy entity data
     * @param {object} action - Enemy action
     * @returns {object} Action result
     */
    resolveEnemyAction(enemy, action) {
        switch (action.type) {
            case 'attack':
                return this.resolveAttack(enemy.entity_id, action.target, { skill: action.skill });
            case 'flee':
                return this.resolveFlee(enemy.entity_id);
            case 'skill':
                return this.resolveSkillUse(enemy.entity_id, action.target, { skill: action.skill });
            default:
                return { action: 'idle', actor: enemy.entity_id, log: `${enemy.name} 犹豫了一下。` };
        }
    }

    /**
     * Advance to next turn
     */
    advanceTurn() {
        if (!this.state.active) return;

        this.state.current_turn_index++;
        if (this.state.current_turn_index >= this.state.initiative.length) {
            this.state.current_turn_index = 0;
            this.state.round++;
            this.state.log.push(`--- 第${this.state.round}回合 ---`);
        }

        // Skip defeated entities
        while (this.state.defeated.includes(this.state.initiative[this.state.current_turn_index]?.entity_id)) {
            this.state.current_turn_index++;
            if (this.state.current_turn_index >= this.state.initiative.length) {
                this.state.current_turn_index = 0;
                this.state.round++;
                this.state.log.push(`--- 第${this.state.round}回合 ---`);
            }
        }

        this.state.current_turn = this.state.initiative[this.state.current_turn_index]?.entity_id;
    }

    /**
     * Get current combat state
     * @returns {object} Combat state
     */
    getState() {
        return this.state;
    }

    /**
     * Load combat state
     * @param {object} state - Combat state to load
     */
    loadState(state) {
        this.state = state;
    }

    /**
     * Heal entity (for items, first aid, etc.)
     * @param {string} entityId - Entity to heal
     * @param {number} amount - Heal amount
     * @returns {object} Heal result
     */
    heal(entityId, amount) {
        if (entityId === 'player_1') {
            const oldHp = this.campaign.player.hp || 0;
            const maxHp = this.campaign.player.max_hp || 10;
            this.campaign.player.hp = Math.min(maxHp, oldHp + amount);
            return {
                type: 'heal',
                entity: entityId,
                amount: this.campaign.player.hp - oldHp,
                log: `${this.campaign.player.name} 恢复${this.campaign.player.hp - oldHp}点HP。当前HP: ${this.campaign.player.hp}/${maxHp}`
            };
        }

        const npc = this.campaign.npcs_state[entityId];
        if (npc) {
            const oldHp = npc.current_hp;
            npc.current_hp = Math.min(npc.max_hp, oldHp + amount);
            return {
                type: 'heal',
                entity: entityId,
                amount: npc.current_hp - oldHp,
                log: `${npc.name || entityId} 恢复${npc.current_hp - oldHp}点HP。`
            };
        }

        return { type: 'heal', entity: entityId, amount: 0, log: '治疗无效。' };
    }

    /**
     * Get combat summary for UI display
     * @returns {object} Combat summary
     */
    getCombatSummary() {
        if (!this.state) return null;

        const aliveEnemies = this.state.initiative.filter(
            i => i.type === 'enemy' && this.campaign.npcs_state[i.entity_id]?.current_hp > 0
        );

        return {
            active: this.state.active,
            round: this.state.round,
            current_turn: this.state.current_turn,
            current_turn_name: this.state.initiative[this.state.current_turn_index]?.name,
            player_hp: this.campaign.player.hp,
            player_max_hp: this.campaign.player.max_hp,
            enemies: aliveEnemies.map(e => ({
                id: e.entity_id,
                name: e.name,
                hp: this.campaign.npcs_state[e.entity_id]?.current_hp || 0,
                max_hp: e.stats?.HP || 10
            })),
            log: this.state.log.slice(-5), // Last 5 messages
            total_damage_dealt: this.state.total_damage_dealt,
            total_damage_taken: this.state.total_damage_taken
        };
    }
}
