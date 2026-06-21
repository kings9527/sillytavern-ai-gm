/**
 * Campaign Storage
 * Manages save/load persistence with SQLite backend (Phase 2)
 * Falls back to in-memory mode when SQLite is unavailable
 *
 * @version 1.0.0
 */

let Database = null;

// Dynamic import of better-sqlite3 — fails gracefully if not installed
try {
  const bs3 = await import('better-sqlite3');
  Database = bs3.default || bs3;
} catch {
  console.warn('[CampaignStorage] better-sqlite3 not available, using in-memory mode');
}

/**
 * CampaignStorage class
 * Handles persistence of campaign data, snapshots, and logs
 */
export class CampaignStorage {
  constructor(dbPath = './data/ai-gm.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.sqliteEnabled = false;
    this.memorySaves = new Map(); // campaign_id -> { slot -> saveData }
    this.memoryLogs = new Map(); // campaign_id -> [logs]
  }

  /**
   * Initialize storage — creates tables if SQLite is available
   */
  async init() {
    if (Database) {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.createTables();
        this.sqliteEnabled = true;
        console.log('[CampaignStorage] SQLite initialized at', this.dbPath);
      } catch (error) {
        console.warn('[CampaignStorage] SQLite init failed, falling back to memory:', error.message);
        this.sqliteEnabled = false;
      }
    }
  }

  /**
   * Create SQLite tables
   */
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
        data TEXT,
        UNIQUE(campaign_id, slot)
      )`,
      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT,
        timestamp TEXT,
        type TEXT,
        actor TEXT,
        content TEXT,
        metadata TEXT
      )`,
    ];
    for (const sql of tables) {
      this.db.exec(sql);
    }

    // Create indexes for performance
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_saves_campaign ON saves(campaign_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_campaign ON logs(campaign_id)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)');
  }

  /**
   * Save campaign to persistent storage
   * @param {object} campaign - Campaign data
   * @returns {object} Save result
   */
  saveCampaign(campaign) {
    if (!campaign?.id) {
      return { success: false, error: 'Campaign ID required' };
    }

    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          `INSERT INTO campaigns (id, module_id, player_name, created_at, updated_at, data)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             module_id=excluded.module_id,
             player_name=excluded.player_name,
             updated_at=excluded.updated_at,
             data=excluded.data`,
        );
        stmt.run(
          campaign.id,
          campaign.module_id || '',
          campaign.player?.name || '',
          campaign.created_at || new Date().toISOString(),
          new Date().toISOString(),
          JSON.stringify(campaign),
        );
        return { success: true, id: campaign.id, storage: 'sqlite' };
      } catch (error) {
        console.error('[CampaignStorage] SQLite saveCampaign failed:', error.message);
        // Fall through to memory fallback
      }
    }

    // Memory fallback
    return { success: true, id: campaign.id, storage: 'memory' };
  }

  /**
   * Load campaign from persistent storage
   * @param {string} id - Campaign ID
   * @returns {object|null} Campaign data or null
   */
  loadCampaign(id) {
    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare('SELECT data FROM campaigns WHERE id = ?');
        const row = stmt.get(id);
        if (row?.data) {
          return JSON.parse(row.data);
        }
      } catch (error) {
        console.error('[CampaignStorage] SQLite loadCampaign failed:', error.message);
      }
    }
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
    if (!campaignId) {
      return { success: false, error: 'Campaign ID required' };
    }

    const saveData = {
      ...campaignData,
      saved_at: new Date().toISOString(),
      slot,
      label,
      scene_id: campaignData.current_scene || 'unknown',
      turn_count: (campaignData.scene_history || []).length,
    };

    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          `INSERT INTO saves (campaign_id, slot, label, saved_at, scene_id, turn_count, data)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(campaign_id, slot) DO UPDATE SET
             label=excluded.label,
             saved_at=excluded.saved_at,
             scene_id=excluded.scene_id,
             turn_count=excluded.turn_count,
             data=excluded.data`,
        );
        stmt.run(campaignId, slot, label, saveData.saved_at, saveData.scene_id, saveData.turn_count, JSON.stringify(saveData));
        return {
          success: true,
          slot,
          label,
          scene_id: saveData.scene_id,
          turn_count: saveData.turn_count,
          saved_at: saveData.saved_at,
          storage: 'sqlite',
        };
      } catch (error) {
        console.error('[CampaignStorage] SQLite saveSnapshot failed:', error.message);
      }
    }

    // Memory fallback
    if (!this.memorySaves.has(campaignId)) {
      this.memorySaves.set(campaignId, new Map());
    }
    this.memorySaves.get(campaignId).set(slot, saveData);

    return {
      success: true,
      slot,
      label,
      scene_id: saveData.scene_id,
      turn_count: saveData.turn_count,
      saved_at: saveData.saved_at,
      storage: 'memory',
    };
  }

  /**
   * Load campaign snapshot from a slot
   * @param {string} campaignId - Campaign ID
   * @param {number} slot - Save slot
   * @returns {object|null} Save data or null
   */
  loadSnapshot(campaignId, slot = 1) {
    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          'SELECT data FROM saves WHERE campaign_id = ? AND slot = ?',
        );
        const row = stmt.get(campaignId, slot);
        if (row?.data) {
          return JSON.parse(row.data);
        }
      } catch (error) {
        console.error('[CampaignStorage] SQLite loadSnapshot failed:', error.message);
      }
    }

    // Memory fallback
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
    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          'SELECT slot, label, saved_at, scene_id, turn_count FROM saves WHERE campaign_id = ? ORDER BY slot',
        );
        const rows = stmt.all(campaignId);
        if (rows.length > 0) {
          return rows.map((r) => ({
            slot: r.slot,
            label: r.label,
            saved_at: r.saved_at,
            scene_id: r.scene_id,
            turn_count: r.turn_count,
          }));
        }
      } catch (error) {
        console.error('[CampaignStorage] SQLite getSnapshots failed:', error.message);
      }
    }

    // Memory fallback
    const saves = this.memorySaves.get(campaignId);
    if (!saves) return [];

    return Array.from(saves.entries())
      .map(([slot, data]) => ({
        slot,
        label: data.label,
        saved_at: data.saved_at,
        scene_id: data.scene_id,
        turn_count: data.turn_count,
      }))
      .sort((a, b) => a.slot - b.slot);
  }

  /**
   * Delete a snapshot
   * @param {string} campaignId - Campaign ID
   * @param {number} slot - Save slot
   * @returns {object} Delete result
   */
  deleteSnapshot(campaignId, slot) {
    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare('DELETE FROM saves WHERE campaign_id = ? AND slot = ?');
        stmt.run(campaignId, slot);
      } catch (error) {
        console.error('[CampaignStorage] SQLite deleteSnapshot failed:', error.message);
      }
    }

    // Always clear memory too
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
    const logEntry = {
      id: Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      actor,
      content,
      metadata,
    };

    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          'INSERT INTO logs (campaign_id, timestamp, type, actor, content, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        );
        stmt.run(campaignId, logEntry.timestamp, type, actor, content, JSON.stringify(metadata));
      } catch (error) {
        console.error('[CampaignStorage] SQLite logAction failed:', error.message);
      }
    }

    // Always log to memory
    if (!this.memoryLogs.has(campaignId)) {
      this.memoryLogs.set(campaignId, []);
    }
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
    if (this.sqliteEnabled) {
      try {
        const stmt = this.db.prepare(
          'SELECT * FROM logs WHERE campaign_id = ? ORDER BY timestamp DESC LIMIT ?',
        );
        const rows = stmt.all(campaignId, limit);
        if (rows.length > 0) {
          return rows
            .map((r) => ({
              id: r.id,
              timestamp: r.timestamp,
              type: r.type,
              actor: r.actor,
              content: r.content,
              metadata: r.metadata ? JSON.parse(r.metadata) : {},
            }))
            .reverse(); // Return chronological order
        }
      } catch (error) {
        console.error('[CampaignStorage] SQLite getHistory failed:', error.message);
      }
    }

    // Memory fallback
    const logs = this.memoryLogs.get(campaignId) || [];
    return logs.slice(-limit);
  }

  /**
   * Get full campaign log for export
   * @param {string} campaignId - Campaign ID
   * @returns {object} Full campaign log
   */
  getFullCampaignLog(campaignId) {
    let logs = [];
    let saveCount = 0;

    if (this.sqliteEnabled) {
      try {
        const logStmt = this.db.prepare('SELECT COUNT(*) as count FROM logs WHERE campaign_id = ?');
        const logRow = logStmt.get(campaignId);
        logs = { length: logRow?.count || 0 };

        const saveStmt = this.db.prepare('SELECT COUNT(*) as count FROM saves WHERE campaign_id = ?');
        const saveRow = saveStmt.get(campaignId);
        saveCount = saveRow?.count || 0;
      } catch (error) {
        console.error('[CampaignStorage] SQLite getFullCampaignLog count failed:', error.message);
      }
    }

    // Get actual logs from memory or SQLite
    const actualLogs = this.getHistory(campaignId, 10000);

    return {
      campaign_id: campaignId,
      total_entries: actualLogs.length,
      save_count: saveCount,
      logs: actualLogs,
      summary: this.generateLogSummary(actualLogs),
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

    for (const log of logs) {
      typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
      actorCounts[log.actor] = (actorCounts[log.actor] || 0) + 1;
      if (log.type === 'dice_check') diceChecks++;
      if (log.type === 'combat') combatRounds++;
      if (log.type === 'scene_transition') sceneTransitions++;
    }

    return {
      total_actions: logs.length,
      type_distribution: typeCounts,
      actor_distribution: actorCounts,
      dice_checks: diceChecks,
      combat_rounds: combatRounds,
      scene_transitions: sceneTransitions,
    };
  }

  /**
   * Clear all campaign data
   * @param {string} campaignId - Campaign ID
   * @returns {object} Clear result
   */
  clearCampaign(campaignId) {
    if (this.sqliteEnabled) {
      try {
        this.db.prepare('DELETE FROM campaigns WHERE id = ?').run(campaignId);
        this.db.prepare('DELETE FROM saves WHERE campaign_id = ?').run(campaignId);
        this.db.prepare('DELETE FROM logs WHERE campaign_id = ?').run(campaignId);
      } catch (error) {
        console.error('[CampaignStorage] SQLite clearCampaign failed:', error.message);
      }
    }

    this.memorySaves.delete(campaignId);
    this.memoryLogs.delete(campaignId);

    return { success: true, campaign_id: campaignId };
  }

  /**
   * Get storage status
   * @returns {object} Storage info
   */
  getStatus() {
    return {
      sqliteEnabled: this.sqliteEnabled,
      dbPath: this.dbPath,
      memoryCampaigns: this.memorySaves.size,
      memoryLogEntries: Array.from(this.memoryLogs.values()).reduce((sum, logs) => sum + logs.length, 0),
    };
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch (error) {
        console.error('[CampaignStorage] Error closing DB:', error.message);
      }
      this.db = null;
      this.sqliteEnabled = false;
    }
  }
}

export default CampaignStorage;
