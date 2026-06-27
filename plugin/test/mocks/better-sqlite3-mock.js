/**
 * Mock better-sqlite3 for campaign.js coverage testing
 * Implements in-memory tables matching campaign.js schema
 */

let _mockThrowOn = null;

export function setMockThrowOn(op) {
  _mockThrowOn = op;
}

export function clearMockThrow() {
  _mockThrowOn = null;
}

function _checkThrow(op) {
  if (_mockThrowOn === op) {
    throw new Error(`Mock ${op} error`);
  }
}

class MockStatement {
  constructor(sql, db) {
    this.sql = sql.trim();
    this.db = db;
    this._parsed = this._parse(this.sql);
    _checkThrow('prepare');
  }

  _parse(sql) {
    // Very simple SQL parser for our known queries
    const upper = sql.toUpperCase();

    if (upper.startsWith('CREATE TABLE')) {
      return { type: 'CREATE_TABLE', sql };
    }
    if (upper.startsWith('CREATE INDEX')) {
      return { type: 'CREATE_INDEX', sql };
    }
    if (upper.startsWith('INSERT')) {
      const tableMatch = sql.match(/INTO\s+(\w+)/i);
      return { type: 'INSERT', table: tableMatch ? tableMatch[1] : null };
    }
    if (upper.startsWith('UPDATE')) {
      const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
      return { type: 'UPDATE', table: tableMatch ? tableMatch[1] : null };
    }
    if (upper.startsWith('DELETE')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      if (!tableMatch) {
        // DELETE FROM campaigns WHERE id = ?
        const altMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
        return { type: 'DELETE', table: altMatch ? altMatch[1] : null };
      }
      return { type: 'DELETE', table: tableMatch[1] };
    }
    if (upper.startsWith('SELECT')) {
      const tableMatch = sql.match(/FROM\s+(\w+)/i);
      const countMatch = sql.match(/COUNT\(\*\)/i);
      return { type: 'SELECT', table: tableMatch ? tableMatch[1] : null, count: !!countMatch };
    }
    return { type: 'UNKNOWN', sql };
  }

  run(...params) {
    _checkThrow('run');
    const p = this._parsed;
    if (p.type === 'CREATE_TABLE' || p.type === 'CREATE_INDEX') {
      this.db.execRaw(this.sql);
      return { changes: 0, lastInsertRowid: 0 };
    }
    // INSERT ... ON CONFLICT must be checked before plain INSERT
    if (p.type === 'INSERT' && this.sql.toUpperCase().includes('ON CONFLICT')) {
      return this.db._insertOrUpdate(this.sql, params);
    }
    if (p.type === 'INSERT') {
      return this.db._insert(p.table, this.sql, params);
    }
    if (p.type === 'UPDATE') {
      return this.db._update(p.table, this.sql, params);
    }
    if (p.type === 'DELETE') {
      return this.db._delete(p.table, this.sql, params);
    }
    return { changes: 0, lastInsertRowid: 0 };
  }

  get(...params) {
    _checkThrow('get');
    const p = this._parsed;
    if (p.type === 'SELECT' && p.count) {
      return this.db._count(p.table, params);
    }
    if (p.type === 'SELECT') {
      return this.db._selectOne(p.table, this.sql, params);
    }
    return null;
  }

  all(...params) {
    _checkThrow('all');
    const p = this._parsed;
    if (p.type === 'SELECT') {
      return this.db._selectAll(p.table, this.sql, params);
    }
    return [];
  }
}

export default class MockDatabase {
  constructor(path) {
    _checkThrow('new');
    this.path = path;
    this.tables = {};
    this._rowIds = {};
  }

  pragma() {
    _checkThrow('pragma');
    return {};
  }

  exec(sql) {
    this.execRaw(sql);
  }

  execRaw(sql) {
    _checkThrow('exec');
    const upper = sql.toUpperCase().trim();
    if (upper.startsWith('CREATE TABLE IF NOT EXISTS')) {
      const match = sql.match(/CREATE TABLE IF NOT EXISTS\s+(\w+)/i);
      if (match) {
        const table = match[1];
        if (!this.tables[table]) {
          this.tables[table] = [];
          this._rowIds[table] = 1;
        }
      }
    }
    if (upper.startsWith('CREATE INDEX IF NOT EXISTS')) {
      // No-op for mock
    }
  }

  prepare(sql) {
    return new MockStatement(sql, this);
  }

  close() {
    _checkThrow('close');
  }

  // --- Internal data operations ---

  _insertOrUpdate(sql, params) {
    // INSERT INTO campaigns (id, module_id, player_name, created_at, updated_at, data)
    // VALUES (?, ?, ?, ?, ?, ?)
    // ON CONFLICT(id) DO UPDATE SET ...
    if (sql.includes('campaigns')) {
      const id = params[0];
      const existing = this.tables.campaigns?.find((r) => r.id === id);
      if (existing) {
        existing.module_id = params[1];
        existing.player_name = params[2];
        existing.updated_at = params[4];
        existing.data = params[5];
        return { changes: 1, lastInsertRowid: 0 };
      }
      this.tables.campaigns = this.tables.campaigns || [];
      this.tables.campaigns.push({
        id,
        module_id: params[1],
        player_name: params[2],
        created_at: params[3],
        updated_at: params[4],
        data: params[5],
      });
      return { changes: 1, lastInsertRowid: 0 };
    }
    if (sql.includes('saves')) {
      const campaign_id = params[0];
      const slot = params[1];
      this.tables.saves = this.tables.saves || [];
      const idx = this.tables.saves.findIndex(
        (r) => r.campaign_id === campaign_id && r.slot === slot,
      );
      const row = {
        campaign_id,
        slot,
        label: params[2],
        saved_at: params[3],
        scene_id: params[4],
        turn_count: params[5],
        data: params[6],
      };
      if (idx >= 0) {
        this.tables.saves[idx] = row;
      } else {
        this.tables.saves.push(row);
      }
      return { changes: 1, lastInsertRowid: 0 };
    }
    return { changes: 0, lastInsertRowid: 0 };
  }

  _insert(table, sql, params) {
    if (table === 'logs') {
      this.tables.logs = this.tables.logs || [];
      const id = this._rowIds.logs || 1;
      this._rowIds.logs = id + 1;
      this.tables.logs.push({
        id,
        campaign_id: params[0],
        timestamp: params[1],
        type: params[2],
        actor: params[3],
        content: params[4],
        metadata: params[5],
      });
      return { changes: 1, lastInsertRowid: id };
    }
    return { changes: 0, lastInsertRowid: 0 };
  }

  _update(_table, _sql, _params) {
    return { changes: 0, lastInsertRowid: 0 };
  }

  _delete(table, sql, params) {
    if (!this.tables[table]) return { changes: 0, lastInsertRowid: 0 };
    let count = 0;
    if (table === 'campaigns') {
      // DELETE FROM campaigns WHERE id = ?
      const id = params[0];
      const before = this.tables.campaigns.length;
      this.tables.campaigns = this.tables.campaigns.filter((r) => r.id !== id);
      count = before - this.tables.campaigns.length;
    } else if (table === 'saves') {
      // DELETE FROM saves WHERE campaign_id = ? AND slot = ?
      const campaign_id = params[0];
      const slot = params[1];
      const before = this.tables.saves.length;
      if (slot !== undefined) {
        this.tables.saves = this.tables.saves.filter(
          (r) => !(r.campaign_id === campaign_id && r.slot === slot),
        );
      } else {
        this.tables.saves = this.tables.saves.filter((r) => r.campaign_id !== campaign_id);
      }
      count = before - this.tables.saves.length;
    } else if (table === 'logs') {
      // DELETE FROM logs WHERE campaign_id = ?
      const campaign_id = params[0];
      const before = this.tables.logs.length;
      this.tables.logs = this.tables.logs.filter((r) => r.campaign_id !== campaign_id);
      count = before - this.tables.logs.length;
    }
    return { changes: count, lastInsertRowid: 0 };
  }

  _selectOne(table, sql, params) {
    if (!this.tables[table]) return null;
    if (table === 'campaigns') {
      const id = params[0];
      return this.tables.campaigns.find((r) => r.id === id) || null;
    }
    if (table === 'saves') {
      const campaign_id = params[0];
      const slot = params[1];
      return (
        this.tables.saves.find((r) => r.campaign_id === campaign_id && r.slot === slot) || null
      );
    }
    return null;
  }

  _selectAll(table, sql, params) {
    if (!this.tables[table]) return [];
    if (table === 'logs') {
      const campaign_id = params[0];
      const limit = params[1] || 100;
      const filtered = this.tables.logs.filter((r) => r.campaign_id === campaign_id);
      // ORDER BY timestamp DESC, then by id DESC for stable ordering
      const sorted = [...filtered].sort((a, b) => {
        const dt = new Date(b.timestamp) - new Date(a.timestamp);
        if (dt !== 0) return dt;
        return b.id - a.id;
      });
      return sorted.slice(0, limit);
    }
    if (table === 'saves') {
      const campaign_id = params[0];
      return this.tables.saves
        .filter((r) => r.campaign_id === campaign_id)
        .sort((a, b) => a.slot - b.slot);
    }
    return [];
  }

  _count(table, params) {
    if (!this.tables[table]) return { count: 0 };
    if (table === 'saves') {
      const campaign_id = params[0];
      return { count: this.tables.saves.filter((r) => r.campaign_id === campaign_id).length };
    }
    return { count: 0 };
  }
}
