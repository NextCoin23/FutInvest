import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'data.json')

const defaultData = {
  users: [],
  bots: [
    { id: 'b1', name: 'Alpha Over', league: 'Premier League', stake: 15, active: 1 },
    { id: 'b2', name: 'SerieA Value', league: 'Serie A', stake: 25, active: 1 },
    { id: 'b3', name: 'LaLiga Pro', league: 'La Liga', stake: 20, active: 1 },
    { id: 'b4', name: 'Bundes Scout', league: 'Bundesliga', stake: 10, active: 1 },
  ],
  match_history: [
    { id: 'm1', home: 'Manchester City', away: 'Arsenal', score: '2-1', league: 'Premier League', date: '2026-10-05', tip: 'Over 2.5', odd: 1.78, result: 'win', profit: 11.70 },
    { id: 'm2', home: 'Real Madrid', away: 'Atlético Madrid', score: '1-1', league: 'La Liga', date: '2026-10-05', tip: 'BTTS Sim', odd: 1.65, result: 'win', profit: 9.75 },
    { id: 'm3', home: 'Bayern München', away: 'Borussia Dortmund', score: '3-0', league: 'Bundesliga', date: '2026-10-04', tip: 'Bayern -1.5', odd: 2.05, result: 'win', profit: 15.75 },
    { id: 'm4', home: 'Juventus', away: 'Napoli', score: '0-0', league: 'Serie A', date: '2026-10-04', tip: 'Over 2.5', odd: 1.90, result: 'loss', profit: -20 },
    { id: 'm5', home: 'PSG', away: 'Marseille', score: '2-2', league: 'Ligue 1', date: '2026-10-03', tip: 'BTTS Sim', odd: 1.55, result: 'win', profit: 8.25 },
    { id: 'm6', home: 'Liverpool', away: 'Chelsea', score: '1-0', league: 'Premier League', date: '2026-10-03', tip: 'Ambas marcam', odd: 1.70, result: 'loss', profit: -15 },
    { id: 'm7', home: 'Benfica', away: 'FC Porto', score: '2-1', league: 'Liga Portugal', date: '2026-10-02', tip: 'Benfica ou empate', odd: 1.45, result: 'win', profit: 6.75 },
    { id: 'm8', home: 'Ajax', away: 'PSV', score: '1-3', league: 'Eredivisie', date: '2026-10-01', tip: 'Over 2.5', odd: 1.60, result: 'win', profit: 9.00 },
  ],
  transactions: [],
  withdraw_requests: [],
  deposit_requests: [],
}

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    }
  } catch {}
  save(defaultData)
  return structuredClone(defaultData)
}

function save(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('DB save error', e.message)
  }
}

let data = load()

export const db = {
  get() { return data },
  save() { save(data) },
  reload() { data = load(); return data },
}
