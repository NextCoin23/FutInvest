import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'data.json')

const defaultData = {
  users: [],
  catalog: [
    { id: 'c1', name: 'Alpha Scout', price: 25, dailyRate: 4.0, description: 'Robo de entradas conservadoras' },
    { id: 'c2', name: 'Value Hunter', price: 50, dailyRate: 5.5, description: 'Procura valor em mercados fechados' },
    { id: 'c3', name: 'Pro Pulse', price: 75, dailyRate: 7.0, description: 'Operacoes de media frequencia' },
    { id: 'c4', name: 'Max Edge', price: 100, dailyRate: 9.0, description: 'Maior exposicao, maior potencial' },
  ],
  owned_bots: [],
  match_history: [],
  transactions: [],
  withdraw_requests: [],
  deposit_requests: [],
}

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
      if (!raw.catalog) return structuredClone(defaultData)
      return raw
    }
  } catch (e) {}
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
