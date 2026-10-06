const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const tg = (window as any).Telegram?.WebApp
    if (tg?.initData) h['x-telegram-init-data'] = tg.initData
  } catch {}
  if (!h['x-telegram-init-data']) {
    h['x-dev-telegram-id'] = localStorage.getItem('dev_tg_id') || 'dev-user-1'
  }
  return h
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(), ...(opts.headers || {}) } })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

export interface ApiUser {
  id: string
  firstName: string | null
  username: string | null
  balance: number
  totalProfit: number
  transactions: Array<{ id: string; type: string; amount: number; description: string; created_at: number }>
}

export interface LiveBot {
  id: string
  name: string
  league: string
  stake: number
  status: string
  currentMatch: string | null
  odd: number
  profit: number | null
  lastUpdate: number
}

export interface MatchHistory {
  id: string
  home: string
  away: string
  score: string
  league: string
  date: string
  tip: string
  odd: number
  result: string
  profit: number
}

export const api = {
  getMe: () => req<ApiUser>('/api/me'),
  getLiveBots: () => req<LiveBot[]>('/api/bots/live'),
  getHistory: () => req<MatchHistory[]>('/api/history'),
  getDepositAddresses: () => req<Record<string, string>>('/api/deposit-addresses'),
  depositRequest: (coin: string, txHash?: string) =>
    req('/api/deposit-request', { method: 'POST', body: JSON.stringify({ coin, txHash }) }),
  withdraw: (amount: number, network: string, address: string) =>
    req('/api/withdraw', { method: 'POST', body: JSON.stringify({ amount, network, address }) }),
}
