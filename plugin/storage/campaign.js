/**
 * Campaign Storage
 * Manages save/load persistence (MVP: in-memory, Phase 2: SQLite)
 */
import Database from 'better-sqlite3';

export class CampaignStorage {
    constructor(dbPath = './data/ai-gm.db') {
        this.dbPath = dbPath;
        this.db = null;
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

    saveSnapshot(campaignId, slot, label, data) {
        // MVP: in-memory
        return { success: true, slot, label };
    }

    loadSnapshot(campaignId, slot) {
        // MVP: in-memory
        return null;
    }

    getSnapshots(campaignId) {
        // MVP: in-memory
        return [];
    }

    logAction(campaignId, type, actor, content, metadata) {
        // MVP: in-memory
        return { success: true };
    }

    getHistory(campaignId, limit = 100) {
        // MVP: in-memory
        return [];
    }
}
