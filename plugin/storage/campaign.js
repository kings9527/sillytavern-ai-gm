/**
 * Campaign Storage
 * Manages save/load persistence (MVP: in-memory, Phase 2: SQLite)
 */
export class CampaignStorage {
    constructor(dbPath = './data/ai-gm.db') {
        this.dbPath = dbPath;
        this.db = null;
        this.memorySaves = new Map(); // campaign_id -> { slot -> saveData }
        this.memoryLogs = new Map(); // campaign_id -> [logs]
    }

    async init() {
        // For MVP, in-memory only. Phase 2: SQLite
        // this.db = new Database(this.dbPath);
        // this.createTables();
    }

    createTables() {
        const tables = [
            `CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY,
                module_id TEXT,
                player_name TEXT,
                created_at TEXT,
                updated_at TEXT,
                data TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS saves (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id TEXT,
                slot INTEGER,
                label TEXT,
                saved_at TEXT,
                scene_id TEXT,
                turn_count INTEGER,
                data TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id TEXT,
                timestamp TEXT,
                type TEXT,
                actor TEXT,
                content TEXT,
                metadata TEXT
            )`
        ];
        tables.forEach(sql => this.db.exec(sql));
    }

    saveCampaign(campaign) {
        // MVP: in-memory
        return { success: true, id: campaign.id };
    }

    loadCampaign(id) {
        // MVP: in-memory
        return null;
    }

    /**
     * Save campaign snapshot to a slot
     * @param {string} campaignId - Campaign ID
     * @param {number} slot - Save slot (1-5)
     * @param {string} label - Save label
     * @param {object} campaignData - Campaign data to save
     * @returns {object} Save result
     */
    saveSnapshot(campaignId, slot = 1, label = '手动存档', campaignData) {
        if (!this.memorySaves.has(campaignId)) {
            this.memorySaves.set(campaignId, new Map());
        }
        
        const saves = this.memorySaves.get(campaignId);
        const saveData = {
            ...campaignData,
            saved_at: new Date().toISOString(),
            slot,
            label,
            scene_id: campaignData.current_scene || 'unknown',
            turn_count: (campaignData.scene_history || []).length
        };
        
        saves.set(slot, saveData);
        
        return { 
            success: true, 
            slot, 
            label, 
            scene_id: saveData.scene_id,
            turn_count: saveData.turn_count,
            saved_at: saveData.saved_at
        };
    }

    /**
     * Load campaign snapshot from a slot
     * @param {string} campaignId - Campaign ID
     * @param {number} slot - Save slot
     * @returns {object|null} Save data or null
     */
    loadSnapshot(campaignId, slot = 1) {
        const saves = this.memorySaves.get(campaignId);
        if (!saves) return null;
        return saves.get(slot) || null;
    }

    /**
     * Get all snapshots for a campaign
     * @param {string} campaignId - Campaign ID
     * @returns {Array<object>} List of save info
     */
    getSnapshots(campaignId) {
        const saves = this.memorySaves.get(campaignId);
        if (!saves) return [];
        
        return Array.from(saves.entries()).map(([slot, data]) => ({
            slot,
            label: data.label,
            saved_at: data.saved_at,
            scene_id: data.scene_id,
            turn_count: data.turn_count
        })).sort((a, b) => a.slot - b.slot);
    }

    /**
     * Delete a snapshot
     * @param {string} campaignId - Campaign ID
     * @param {number} slot - Save slot
     * @returns {object} Delete result
     */
    deleteSnapshot(campaignId, slot) {
        const saves = this.memorySaves.get(campaignId);
        if (saves) {
            saves.delete(slot);
        }
        return { success: true, slot };
    }

    /**
     * Log an action to campaign history
     * @param {string} campaignId - Campaign ID
     * @param {string} type - Action type
     * @param {string} actor - Actor name
     * @param {string} content - Action content
     * @param {object} metadata - Additional metadata
     * @returns {object} Log result
     */
    logAction(campaignId, type, actor, content, metadata = {}) {
        if (!this.memoryLogs.has(campaignId)) {
            this.memoryLogs.set(campaignId, []);
        }
        
        const logEntry = {
            id: Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            type,
            actor,
            content,
            metadata
        };
        
        this.memoryLogs.get(campaignId).push(logEntry);
        return { success: true, log_id: logEntry.id };
    }

    /**
     * Get campaign history log
     * @param {string} campaignId - Campaign ID
     * @param {number} limit - Maximum entries to return
     * @returns {Array<object>} Log entries
     */
    getHistory(campaignId, limit = 100) {
        const logs = this.memoryLogs.get(campaignId) || [];
        return logs.slice(-limit);
    }

    /**
     * Get full campaign log for export
     * @param {string} campaignId - Campaign ID
     * @returns {object} Full campaign log
     */
    getFullCampaignLog(campaignId) {
        const logs = this.memoryLogs.get(campaignId) || [];
        const saves = this.memorySaves.get(campaignId);
        const saveCount = saves ? saves.size : 0;
        
        return {
            campaign_id: campaignId,
            total_entries: logs.length,
            save_count: saveCount,
            logs: logs,
            summary: this.generateLogSummary(logs)
        };
    }

    /**
     * Generate summary of campaign log
     * @param {Array<object>} logs - Log entries
     * @returns {object} Summary statistics
     */
    generateLogSummary(logs) {
        const typeCounts = {};
        const actorCounts = {};
        let diceChecks = 0;
        let combatRounds = 0;
        let sceneTransitions = 0;
        
        logs.forEach(log => {
            typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
            actorCounts[log.actor] = (actorCounts[log.actor] || 0) + 1;
            if (log.type === 'dice_check') diceChecks++;
            if (log.type === 'combat') combatRounds++;
            if (log.type === 'scene_transition') sceneTransitions++;
        });
        
        return {
            total_actions: logs.length,
            type_distribution: typeCounts,
            actor_distribution: actorCounts,
            dice_checks: diceChecks,
            combat_rounds: combatRounds,
            scene_transitions: sceneTransitions
        };
    }

    /**
     * Clear all campaign data
     * @param {string} campaignId - Campaign ID
     * @returns {object} Clear result
     */
    clearCampaign(campaignId) {
        this.memorySaves.delete(campaignId);
        this.memoryLogs.delete(campaignId);
        return { success: true, campaign_id: campaignId };
    }
}
