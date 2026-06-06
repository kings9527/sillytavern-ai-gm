/**
 * Dice Roller
 * Parses and executes dice expressions like "1d6", "2d10+3", "d20"
 * 
 * @version 0.3.0
 */
export class DiceRoller {
    constructor() {
        /** @type {Array<{expression: string, rolls: number[], total: number, breakdown: string, timestamp: string}>} */
        this.history = [];
    }

    /**
     * Roll a dice expression
     * @param {string} expression - Dice expression (e.g. "1d6", "2d10+3")
     * @returns {{expression: string, rolls: number[], total: number, breakdown: string}} Roll result
     * @throws {Error} If expression is invalid or empty
     */
    roll(expression) {
        if (!expression || typeof expression !== 'string') {
            throw new Error(`Invalid dice expression: ${expression}`);
        }
        const result = this.parseAndRoll(expression.trim());
        this.history.push({ expression, ...result, timestamp: new Date().toISOString() });
        return result;
    }

    /**
     * Parse and roll a dice expression
     * @param {string} expression - Dice expression
     * @returns {{expression: string, rolls: number[], total: number, breakdown: string}} Roll result
     * @private
     */
    parseAndRoll(expression) {
        const expr = expression.toLowerCase().replace(/\s/g, '');
        
        // Parse dice components: 2d6+3, 1d100, d20, etc.
        // Require at least one digit or 'd' to avoid matching empty strings
        const pattern = /([+-]?)(\d+)(?:d(\d+))?/g;
        let match;
        let total = 0;
        const rolls = [];
        const breakdown = [];

        while ((match = pattern.exec(expr)) !== null) {
            const sign = match[1] === '-' ? -1 : 1;
            const count = match[2] ? parseInt(match[2]) : 1;
            const sides = match[3] ? parseInt(match[3]) : null;

            if (!sides) {
                // Static modifier (e.g., +3, -2)
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

    /**
     * Roll multiple expressions at once
     * @param {Array<string>} expressions - Array of dice expressions
     * @returns {Array<{expression: string, rolls: number[], total: number, breakdown: string}>} Roll results
     */
    rollMultiple(expressions) {
        return expressions.map(expr => this.roll(expr));
    }

    /**
     * Get roll history
     * @returns {Array<{expression: string, rolls: number[], total: number, breakdown: string, timestamp: string}>} Roll history
     */
    getHistory() {
        return this.history;
    }

    /**
     * Clear roll history
     * @returns {void}
     */
    clearHistory() {
        this.history = [];
    }
}
