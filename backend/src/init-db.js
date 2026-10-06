import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, '..', 'futinvest.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id TEXT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    balance REAL DEFAULT 0,
    total_profit REAL DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS bots (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    league TEXT NOT NULL,
    stake REAL DEFAULT 10,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY,
    bot_id TEXT,
    user_id TEXT,
    match_name TEXT,
    league TEXT,
    tip TEXT,
    odd REAL,
    stake REAL,
    status TEXT DEFAULT 'scanning',
    profit REAL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000),
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS match_history (
    id TEXT PRIMARY KEY,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    score TEXT,
    league TEXT,
    date TEXT,
    tip TEXT,
    odd REAL,
    result TEXT,
    profit REAL,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS withdraw_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    network TEXT NOT NULL,
    address TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS deposit_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    coin TEXT NOT NULL,
    amount REAL,
    tx_hash TEXT,
    status TEXT DEFAULT 'pending',
    created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
  );
`)

// Seed bots
const bots = [
  ['b1', 'Alpha Over', 'Premier League', 15],
  ['b2', 'SerieA Value', 'Serie A', 25],
  ['b3', 'LaLiga Pro', 'La Liga', 20],
  ['b4', 'Bundes Scout', 'Bundesliga', 10],
]
const insertBot = db.prepare('INSERT OR IGNORE INTO bots (id, name, league, stake) VALUES (?, ?, ?, ?)')
bots.forEach(b => insertBot.run(...b))

// Seed match history (jogos realistas recentes)
const matches = [
  ['m1', 'Manchester City', 'Arsenal', '2-1', 'Premier League', '2026-10-05', 'Over 2.5', 1.78, 'win', 11.70],
  ['m2', 'Real Madrid', 'Atlético Madrid', '1-1', 'La Liga', '2026-10-05', 'BTTS Sim', 1.65, 'win', 9.75],
  ['m3', 'Bayern München', 'Borussia Dortmund', '3-0', 'Bundesliga', '2026-10-04', 'Bayern -1.5', 2.05, 'win', 15.75],
  ['m4', 'Juventus', 'Napoli', '0-0', 'Serie A', '2026-10-04', 'Over 2.5', 1.90, 'loss', -20],
  ['m5', 'PSG', 'Marseille', '2-2', 'Ligue 1', '2026-10-03', 'BTTS Sim', 1.55, 'win', 8.25],
  ['m6', 'Liverpool', 'Chelsea', '1-0', 'Premier League', '2026-10-03', 'Ambas marcam', 1.70, 'loss', -15],
  ['m7', 'Benfica', 'FC Porto', '2-1', 'Liga Portugal', '2026-10-02', 'Benfica ou empate', 1.45, 'win', 6.75],
  ['m8', 'Ajax', 'PSV', '1-3', 'Eredivisie', '2026-10-01', 'Over 2.5', 1.60, 'win', 9.00],
  ['m9', 'Barcelona', 'Sevilla', '3-1', 'La Liga', '2026-09-30', 'Over 2.5', 1.55, 'win', 8.25],
  ['m10', 'Inter', 'AC Milan', '1-1', 'Serie A', '2026-09-29', 'Under 2.5', 1.95, 'win', 9.50],
]
const insertMatch = db.prepare(`
  INSERT OR IGNORE INTO match_history (id, home, away, score, league, date, tip, odd, result, profit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
matches.forEach(m => insertMatch.run(...m))

console.log('FutInvest DB initialized → futinvest.db')
db.close()
