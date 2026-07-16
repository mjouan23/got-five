import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { env } from '../config/env.js';

const sqlitePath = path.resolve(process.cwd(), env.SQLITE_PATH);
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

export const db = new Database(sqlitePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaSql = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    host_player_id TEXT,
    host_token TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    reconnect_token TEXT NOT NULL,
    role TEXT NOT NULL,
    connected INTEGER NOT NULL DEFAULT 0,
    socket_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
  CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
`;

export const initDatabase = () => {
  db.exec(`
    ${schemaSql}
  `);
};

initDatabase();
