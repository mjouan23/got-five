import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { env } from '../config/env.js';

const sqlitePath = path.resolve(process.cwd(), env.SQLITE_PATH);
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });

const sqlWasmPath = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');
const SQL = await initSqlJs({
  locateFile: () => sqlWasmPath
});

const initialBuffer = fs.existsSync(sqlitePath) ? fs.readFileSync(sqlitePath) : undefined;
const sqliteDb = initialBuffer ? new SQL.Database(initialBuffer) : new SQL.Database();

const persistDatabase = () => {
  const data = sqliteDb.export();
  fs.writeFileSync(sqlitePath, Buffer.from(data));
};

const normalizeParams = (args) => {
  if (args.length === 1) {
    const value = args[0];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
    return [value];
  }
  return args;
};

const toStatement = (sql) => {
  const statement = sqliteDb.prepare(sql);

  return {
    run(...args) {
      statement.bind(normalizeParams(args));
      while (statement.step()) {
        // Consume potential result rows for compatibility with write statements.
      }
      statement.reset();

      const changes = sqliteDb.getRowsModified();
      persistDatabase();
      return { changes };
    },
    get(...args) {
      statement.bind(normalizeParams(args));
      const hasRow = statement.step();
      const row = hasRow ? statement.getAsObject() : undefined;
      statement.reset();
      return row;
    },
    all(...args) {
      statement.bind(normalizeParams(args));
      const rows = [];
      while (statement.step()) {
        rows.push(statement.getAsObject());
      }
      statement.reset();
      return rows;
    }
  };
};

export const db = {
  exec(sql) {
    sqliteDb.exec(sql);
    persistDatabase();
  },
  prepare(sql) {
    return toStatement(sql);
  },
  pragma() {
    // No-op: sql.js runs in-process and does not expose SQLite pragma effects like file-backed drivers.
  }
};

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
