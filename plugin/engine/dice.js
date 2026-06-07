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
        /** @type {Map<string, RegExp>} Cache for compiled regex patterns */
        this._regexCache = new Map();
        /** @type {Map<string, {rolls: number[], total: number, breakdown: string}>} Cache for parsed dice structures (not rolled results) */
        this._parseCache = new Map();
        /** @type {number} Maximum cache size for parse results */
        this._maxCacheSize = 50;
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
        
        // Check parse cache for structure (does not cache random results)
        const cached = this._parseCache.get(expr);
        if (cached) {
            // Re-roll using cached structure but fresh random values
            const result = this._executeRoll(cached.structure);
            return { expression, ...result };
        }
        
        const structure = this._parseExpression(expr);
        
        // Cache the parsed structure for performance
        if (this._parseCache.size >= this._maxCacheSize) {
            const firstKey = this._parseCache.keys().next().value;
            this._parseCache.delete(firstKey);
        }
        this._parseCache.set(expr, { structure });
        
        const result = this._executeRoll(structure);
        return { expression, ...result };
    }

    /**
     * Parse dice expression into rollable structure
     * @param {string} expr - Normalized expression
     * @returns {Array<{sign: number, count: number, sides: number|null}>} Parsed structure
     * @private
     */
    _parseExpression(expr) {
        const structure = [];
        const pattern = /([+-]?)(\d+)(?:d(\d+))?/g;
        let match;

        while ((match = pattern.exec(expr)) !== null) {
            const sign = match[1] === '-' ? -1 : 1;
            const count = match[2] ? parseInt(match[2]) : 1;
            const sides = match[3] ? parseInt(match[3]) : null;
            structure.push({ sign, count, sides });
        }
        return structure;
    }

    /**
     * Execute roll from parsed structure
     * @param {Array<{sign: number, count: number, sides: number|null}>} structure
     * @returns {{rolls: number[], total: number, breakdown: string}} Roll result
     * @private
     */
    _executeRoll(structure) {
        let total = 0;
        const rolls = [];
        const breakdown = [];

        for (const item of structure) {
            if (!item.sides) {
                total += item.sign * item.count;
                breakdown.push(`${item.sign > 0 ? '+' : '-'}${item.count}`);
                continue;
            }

            const diceRolls = [];
            for (let i = 0; i < item.count; i++) {
                const roll = Math.floor(Math.random() * item.sides) + 1;
                diceRolls.push(roll);
                total += item.sign * roll;
            }
            rolls.push(...diceRolls);
            breakdown.push(`${item.sign > 0 ? '' : '-'}${item.count}d${item.sides}(${diceRolls.join('+')})`);
        }

        return {
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
