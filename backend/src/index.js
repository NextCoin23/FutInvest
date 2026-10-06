import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(__dirname, '..', 'futinvest.db'))

const app = express()
const PORT = process.env.PORT || 3001
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'muda-isto-para-um-segredo-forte'

const DEPOSIT_ADDRESSES = {
  BTC: '175DBVQbmokQFmbP1xXvChpmQxwCLeiDim',
  ETH: '0x253b6EA9a69D60400C5170022362eebd442bEdF9',
  USDC: '0x253b6EA9a69D60400C5170022362eebd442bEdF9',
}

const BOT_STATUSES = ['idle', 'scanning', 'entry_found', 'in_trade', 'win', 'loss']
const MATCH_POOL = [
  'Arsenal vs Tottenham', 'Man City vs Liverpool', 'Real Madrid vs Valencia',
  'Barcelona vs Atlético', 'Bayern vs Leverkusen', 'Dortmund vs Leipzig',
  'Inter vs Roma', 'Juventus vs Napoli', 'PSG vs Lyon', 'Benfica vs Sporting',
]

app.use(cors())
app.use(express.json())

function getTgUser(req) {
  const initData = req.headers['x-telegram-init-data']
  if (initData) {
    try {
      const params = new URLSearchParams(initData)
      const userStr = params.get('user')
      if (userStr) return JSON.parse(userStr)
    } catch {}
  }
  const devId = req.headers['x-dev-telegram-id']
  if (devId) return { id: devId, first_name: 'Dev', username: 'dev' }
  return null
}

function getOrCreateUser(tg) {
  let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(String(tg.id))
  if (user) return user
  const id = uuid()
  db.prepare('INSERT INTO users (id, telegram_id, username, first_name, balance) VALUES (?, ?, ?, ?, ?)')
    .run(id, String(tg.id), tg.username || null, tg.first_name || null, 50) // bónus demo $50
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id)
}

function auth(req, res, next) {
  const tg = getTgUser(req)
  if (!tg) return res.status(401).json({ error: 'Unauthorized' })
  req.user = getOrCreateUser(tg)
  next()
}

function admin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' })
  next()
}

// In-memory live bot states (simulação de operações)
const liveBots = {}
function ensureLiveBots() {
  const bots = db.prepare('SELECT * FROM bots WHERE active = 1').all()
  const activeIds = new Set(bots.map(b => b.id))
  // remover inativos do live
  for (const id of Object.keys(liveBots)) {
    if (!activeIds.has(id)) delete liveBots[id]
  }
  for (const b of bots) {
    if (!liveBots[b.id]) {
      liveBots[b.id] = {
        ...b,
        status: 'scanning',
        currentMatch: null,
        odd: 0,
        profit: null,
        lastUpdate: Date.now(),
      }
    }
  }
}
ensureLiveBots()

// Ciclo automático dos bots
setInterval(() => {
  ensureLiveBots()
  for (const id of Object.keys(liveBots)) {
    if (Math.random() > 0.5) continue
    const bot = liveBots[id]
    const idx = BOT_STATUSES.indexOf(bot.status)
    const next = BOT_STATUSES[(idx + 1) % BOT_STATUSES.length]
    bot.status = next
    bot.lastUpdate = Date.now()
    if (next === 'entry_found' || next === 'in_trade') {
      bot.currentMatch = MATCH_POOL[Math.floor(Math.random() * MATCH_POOL.length)]
      bot.odd = +(1.45 + Math.random() * 1.1).toFixed(2)
    }
    if (next === 'win') {
      bot.profit = +(bot.stake * (bot.odd - 1)).toFixed(2)
    }
    if (next === 'loss') {
      bot.profit = -bot.stake
    }
    if (next === 'idle' || next === 'scanning') {
      bot.currentMatch = null
      bot.profit = null
      bot.odd = 0
    }
  }
}, 5000)

// ========== ROUTES ==========
app.get('/api/health', (_, res) => res.json({ ok: true }))

app.get('/api/deposit-addresses', (_, res) => res.json(DEPOSIT_ADDRESSES))

app.get('/api/me', auth, (req, res) => {
  const txs = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').all(req.user.id)
  res.json({
    id: req.user.id,
    firstName: req.user.first_name,
    username: req.user.username,
    balance: req.user.balance,
    totalProfit: req.user.total_profit,
    transactions: txs,
  })
})

app.get('/api/bots/live', auth, (_, res) => {
  ensureLiveBots()
  res.json(Object.values(liveBots))
})

app.get('/api/history', auth, (_, res) => {
  const rows = db.prepare('SELECT * FROM match_history ORDER BY date DESC, created_at DESC LIMIT 50').all()
  res.json(rows)
})

app.post('/api/deposit-request', auth, (req, res) => {
  const { coin, amount, txHash } = req.body
  if (!['BTC', 'ETH', 'USDC'].includes(coin)) return res.status(400).json({ error: 'Invalid coin' })
  const id = uuid()
  db.prepare('INSERT INTO deposit_requests (id, user_id, coin, amount, tx_hash) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.user.id, coin, amount || null, txHash || null)
  res.json({ ok: true, id })
})

app.post('/api/withdraw', auth, (req, res) => {
  const { amount, network, address } = req.body
  const amt = parseFloat(amount)
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' })
  if (!address || address.length < 15) return res.status(400).json({ error: 'Invalid address' })
  if (req.user.balance < amt) return res.status(400).json({ error: 'Insufficient balance' })

  const id = uuid()
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amt, req.user.id)
    db.prepare('INSERT INTO withdraw_requests (id, user_id, amount, network, address) VALUES (?, ?, ?, ?, ?)')
      .run(id, req.user.id, amt, network || 'USDC', address)
    db.prepare('INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), req.user.id, 'withdraw', -amt, `Saque ${network} → ${address.slice(0, 8)}...`)
  })
  tx()
  res.json({ ok: true, id })
})

// Admin
app.get('/api/admin/pending-deposits', admin, (_, res) => {
  res.json(db.prepare(`
    SELECT d.*, u.telegram_id, u.username, u.first_name FROM deposit_requests d
    JOIN users u ON u.id = d.user_id WHERE d.status = 'pending' ORDER BY d.created_at
  `).all())
})

app.get('/api/admin/pending-withdrawals', admin, (_, res) => {
  res.json(db.prepare(`
    SELECT w.*, u.telegram_id, u.username, u.first_name FROM withdraw_requests w
    JOIN users u ON u.id = w.user_id WHERE w.status = 'pending' ORDER BY w.created_at
  `).all())
})

app.post('/api/admin/credit-deposit', admin, (req, res) => {
  const { depositId, amount } = req.body
  const dep = db.prepare('SELECT * FROM deposit_requests WHERE id = ?').get(depositId)
  if (!dep || dep.status !== 'pending') return res.status(400).json({ error: 'Invalid deposit' })
  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, dep.user_id)
    db.prepare("UPDATE deposit_requests SET status = 'credited', amount = ? WHERE id = ?").run(amount, depositId)
    db.prepare('INSERT INTO transactions (id, user_id, type, amount, description) VALUES (?, ?, ?, ?, ?)')
      .run(uuid(), dep.user_id, 'deposit', amount, `Depósito ${dep.coin} confirmado`)
  })
  tx()
  res.json({ ok: true })
})

app.post('/api/admin/process-withdraw', admin, (req, res) => {
  const { withdrawId, action } = req.body
  const w = db.prepare('SELECT * FROM withdraw_requests WHERE id = ?').get(withdrawId)
  if (!w || w.status !== 'pending') return res.status(400).json({ error: 'Invalid' })
  if (action === 'complete') {
    db.prepare("UPDATE withdraw_requests SET status = 'completed' WHERE id = ?").run(withdrawId)
  } else {
    db.transaction(() => {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(w.amount, w.user_id)
      db.prepare("UPDATE withdraw_requests SET status = 'rejected' WHERE id = ?").run(withdrawId)
    })()
  }
  res.json({ ok: true })
})


app.get('/api/admin/users', admin, (_, res) => {
  const users = db.prepare(`
    SELECT id, telegram_id, username, first_name, balance, total_profit, created_at
    FROM users ORDER BY created_at DESC LIMIT 200
  `).all()
  res.json(users)
})

app.get('/api/admin/stats', admin, (_, res) => {
  const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c
  const deps = db.prepare("SELECT COUNT(*) as c FROM deposit_requests WHERE status = 'pending'").get().c
  const wds = db.prepare("SELECT COUNT(*) as c FROM withdraw_requests WHERE status = 'pending'").get().c
  res.json({ users, pendingDeposits: deps, pendingWithdrawals: wds })
})


// ========== ADMIN: ROBÔS CRUD ==========
app.get('/api/admin/bots', admin, (_, res) => {
  const bots = db.prepare('SELECT * FROM bots ORDER BY name').all()
  const live = Object.values(liveBots)
  const merged = bots.map(b => {
    const l = liveBots[b.id]
    return {
      ...b,
      status: l?.status || 'idle',
      currentMatch: l?.currentMatch || null,
      odd: l?.odd || 0,
      profit: l?.profit ?? null,
      lastUpdate: l?.lastUpdate || null,
    }
  })
  res.json(merged)
})

app.post('/api/admin/bots', admin, (req, res) => {
  const { name, league, stake } = req.body
  if (!name || !league) return res.status(400).json({ error: 'name e league obrigatórios' })
  const id = 'b' + uuid().replace(/-/g, '').slice(0, 10)
  const s = parseFloat(stake) || 10
  db.prepare('INSERT INTO bots (id, name, league, stake, active) VALUES (?, ?, ?, ?, 1)')
    .run(id, name.trim(), league.trim(), s)
  // registar no live state
  liveBots[id] = {
    id, name: name.trim(), league: league.trim(), stake: s, active: 1,
    status: 'scanning', currentMatch: null, odd: 0, profit: null, lastUpdate: Date.now(),
  }
  res.json({ ok: true, id })
})

app.put('/api/admin/bots/:id', admin, (req, res) => {
  const { id } = req.params
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id)
  if (!bot) return res.status(404).json({ error: 'Robô não encontrado' })
  const name = req.body.name ?? bot.name
  const league = req.body.league ?? bot.league
  const stake = req.body.stake != null ? parseFloat(req.body.stake) : bot.stake
  const active = req.body.active != null ? (req.body.active ? 1 : 0) : bot.active
  db.prepare('UPDATE bots SET name = ?, league = ?, stake = ?, active = ? WHERE id = ?')
    .run(name, league, stake, active, id)
  if (liveBots[id]) {
    liveBots[id].name = name
    liveBots[id].league = league
    liveBots[id].stake = stake
    liveBots[id].active = active
    if (!active) {
      liveBots[id].status = 'idle'
      liveBots[id].currentMatch = null
    }
  } else if (active) {
    liveBots[id] = {
      id, name, league, stake, active,
      status: 'scanning', currentMatch: null, odd: 0, profit: null, lastUpdate: Date.now(),
    }
  }
  res.json({ ok: true })
})

app.delete('/api/admin/bots/:id', admin, (req, res) => {
  const { id } = req.params
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(id)
  if (!bot) return res.status(404).json({ error: 'Robô não encontrado' })
  db.prepare('DELETE FROM bots WHERE id = ?').run(id)
  delete liveBots[id]
  res.json({ ok: true })
})

app.listen(PORT, () => {
  console.log(`FutInvest API on http://localhost:${PORT}`)
  console.log(`Admin secret: ${ADMIN_SECRET}`)
})
