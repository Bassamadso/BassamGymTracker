/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import type { SqlDb, SqlExecutor } from '../src/storage';

/** Wraps a database so any statement matching `pattern` fails ("disk full"). */
export const failingOn = (db: SqlDb, pattern: RegExp): SqlDb => {
  const guard =
    (exec: SqlExecutor['execute']): SqlExecutor['execute'] =>
    (sql, params) =>
      pattern.test(sql)
        ? Promise.reject(new Error('disk full'))
        : exec(sql, params);
  return {
    execute: guard(db.execute),
    transaction: fn => db.transaction(tx => fn({ execute: guard(tx.execute) })),
  };
};

/**
 * A real, in-memory SQLite database (Node's built-in engine) that looks like
 * the `op-sqlite` one, so tests exercise the actual schema and SQL.
 */
export function openMemoryDb(): SqlDb & { statements: string[] } {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const statements: string[] = [];

  const exec: SqlExecutor['execute'] = async (sql, params = []) => {
    statements.push(sql);
    const rows = raw.prepare(sql).all(...params) as Record<string, unknown>[];
    return { rows: rows.map(r => ({ ...r })) };
  };

  return {
    statements,
    execute: exec,
    async transaction(fn) {
      raw.exec('BEGIN');
      try {
        await fn({ execute: exec });
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}
