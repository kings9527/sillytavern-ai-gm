/**
 * Rule Engine
 * Supports multiple TTRPG systems via JSON configuration
 */
export class RuleEngine {
    constructor(system = 'coc') {
        this.system = system;
        this.rules = this.loadSystemRules(system);
    }

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

    check(skill, skillValue, roll) {
        const system = this.rules;
        if (system.name.includes('Cthulhu')) {
            return this.cocCheck(skill, skillValue, roll);
        }
        return this.genericCheck(skill, skillValue, roll);
    }

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

    genericCheck(skill, skillValue, roll) {
        return {
            result: roll <= skillValue ? 'success' : 'fail',
            roll,
            target: skillValue
        };
    }

    calculateDamage(stats, weapon) {
        // TODO: Implement damage calculation based on system rules
        return { damage: 0, formula: 'not_implemented' };
    }

    calculateSanityLoss(amount, currentSanity) {
        const loss = this.parseDiceExpression(amount);
        const newSanity = Math.max(0, currentSanity - loss);
        return { loss, newSanity, insane: newSanity <= 0 };
    }

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
