import Database from "better-sqlite3";

const db = new Database("signalx.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS learning_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT,
    score INTEGER,
    reason TEXT,
    entryPrice REAL,
    result TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

export default db;