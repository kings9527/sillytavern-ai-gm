/**
 * Rule Engine
 * Supports multiple TTRPG systems via JSON configuration
 * 
 * Currently supported systems:
 * - Call of Cthulhu 7th Edition (coc)
 * - D&D 5th Edition (dnd5e)
 * 
 * @version 0.3.0
 */
export class RuleEngine {
    /**
     * Create a new RuleEngine instance
     * @param {string} system - TTRPG system identifier ('coc' or 'dnd5e')
     */
    constructor(system = 'coc') {
        /** @type {string} */
        this.system = system;
        /** @type {object} */
        this.rules = this.loadSystemRules(system);
    }

    /**
     * Load system rules configuration
     * @param {string} system - System identifier
     * @returns {object} System rules configuration
     * @private
     */
    loadSystemRules(system) {
        const systems = {
            coc: {
                name: 'Call of Cthulhu 7th Edition',
                dice: 'd100',
                attributes: ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU', 'LUCK'],
                check: {
                    type: 'd100_vs_skill',
                    success: 'roll <= target',
                    hard_success: 'roll <= target / 2',
                    extreme_success: 'roll <= target / 5',
                    critical: 'roll <= 5',
                    fumble: 'roll >= 96'
                },
                damage: {
                    formula: 'db + weapon_damage',
                    db_table: {
                        'STR+SIZ': [
                            { max: 64, db: '-2', build: -2 },
                            { max: 84, db: '-1', build: -1 },
                            { max: 124, db: '0', build: 0 },
                            { max: 164, db: '+1d4', build: 1 },
                            { max: 204, db: '+1d6', build: 2 },
                            { max: 999, db: '+2d6', build: 3 }
                        ]
                    }
                },
                sanity: {
                    start: 'POW',
                    loss_formula: '1d6/1d20',
                    indefinite: 'SAN <= 0',
                    temp_insanity: 'SAN loss >= 5 in one encounter'
                }
            },
            dnd5e: {
                name: 'D&D 5th Edition',
                dice: 'd20',
                attributes: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
                check: {
                    type: 'd20_vs_dc',
                    success: 'roll + modifier >= dc',
                    critical_success: 'natural_roll == 20',
                    critical_fail: 'natural_roll == 1'
                },
                damage: {
                    formula: 'weapon_dice + ability_modifier'
                }
            }
        };
        return systems[system] || systems.coc;
    }

    /**
     * Perform a skill check using the active system rules
     * @param {string} skill - Skill name
     * @param {number} skillValue - Skill value / target number
     * @param {number} roll - Dice roll result (1-100 for CoC)
     * @returns {{result: string, roll: number, target: number}} Check result
     */
    check(skill, skillValue, roll) {
        const system = this.rules;
        if (system.name.includes('Cthulhu')) {
            return this.cocCheck(skill, skillValue, roll);
        }
        return this.genericCheck(skill, skillValue, roll);
    }

    /**
     * CoC 7th Edition skill check
     * @param {string} skill - Skill name
     * @param {number} skillValue - Target value (skill level)
     * @param {number} roll - d100 roll result
     * @returns {{result: string, roll: number, target: number}} Check result with degree
     */
    cocCheck(skill, skillValue, roll) {
        const target = skillValue;
        const success = roll <= target;
        const hard = roll <= Math.floor(target / 2);
        const extreme = roll <= Math.floor(target / 5);
        const critical = roll <= 5;
        const fumble = roll >= 96;

        if (fumble) return { result: 'fumble', roll, target };
        if (critical) return { result: 'critical', roll, target };
        if (extreme) return { result: 'extreme', roll, target };
        if (hard) return { result: 'hard', roll, target };
        if (success) return { result: 'success', roll, target };
        return { result: 'fail', roll, target };
    }

    /**
     * Generic skill check for non-CoC systems
     * @param {string} skill - Skill name
     * @param {number} skillValue - Target value
     * @param {number} roll - Dice roll
     * @returns {{result: string, roll: number, target: number}} Check result
     */
    genericCheck(skill, skillValue, roll) {
        return {
            result: roll <= skillValue ? 'success' : 'fail',
            roll,
            target: skillValue
        };
    }

    /**
     * Calculate damage bonus (DB) based on STR+SIZ for CoC
     * @param {object} stats - Entity stats with STR and SIZ
     * @returns {{total: number, formula: string}} DB result with total and formula string
     */
    calculateDamageBonus(stats) {
        if (!stats) return { total: 0, formula: '' };
        
        const str = stats.STR || 50;
        const siz = stats.SIZ || 50;
        const sum = str + siz;
        
        // CoC 7e DB table
        if (sum <= 64) return { total: -2, formula: 'DB: -2 (STR+SIZ ≤ 64)' };
        if (sum <= 84) return { total: -1, formula: 'DB: -1 (STR+SIZ 65-84)' };
        if (sum <= 124) return { total: 0, formula: 'DB: 0 (STR+SIZ 85-124)' };
        if (sum <= 164) {
            const roll = Math.floor(Math.random() * 4) + 1;
            return { total: roll, formula: `DB: +1d4=${roll} (STR+SIZ 125-164)` };
        }
        if (sum <= 204) {
            const roll = Math.floor(Math.random() * 6) + 1;
            return { total: roll, formula: `DB: +1d6=${roll} (STR+SIZ 165-204)` };
        }
        const roll = (Math.floor(Math.random() * 6) + 1) + (Math.floor(Math.random() * 6) + 1);
        return { total: roll, formula: `DB: +2d6=${roll} (STR+SIZ ≥ 205)` };
    }

    /**
     * Get maximum possible roll for a dice expression (for critical hits)
     * @param {string} expression - Dice expression (e.g. "1d6", "2d10+3")
     * @returns {number} Maximum possible roll value
     */
    getMaxDiceRoll(expression) {
        if (typeof expression === 'number') return expression;
        const match = expression.match(/(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?/);
        if (!match) return 0;
        const count = parseInt(match[1]);
        const sides = parseInt(match[2]);
        const mod = match[4] ? (match[3] === '+' ? 1 : -1) * parseInt(match[4]) : 0;
        return count * sides + mod;
    }

    /**
     * Calculate sanity loss from a CoC sanity check
     * @param {string} amount - Dice expression for sanity loss (e.g. "1d6", "1d20")
     * @param {number} currentSanity - Current sanity value
     * @returns {{loss: number, newSanity: number, insane: boolean}} Sanity loss result
     */
    calculateSanityLoss(amount, currentSanity) {
        const loss = this.parseDiceExpression(amount);
        const newSanity = Math.max(0, currentSanity - loss);
        return { loss, newSanity, insane: newSanity <= 0 };
    }

    /**
     * Parse and roll a dice expression
     * @param {string} expression - Dice expression (e.g. "1d6", "2d10+3")
     * @returns {number} Total roll result
     */
    parseDiceExpression(expression) {
        if (typeof expression === 'number') return expression;
        // Simple dice parser: "1d6+3" -> roll + 3
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
}
