/**
 * Dice Roller
 * Parses and executes dice expressions
 */
export class DiceRoller {
    constructor() {
        this.history = [];
    }

    roll(expression) {
        const result = this.parseAndRoll(expression);
        this.history.push({ expression, ...result, timestamp: new Date().toISOString() });
        return result;
    }

    parseAndRoll(expression) {
        // Normalize expression
        const expr = expression.toString().toLowerCase().replace(/\s/g, '');
        
        // Parse components: 2d6+3, 1d100, d20, etc.
        const pattern = /([+-]?)(\d*)(?:d(\d+))?/g;
        let match;
        let total = 0;
        const rolls = [];
        const breakdown = [];

        while ((match = pattern.exec(expr)) !== null) {
            const sign = match[1] === '-' ? -1 : 1;
            const count = match[2] ? parseInt(match[2]) : 1;
            const sides = match[3] ? parseInt(match[3]) : null;

            if (!sides) {
                // Static modifier
                total += sign * count;
                breakdown.push(`${sign > 0 ? '+' : '-'}${count}`);
                continue;
            }

            // Roll dice
            const diceRolls = [];
            for (let i = 0; i < count; i++) {
                const roll = Math.floor(Math.random() * sides) + 1;
                diceRolls.push(roll);
                total += sign * roll;
            }
            rolls.push(...diceRolls);
            breakdown.push(`${sign > 0 ? '' : '-'}${count}d${sides}(${diceRolls.join('+')})`);
        }

        return {
            expression,
            rolls,
            total,
            breakdown: breakdown.join('').replace(/^\+/, '')
        };
    }

    rollMultiple(expressions) {
        return expressions.map(expr => this.roll(expr));
    }

    getHistory() {
        return this.history;
    }

    clearHistory() {
        this.history = [];
    }
}
