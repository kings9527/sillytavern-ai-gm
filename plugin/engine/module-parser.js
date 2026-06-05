/**
 * Module Parser
 * Converts Markdown/JSON into structured module format
 */
export class ModuleParser {
    constructor(format = 'markdown') {
        this.format = format;
        this.warnings = [];
    }

    async parse(source) {
        if (this.format === 'json') {
            return this.parseJSON(source);
        }
        if (this.format === 'markdown') {
            return this.parseMarkdown(source);
        }
        throw new Error(`Unsupported format: ${this.format}`);
    }

    parseJSON(source) {
        try {
            const module = typeof source === 'string' ? JSON.parse(source) : source;
            this.validate(module);
            return module;
        } catch (e) {
            throw new Error(`JSON parse error: ${e.message}`);
        }
    }

    parseMarkdown(source) {
        // TODO: Implement Markdown → JSON conversion using LLM or regex
        // For MVP, return placeholder
        this.warnings.push('Markdown parsing not fully implemented, using basic extraction');
        return {
            id: 'parsed_module',
            name: 'Parsed Module',
            version: '0.1.0',
            system: 'custom',
            scenes: {},
            npcs: {}
        };
    }

    validate(module) {
        const required = ['name', 'version', 'system', 'scenes'];
        for (const field of required) {
            if (!module[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        return true;
    }
}
