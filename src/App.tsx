import { useState, useEffect, useCallback } from 'react'
import WebApp from '@twa-dev/sdk'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Bot, Wallet, History, TrendingUp, TrendingDown, Copy, Check,
  AlertTriangle, Loader2, RefreshCw, Radio, Target, Search, CheckCircle2,
  XCircle, Clock, Activity, ChevronRight,
} from 'lucide-react'
import { api, type ApiUser, type LiveBot, type MatchHistory } from './api'

type Tab = 'home' | 'bots' | 'history' | 'wallet'
type BotStatus = 'idle' | 'scanning' | 'entry_found' | 'in_trade' | 'win' | 'loss'

const STATUS_LABEL: Record<string, string> = {
  idle: 'Em espera',
  scanning: 'A procurar entrada...',
  entry_found: 'Entrada encontrada!',
  in_trade: 'Operação ativa',
  win: 'Vitória',
  loss: 'Derrota',
}
const STATUS_COLOR: Record<string, string> = {
  idle: 'var(--text-dim)',
  scanning: 'var(--blue)',
  entry_found: 'var(--orange)',
  in_trade: 'var(--accent)',
  win: 'var(--accent)',
  loss: 'var(--red)',
}

function BotStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'scanning': return <Search size={16} color="var(--blue)" className="spin" />
    case 'entry_found': return <Target size={16} color="var(--orange)" className="blink" />
    case 'in_trade': return <Activity size={16} color="var(--accent)" className="pulse-ring" />
    case 'win': return <CheckCircle2 size={16} color="var(--accent)" />
    case 'loss': return <XCircle size={16} color="var(--red)" />
    default: return <Clock size={16} color="var(--text-dim)" />
  }
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [user, setUser] = useState<ApiUser | null>(null)
  const [bots, setBots] = useState<LiveBot[]>([])
  const [history, setHistory] = useState<MatchHistory[]>([])
  const [addresses, setAddresses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tgName, setTgName] = useState('Trader')
  const [copied, setCopied] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [depositCoin, setDepositCoin] = useState<'BTC' | 'ETH' | 'USDC'>('USDC')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [withdrawNetwork, setWithdrawNetwork] = useState('USDC')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [me, live, hist, addrs] = await Promise.all([
        api.getMe(),
        api.getLiveBots(),
        api.getHistory(),
        api.getDepositAddresses().catch(() => ({
          BTC: '175DBVQbmokQFmbP1xXvChpmQxwCLeiDim',
          ETH: '0x253b6EA9a69D60400C5170022362eebd442bEdF9',
          USDC: '0x253b6EA9a69D60400C5170022362eebd442bEdF9',
        })),
      ])
      setUser(me)
      setBots(live)
      setHistory(hist)
      setAddresses(addrs)
    } catch (e: any) {
      setError(e.message || 'Erro de ligação')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      WebApp.ready()
      WebApp.expand()
      WebApp.setHeaderColor('#0a0f0c')
      WebApp.setBackgroundColor('#0a0f0c')
      if (WebApp.initDataUnsafe?.user) setTgName(WebApp.initDataUnsafe.user.first_name || 'Trader')
    } catch {}
    load()
    const t = setInterval(() => {
      api.getLiveBots().then(setBots).catch(() => {})
    }, 4000)
    return () => clearInterval(t)
  }, [load])

  const copyText = (t: string) => {
    navigator.clipboard.writeText(t).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      try { WebApp.HapticFeedback.impactOccurred('light') } catch {}
    })
  }

  const alertMsg = (m: string) => { try { WebApp.showAlert(m) } catch { alert(m) } }

  const doDeposit = async () => {
    setBusy(true)
    try {
      await api.depositRequest(depositCoin)
      alertMsg('Pedido registado. Após confirmação o saldo será creditado.')
      setShowDeposit(false)
      await load()
    } catch (e: any) { alertMsg(e.message) }
    finally { setBusy(false) }
  }

  const doWithdraw = async () => {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0) return alertMsg('Valor inválido')
    if (!withdrawAddress || withdrawAddress.length < 15) return alertMsg('Endereço inválido')
    setBusy(true)
    try {
      await api.withdraw(amt, withdrawNetwork, withdrawAddress)
      alertMsg('Pedido de saque registado (24-48h).')
      setShowWithdraw(false)
      setWithdrawAmount('')
      setWithdrawAddress('')
      await load()
    } catch (e: any) { alertMsg(e.message) }
    finally { setBusy(false) }
  }

  if (loading) {
    return (
      <div style={styles.center}>
        <Loader2 size={28} color="var(--accent)" className="spin" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: 14 }}>A carregar...</p>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div style={styles.center}>
        <AlertTriangle size={28} color="var(--orange)" />
        <p style={{ color: 'var(--text-muted)', marginTop: 12, textAlign: 'center', padding: '0 24px' }}>{error}</p>
        <button style={{ ...styles.primaryBtn, marginTop: 16 }} onClick={() => { setLoading(true); load() }}>Tentar novamente</button>
      </div>
    )
  }

  const balance = user?.balance ?? 0
  const totalProfit = user?.totalProfit ?? 0
  const activeBots = bots.filter(b => b.status !== 'idle').length
  const wins = history.filter(m => m.result === 'win').length
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <div style={styles.logoRow}>
            <Radio size={18} color="var(--accent)" className="blink" />
            <span style={styles.logo}>FutInvest</span>
            <span style={styles.liveBadge}>AO VIVO</span>
          </div>
          <p style={styles.greeting}>Olá, {user?.firstName || tgName}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={styles.iconBtn} onClick={() => load()}><RefreshCw size={15} color="var(--text-muted)" /></button>
          <div style={styles.balancePill}>
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Saldo</span>
            <strong style={{ color: 'var(--accent)' }}>${balance.toFixed(2)}</strong>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <AnimatePresence mode="wait">
          {tab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={styles.page}>
              <div style={styles.statsGrid}>
                <div style={styles.statCard}>
                  <Bot size={16} color="var(--accent)" />
                  <span style={styles.statLabel}>Robôs ativos</span>
                  <strong style={styles.statValue}>{activeBots}/{bots.length}</strong>
                </div>
                <div style={styles.statCard}>
                  <TrendingUp size={16} color="var(--orange)" />
                  <span style={styles.statLabel}>Lucro total</span>
                  <strong style={{ ...styles.statValue, color: totalProfit >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                    ${totalProfit.toFixed(2)}
                  </strong>
                </div>
                <div style={styles.statCard}>
                  <Target size={16} color="var(--blue)" />
                  <span style={styles.statLabel}>Win rate</span>
                  <strong style={styles.statValue}>{winRate}%</strong>
                </div>
                <div style={styles.statCard}>
                  <History size={16} color="var(--purple)" />
                  <span style={styles.statLabel}>Jogos</span>
                  <strong style={styles.statValue}>{history.length}</strong>
                </div>
              </div>

              <section style={styles.section}>
                <div style={styles.sectionHead}>
                  <h2 style={styles.sectionTitle}>Operações ao vivo</h2>
                  <span style={styles.liveDot}>● LIVE</span>
                </div>
                {bots.filter(b => b.status !== 'idle').length === 0 ? (
                  <div style={styles.empty}><Search size={28} color="var(--text-dim)" /><p>Nenhum robô a operar</p></div>
                ) : bots.filter(b => b.status !== 'idle').map(bot => (
                  <div key={bot.id} style={styles.liveCard}>
                    <div style={styles.liveTop}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BotStatusIcon status={bot.status} />
                        <strong style={{ fontSize: 14 }}>{bot.name}</strong>
                      </div>
                      <span style={{ ...styles.statusChip, color: STATUS_COLOR[bot.status], borderColor: STATUS_COLOR[bot.status] }}>
                        {STATUS_LABEL[bot.status] || bot.status}
                      </span>
                    </div>
                    {bot.status === 'scanning' && <div style={styles.scanBar}><div style={styles.scanFill} /></div>}
                    {bot.currentMatch && (
                      <div style={styles.matchLine}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{bot.currentMatch}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bot.league}</span>
                      </div>
                    )}
                    <div style={styles.liveMeta}>
                      <span>Stake ${bot.stake}</span>
                      {bot.odd > 0 && <span>Odd {bot.odd}</span>}
                      {bot.profit != null && (
                        <span style={{ color: bot.profit >= 0 ? 'var(--accent)' : 'var(--red)', fontWeight: 700 }}>
                          {bot.profit >= 0 ? '+' : ''}{bot.profit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </section>

              <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Últimos resultados</h2>
                {history.slice(0, 4).map(m => (
                  <div key={m.id} style={styles.historyRow}>
                    <div style={{
                      ...styles.resultIcon,
                      background: m.result === 'win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                    }}>
                      {m.result === 'win' ? <TrendingUp size={14} color="var(--accent)" /> : <TrendingDown size={14} color="var(--red)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{m.home} {m.score} {m.away}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.tip} · {m.odd}</div>
                    </div>
                    <strong style={{ color: m.profit >= 0 ? 'var(--accent)' : 'var(--red)', fontSize: 14 }}>
                      {m.profit >= 0 ? '+' : ''}{m.profit.toFixed(2)}
                    </strong>
                  </div>
                ))}
                <button style={styles.linkBtn} onClick={() => setTab('history')}>
                  Ver histórico completo <ChevronRight size={14} />
                </button>
              </section>
            </motion.div>
          )}

          {tab === 'bots' && (
            <motion.div key="bots" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={styles.page}>
              <h2 style={styles.sectionTitle}>Os teus robôs</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Estados atualizados em tempo real pelo servidor.</p>
              {bots.map(bot => (
                <div key={bot.id} style={styles.botCard}>
                  <div style={styles.botTop}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={20} color="var(--accent)" />
                      </div>
                      <div>
                        <strong style={{ fontSize: 15 }}>{bot.name}</strong>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{bot.league}</div>
                      </div>
                    </div>
                    <BotStatusIcon status={bot.status} />
                  </div>
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: STATUS_COLOR[bot.status], fontWeight: 600 }}>{STATUS_LABEL[bot.status]}</span>
                      {bot.status === 'scanning' && <span style={{ fontSize: 11, color: 'var(--text-dim)' }} className="blink">a analisar odds...</span>}
                    </div>
                    {bot.status === 'scanning' && <div style={{ ...styles.scanBar, marginTop: 8 }}><div style={styles.scanFill} /></div>}
                    {bot.currentMatch && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{bot.currentMatch}</div>}
                  </div>
                  <div style={styles.botMeta}>
                    <div><div style={styles.metaLabel}>Stake</div><div style={styles.metaValue}>${bot.stake}</div></div>
                    <div><div style={styles.metaLabel}>Odd</div><div style={styles.metaValue}>{bot.odd > 0 ? bot.odd : '—'}</div></div>
                    <div>
                      <div style={styles.metaLabel}>P/L</div>
                      <div style={{ ...styles.metaValue, color: bot.profit == null ? 'var(--text)' : bot.profit >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                        {bot.profit != null ? `${bot.profit >= 0 ? '+' : ''}${bot.profit.toFixed(2)}` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'history' && (
            <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={styles.page}>
              <h2 style={styles.sectionTitle}>Histórico de jogos</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>Resultados de operações concluídas.</p>
              {history.map(m => (
                <div key={m.id} style={styles.historyCard}>
                  <div style={styles.historyTop}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.league}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                      background: m.result === 'win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                      color: m.result === 'win' ? 'var(--accent)' : 'var(--red)',
                    }}>{m.result === 'win' ? 'WIN' : 'LOSS'}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, margin: '6px 0' }}>
                    {m.home} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{m.score}</span> {m.away}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.tip} @ {m.odd} · {m.date}</span>
                    <strong style={{ color: m.profit >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                      {m.profit >= 0 ? '+' : ''}{m.profit.toFixed(2)}
                    </strong>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'wallet' && (
            <motion.div key="wallet" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} style={styles.page}>
              <div style={styles.walletCard}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Saldo disponível</span>
                <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--accent)', margin: '8px 0' }}>${balance.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: totalProfit >= 0 ? 'var(--accent)' : 'var(--red)', marginBottom: 16 }}>
                  P/L total: {totalProfit >= 0 ? '+' : ''}{totalProfit.toFixed(2)}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button style={styles.primaryBtn} onClick={() => setShowDeposit(true)}>Depositar</button>
                  <button style={styles.secondaryBtn} onClick={() => setShowWithdraw(true)}>Sacar</button>
                </div>
              </div>
              <div style={styles.warningBox}>
                <AlertTriangle size={15} color="var(--orange)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Depósitos creditados após confirmação. Saques em 24-48h.</span>
              </div>
              {user?.transactions?.length ? (
                <>
                  <h2 style={{ ...styles.sectionTitle, marginTop: 20 }}>Movimentos</h2>
                  {user.transactions.map(tx => (
                    <div key={tx.id} style={styles.historyRow}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{tx.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(tx.created_at).toLocaleString('pt-PT')}</div>
                      </div>
                      <strong style={{ color: tx.amount >= 0 ? 'var(--accent)' : 'var(--red)' }}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav style={styles.nav}>
        {[
          { id: 'home' as Tab, icon: Home, label: 'Início' },
          { id: 'bots' as Tab, icon: Bot, label: 'Robôs' },
          { id: 'history' as Tab, icon: History, label: 'Histórico' },
          { id: 'wallet' as Tab, icon: Wallet, label: 'Carteira' },
        ].map(item => (
          <button key={item.id} style={{ ...styles.navBtn, color: tab === item.id ? 'var(--accent)' : 'var(--text-muted)' }} onClick={() => setTab(item.id)}>
            <item.icon size={20} /><span style={{ fontSize: 11 }}>{item.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {showDeposit && (
          <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setShowDeposit(false)}>
            <motion.div style={styles.modal} initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: 12 }}>Depositar</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {(['BTC', 'ETH', 'USDC'] as const).map(c => (
                  <button key={c} style={{ ...styles.coinBtn, background: depositCoin === c ? 'var(--accent)' : 'var(--bg)', color: depositCoin === c ? '#0a0f0c' : 'var(--text)' }} onClick={() => setDepositCoin(c)}>{c}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Envia {depositCoin} para:</p>
              <div style={styles.addressBox}>
                <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{addresses[depositCoin] || '—'}</code>
                <button style={styles.copyBtn} onClick={() => copyText(addresses[depositCoin] || '')}>
                  {copied ? <Check size={16} color="var(--accent)" /> : <Copy size={16} />}
                </button>
              </div>
              <button style={{ ...styles.primaryBtn, width: '100%', marginTop: 12, opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doDeposit}>
                {busy ? '...' : 'Já enviei — registar'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWithdraw && (
          <motion.div style={styles.modalOverlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !busy && setShowWithdraw(false)}>
            <motion.div style={styles.modal} initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: 12 }}>Sacar</h3>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {(['BTC', 'ETH', 'USDC'] as const).map(n => (
                  <button key={n} style={{ ...styles.coinBtn, background: withdrawNetwork === n ? 'var(--accent)' : 'var(--bg)', color: withdrawNetwork === n ? '#0a0f0c' : 'var(--text)' }} onClick={() => setWithdrawNetwork(n)}>{n}</button>
                ))}
              </div>
              <label style={styles.label}>Valor USD</label>
              <input style={styles.input} type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="50" />
              <label style={styles.label}>Endereço</label>
              <input style={styles.input} type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} placeholder="0x... / bc1..." />
              <button style={{ ...styles.primaryBtn, width: '100%', opacity: busy ? 0.7 : 1 }} disabled={busy} onClick={doWithdraw}>
                {busy ? '...' : 'Confirmar saque'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', flexDirection: 'column', height: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg)' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', background: 'rgba(10,15,12,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 40 },
  logoRow: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: { fontWeight: 800, fontSize: 18, background: 'var(--gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  liveBadge: { fontSize: 9, fontWeight: 800, background: 'rgba(239,68,68,0.2)', color: 'var(--red)', padding: '2px 6px', borderRadius: 6, letterSpacing: '0.05em' },
  greeting: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 },
  balancePill: { background: 'var(--accent-glow)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 12, padding: '7px 12px', textAlign: 'right', display: 'flex', flexDirection: 'column' },
  iconBtn: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, overflowY: 'auto', paddingBottom: 88 },
  page: { padding: 16 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 },
  statCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 4 },
  statLabel: { fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
  statValue: { fontSize: 18, fontWeight: 700 },
  section: { marginBottom: 24 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 700 },
  liveDot: { fontSize: 11, color: 'var(--red)', fontWeight: 700, letterSpacing: '0.04em' },
  empty: { background: 'var(--bg-card)', border: '1px dashed var(--border)', borderRadius: 14, padding: 28, textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  liveCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10 },
  liveTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusChip: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 8, border: '1px solid', letterSpacing: '0.02em' },
  scanBar: { height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', marginBottom: 8, position: 'relative' },
  scanFill: { position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', background: 'var(--gradient-blue)', animation: 'scan 1.5s ease-in-out infinite' },
  matchLine: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 },
  liveMeta: { display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 },
  historyRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' },
  resultIcon: { width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  linkBtn: { background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 12, padding: 0 },
  botCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 12 },
  botTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  botMeta: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14 },
  metaLabel: { fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  metaValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  historyCard: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, marginBottom: 10 },
  historyTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  walletCard: { background: 'var(--accent-glow)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 18, padding: 24, textAlign: 'center' },
  warningBox: { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: 14, marginTop: 16 },
  primaryBtn: { background: 'var(--gradient)', color: '#0a0f0c', fontWeight: 700, fontSize: 14, padding: '12px 20px', borderRadius: 12, boxShadow: '0 4px 16px rgba(34,197,94,0.25)' },
  secondaryBtn: { background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border-light)', fontWeight: 600, fontSize: 14, padding: '12px 20px', borderRadius: 12 },
  coinBtn: { flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, border: '1px solid var(--border)' },
  label: { display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500 },
  input: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', color: 'var(--text)', fontSize: 14, marginBottom: 14 },
  addressBox: { display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 12 },
  copyBtn: { background: 'transparent', color: 'var(--accent)', padding: 4, flexShrink: 0 },
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto', display: 'flex', background: 'rgba(17,25,22,0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)', padding: '10px 0 max(10px, env(safe-area-inset-bottom))', zIndex: 50 },
  navBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'transparent', padding: '6px 0', fontWeight: 500 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--bg-card)', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: '28px 22px 32px', width: '100%', maxWidth: 480, border: '1px solid var(--border)' },
}
