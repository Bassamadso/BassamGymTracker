import { open } from '@op-engineering/op-sqlite';
import { createDataStore, DataStore } from './storage';

const DB_NAME = 'gymtracker.db';

/** Opens (creating if needed) the on-device database that backs the app. */
export async function openDefaultDataStore(): Promise<DataStore> {
  const db = open({ name: DB_NAME });
  // Off by default in SQLite; keeps the table references honest
  await db.execute('PRAGMA foreign_keys = ON');
  return createDataStore(db);
}
