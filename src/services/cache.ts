import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { AuditIssue } from "./openai.js";

interface CacheDbRow {
  diff_hash: string;
  file_path: string;
  status: string;
  issues: string;
  created_at: string;
}

export interface CacheEntry {
  diffHash: string;
  filePath: string;
  status: "pass" | "fail";
  issues: AuditIssue[];
}

const CACHE_DIR = path.join(os.homedir(), ".aegis");
const CACHE_FILE = path.join(CACHE_DIR, "cache.db");

// Ensure cache directory exists
fs.mkdirSync(CACHE_DIR, { recursive: true });

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(CACHE_FILE);
    db.pragma("journal_mode = WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS diff_cache (
        diff_hash TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        status TEXT NOT NULL,
        issues TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  return db;
}

/**
 * Retrieves a cached audit result by diff hash.
 */
export function getCachedResult(hash: string): CacheEntry | null {
  const dbInstance = getDb();
  const row = dbInstance
    .prepare("SELECT * FROM diff_cache WHERE diff_hash = ?")
    .get(hash) as CacheDbRow | undefined;

  if (!row) {
    return null;
  }

  return {
    diffHash: row.diff_hash,
    filePath: row.file_path,
    status: row.status as "pass" | "fail",
    issues: JSON.parse(row.issues) as AuditIssue[],
  };
}

/**
 * Saves or updates an audit result in the cache database.
 */
export function saveCacheResult(
  hash: string,
  filePath: string,
  status: "pass" | "fail",
  issues: AuditIssue[],
): void {
  const dbInstance = getDb();
  dbInstance
    .prepare(
      `
      INSERT INTO diff_cache (diff_hash, file_path, status, issues)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(diff_hash) DO UPDATE SET
        status = excluded.status,
        issues = excluded.issues,
        created_at = CURRENT_TIMESTAMP
    `,
    )
    .run(hash, filePath, status, JSON.stringify(issues));
}
