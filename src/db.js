import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DB_DIR, 'benchmarks.db');

const CURRENT_SCHEMA_VERSION = 1;

let _db = null;

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credentials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      encrypted_key TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      tier TEXT NOT NULL DEFAULT 'standard',
      runs_per_case INTEGER NOT NULL DEFAULT 1,
      total_duration_ms INTEGER,
      skills_benchmarked INTEGER NOT NULL DEFAULT 0,
      skills_skipped INTEGER NOT NULL DEFAULT 0,
      skills_errored INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'running',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS skill_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
      skill TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'other',
      baseline_pass_rate REAL NOT NULL,
      with_skill_pass_rate REAL NOT NULL,
      avg_delta REAL NOT NULL,
      total_cases INTEGER NOT NULL,
      runs_per_case INTEGER NOT NULL,
      duration_ms INTEGER,
      tier TEXT NOT NULL,
      score_total REAL NOT NULL,
      score_absolute REAL NOT NULL,
      score_improvement REAL NOT NULL,
      score_consistency REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(run_id, skill)
    );

    CREATE TABLE IF NOT EXISTS test_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_result_id INTEGER NOT NULL REFERENCES skill_results(id) ON DELETE CASCADE,
      case_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      baseline_score REAL NOT NULL,
      baseline_passed INTEGER NOT NULL,
      baseline_failures TEXT,
      baseline_response TEXT,
      with_skill_score REAL NOT NULL,
      with_skill_passed INTEGER NOT NULL,
      with_skill_failures TEXT,
      with_skill_response TEXT,
      delta REAL NOT NULL,
      UNIQUE(skill_result_id, case_id)
    );

    CREATE TABLE IF NOT EXISTS skills_without_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
      skill TEXT NOT NULL,
      UNIQUE(run_id, skill)
    );
  `);

  const row = db.prepare('SELECT version FROM schema_version').get();
  if (!row) {
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(CURRENT_SCHEMA_VERSION);
  }
}

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

// --- Credentials ---

export function saveCredential(provider, encryptedData) {
  const db = getDb();
  db.prepare(`
    INSERT INTO credentials (provider, encrypted_key, iv, auth_tag)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      encrypted_key = excluded.encrypted_key,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      updated_at = datetime('now')
  `).run(provider, encryptedData.encrypted_key, encryptedData.iv, encryptedData.auth_tag);
}

export function getCredential(provider) {
  const db = getDb();
  return db.prepare(
    'SELECT encrypted_key, iv, auth_tag FROM credentials WHERE provider = ?'
  ).get(provider) || null;
}

export function deleteCredential(provider) {
  const db = getDb();
  return db.prepare('DELETE FROM credentials WHERE provider = ?').run(provider);
}

export function listCredentials() {
  const db = getDb();
  return db.prepare('SELECT provider, created_at, updated_at FROM credentials').all();
}

// --- Benchmark Runs ---

export function createRun({ provider, model, tier, runsPerCase }) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO benchmark_runs (provider, model, tier, runs_per_case)
    VALUES (?, ?, ?, ?)
  `).run(provider, model, tier, runsPerCase);
  return info.lastInsertRowid;
}

export function updateRunStatus(runId, updates) {
  const db = getDb();
  db.prepare(`
    UPDATE benchmark_runs SET
      status = ?,
      total_duration_ms = ?,
      skills_benchmarked = ?,
      skills_skipped = ?,
      skills_errored = ?,
      completed_at = CASE WHEN ? IN ('completed', 'failed') THEN datetime('now') ELSE completed_at END
    WHERE id = ?
  `).run(
    updates.status,
    updates.totalDurationMs || null,
    updates.skillsBenchmarked || 0,
    updates.skillsSkipped || 0,
    updates.skillsErrored || 0,
    updates.status,
    runId
  );
}

export function getRun(runId) {
  const db = getDb();
  return db.prepare('SELECT * FROM benchmark_runs WHERE id = ?').get(runId);
}

export function listRuns(limit = 50, offset = 0) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM benchmark_runs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

export function getRunningRun() {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM benchmark_runs WHERE status = 'running' LIMIT 1"
  ).get() || null;
}

// --- Skill Results ---

export function insertSkillResult(runId, data) {
  const db = getDb();
  const info = db.prepare(`
    INSERT INTO skill_results
      (run_id, skill, category, baseline_pass_rate, with_skill_pass_rate, avg_delta,
       total_cases, runs_per_case, duration_ms, tier,
       score_total, score_absolute, score_improvement, score_consistency)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    runId, data.skill, data.category,
    data.baselinePassRate, data.withSkillPassRate, data.avgDelta,
    data.totalCases, data.runsPerCase, data.durationMs, data.tier,
    data.scoreTotal, data.scoreAbsolute, data.scoreImprovement, data.scoreConsistency
  );
  return info.lastInsertRowid;
}

export function getLatestSkillResults() {
  const db = getDb();
  return db.prepare(`
    SELECT sr.* FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY skill ORDER BY created_at DESC) as rn
      FROM skill_results
    ) sr WHERE sr.rn = 1
    ORDER BY sr.score_total DESC
  `).all();
}

export function getSkillResultsByRun(runId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM skill_results WHERE run_id = ? ORDER BY skill'
  ).all(runId);
}

export function getSkillResultWithCases(skillResultId) {
  const db = getDb();
  const result = db.prepare('SELECT * FROM skill_results WHERE id = ?').get(skillResultId);
  if (!result) return null;
  result.cases = db.prepare(
    'SELECT * FROM test_cases WHERE skill_result_id = ? ORDER BY case_id'
  ).all(skillResultId);
  return result;
}

export function getLatestSkillResult(skillName) {
  const db = getDb();
  const result = db.prepare(`
    SELECT * FROM skill_results WHERE skill = ? ORDER BY created_at DESC LIMIT 1
  `).get(skillName);
  if (!result) return null;
  result.cases = db.prepare(
    'SELECT * FROM test_cases WHERE skill_result_id = ? ORDER BY case_id'
  ).all(result.id);
  return result;
}

// --- Test Cases ---

export function insertTestCases(skillResultId, cases) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO test_cases
      (skill_result_id, case_id, prompt, baseline_score, baseline_passed,
       baseline_failures, baseline_response, with_skill_score, with_skill_passed,
       with_skill_failures, with_skill_response, delta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((items) => {
    for (const c of items) {
      stmt.run(
        skillResultId, c.caseId, c.prompt,
        c.baselineScore, c.baselinePassed ? 1 : 0,
        JSON.stringify(c.baselineFailures || []), c.baselineResponse || null,
        c.withSkillScore, c.withSkillPassed ? 1 : 0,
        JSON.stringify(c.withSkillFailures || []), c.withSkillResponse || null,
        c.delta
      );
    }
  });

  insertAll(cases);
}

// --- Skills Without Tests ---

export function insertSkillsWithoutTests(runId, skills) {
  const db = getDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO skills_without_tests (run_id, skill) VALUES (?, ?)');
  const insertAll = db.transaction((items) => {
    for (const skill of items) {
      stmt.run(runId, skill);
    }
  });
  insertAll(skills);
}

export function getSkillsWithoutTests(runId) {
  const db = getDb();
  if (runId) {
    return db.prepare('SELECT skill FROM skills_without_tests WHERE run_id = ?').all(runId).map(r => r.skill);
  }
  // Get from most recent run
  const latest = db.prepare(
    "SELECT id FROM benchmark_runs ORDER BY created_at DESC LIMIT 1"
  ).get();
  if (!latest) return [];
  return db.prepare('SELECT skill FROM skills_without_tests WHERE run_id = ?').all(latest.id).map(r => r.skill);
}
