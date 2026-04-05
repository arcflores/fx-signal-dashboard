// ─────────────────────────────────────────────────────────────
// TradePanel.jsx — Panel de Ejecución de Operaciones
// Estilo IQ Option / TradeStation / Pocket Option
//
// Incluye:
//   - Botones CALL (verde) y PUT (rojo) grandes con efecto
//   - Selector de expiración (1m, 3m, 5m, 15m, 1h)
//   - Input de monto de inversión
//   - Payout simulado (~85%)
//   - Contador regresivo hasta la vela actual
//   - Historial de señales registradas en sesión
//   - Badge de sesgo compuesto (recomienda CALL o PUT)
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  TrendingUp, TrendingDown, Clock, DollarSign,
  CheckCircle2, XCircle, ChevronUp, ChevronDown,
  Target, BarChart2, Zap,
} from 'lucide-react'
import useStore from '../store/useStore'

// ── Timeframes disponibles para expiración ───────────────────
const EXPIRY_OPTIONS = [
  { label: '1m',  seconds: 60  },
  { label: '3m',  seconds: 180 },
  { label: '5m',  seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h',  seconds: 3600},
]

// ── Hook: countdown al cierre de la vela ─────────────────────
function useCountdown(expirySeconds) {
  const [remaining, setRemaining] = useState(expirySeconds)

  useEffect(() => {
    setRemaining(expirySeconds)
    const now = Math.floor(Date.now() / 1000)
    // Sincronizamos con el cierre de la vela actual
    const offset = now % expirySeconds
    setRemaining(expirySeconds - offset)

    const interval = setInterval(() => {
      const n = Math.floor(Date.now() / 1000)
      setRemaining(expirySeconds - (n % expirySeconds))
    }, 1000)

    return () => clearInterval(interval)
  }, [expirySeconds])

  const mins = Math.floor(remaining / 60)
  const secs = remaining % 60
  return { remaining, display: `${mins}:${secs.toString().padStart(2, '0')}` }
}

// ── Componente principal ──────────────────────────────────────
export default function TradePanel() {
  const { activePair, currentPrice, compositeBias, compositeScore } = useStore()

  // ── Estado local del panel ────────────────────────────────
  const [expiryIdx, setExpiryIdx]   = useState(2)       // 5m por defecto
  const [amount, setAmount]         = useState('10')
  const [lastTrade, setLastTrade]   = useState(null)     // { dir, price, expiry, time }
  const [tradeLog, setTradeLog]     = useState([])       // historial de la sesión
  const [showLog, setShowLog]       = useState(false)

  const expiry    = EXPIRY_OPTIONS[expiryIdx]
  const payout    = 85  // % simulado
  const potential = (parseFloat(amount) || 0) * (payout / 100)
  const countdown = useCountdown(expiry.seconds)

  // ── Registrar señal (CALL o PUT) ──────────────────────────
  const registerTrade = useCallback((direction) => {
    const trade = {
      id:        Date.now(),
      pair:      activePair,
      direction, // 'CALL' | 'PUT'
      price:     currentPrice?.toFixed(5) ?? '——',
      expiry:    expiry.label,
      amount:    parseFloat(amount) || 0,
      payout,
      time:      new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      result:    null,  // null = pendiente, 'WIN' | 'LOSS'
    }
    setLastTrade(trade)
    setTradeLog(prev => [trade, ...prev].slice(0, 20)) // máx 20 en historial
  }, [activePair, currentPrice, expiry, amount, payout])

  // ── Simula resultado de la operación pasado el tiempo ─────
  useEffect(() => {
    if (!lastTrade || lastTrade.result !== null) return
    const ms = expiry.seconds * 1000
    const timer = setTimeout(() => {
      // Resultado aleatorio ponderado por sesgo (70% según bias)
      const biasDir = compositeBias === 'NEUTRAL' ? null : compositeBias
      let winProb = 0.5
      if (biasDir === lastTrade.direction) winProb = 0.70
      if (biasDir && biasDir !== lastTrade.direction) winProb = 0.30

      const result = Math.random() < winProb ? 'WIN' : 'LOSS'

      setLastTrade(prev => prev ? { ...prev, result } : null)
      setTradeLog(prev => prev.map(t =>
        t.id === lastTrade.id ? { ...t, result } : t
      ))
    }, ms)
    return () => clearTimeout(timer)
  }, [lastTrade, expiry.seconds, compositeBias])

  // ── Barra de progreso del countdown ──────────────────────
  const progress = ((expiry.seconds - countdown.remaining) / expiry.seconds) * 100

  // ── Colores de dirección ──────────────────────────────────
  const callStyle = 'bg-call hover:bg-call/90 active:scale-95 text-white'
  const putStyle  = 'bg-put  hover:bg-put/90  active:scale-95 text-white'

  return (
    <div
      className="bg-[#0B0E11] flex flex-col select-none"
      style={{ borderTop: '1px solid #1E2732' }}
    >
      {/* ── Header compacto ─────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60">
        <div className="flex items-center gap-1.5">
          <Target size={12} className="text-accent" />
          <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
            Trade Entry
          </span>
          {/* Badge de sesgo */}
          {compositeBias !== 'NEUTRAL' && (
            <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded
              ${compositeBias === 'CALL'
                ? 'bg-call/20 text-call'
                : 'bg-put/20 text-put'}`}>
              {compositeBias} {compositeScore}%
            </span>
          )}
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-1 text-[10px] text-muted">
          <Clock size={10} />
          <span className="font-mono font-semibold">{countdown.display}</span>
        </div>
      </div>

      {/* Barra de progreso de vela */}
      <div className="h-0.5 bg-border/40 w-full">
        <div
          className="h-full bg-accent/60 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Cuerpo principal ────────────────────────────── */}
      <div className="px-3 py-2 space-y-2">

        {/* Par activo + precio */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-accent">{activePair}</span>
          <span className="text-[11px] font-mono text-text-secondary">
            {currentPrice?.toFixed(5) ?? '——'}
          </span>
        </div>

        {/* ── Selectores de expiración ──────────────────── */}
        <div className="flex gap-1">
          {EXPIRY_OPTIONS.map((opt, idx) => (
            <button
              key={opt.label}
              onClick={() => setExpiryIdx(idx)}
              className={`flex-1 py-1 text-[10px] font-bold rounded transition-all
                ${expiryIdx === idx
                  ? 'bg-accent text-white'
                  : 'bg-surface text-muted hover:text-text-primary hover:bg-surface/80'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* ── Monto de inversión ────────────────────────── */}
        <div className="flex items-center gap-1.5 bg-surface rounded-md px-2 py-1.5 border border-border/60">
          <DollarSign size={11} className="text-muted flex-shrink-0" />
          <input
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-[12px] font-mono text-text-primary
                       outline-none min-w-0 placeholder:text-muted"
            placeholder="Monto"
          />
          {/* Incrementadores rápidos */}
          <div className="flex flex-col gap-px">
            <button
              onClick={() => setAmount(a => String(Math.min(10000, (parseFloat(a)||0) + 5)))}
              className="text-muted hover:text-text-primary transition-colors"
            >
              <ChevronUp size={10} />
            </button>
            <button
              onClick={() => setAmount(a => String(Math.max(1, (parseFloat(a)||0) - 5)))}
              className="text-muted hover:text-text-primary transition-colors"
            >
              <ChevronDown size={10} />
            </button>
          </div>
        </div>

        {/* Payout esperado */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted">Payout {payout}%</span>
          <span className="font-mono text-call font-semibold">
            +${potential.toFixed(2)}
          </span>
        </div>

        {/* ── Botones CALL / PUT ───────────────────────── */}
        <div className="flex gap-2">
          <button
            onClick={() => registerTrade('CALL')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg
                        font-extrabold text-[13px] tracking-wide transition-all duration-100
                        ${callStyle}
                        ${compositeBias === 'CALL' ? 'ring-2 ring-call/50 shadow-lg shadow-call/20' : ''}`}
          >
            <TrendingUp size={15} strokeWidth={2.5} />
            CALL
          </button>
          <button
            onClick={() => registerTrade('PUT')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg
                        font-extrabold text-[13px] tracking-wide transition-all duration-100
                        ${putStyle}
                        ${compositeBias === 'PUT' ? 'ring-2 ring-put/50 shadow-lg shadow-put/20' : ''}`}
          >
            <TrendingDown size={15} strokeWidth={2.5} />
            PUT
          </button>
        </div>

        {/* ── Última operación registrada ──────────────── */}
        {lastTrade && (
          <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-[10px]
            ${lastTrade.result === 'WIN'  ? 'bg-call/10 border border-call/30' :
              lastTrade.result === 'LOSS' ? 'bg-put/10  border border-put/30'  :
              'bg-surface border border-border/60'}`}
          >
            <div className="flex items-center gap-1.5">
              {lastTrade.result === 'WIN'  && <CheckCircle2 size={11} className="text-call" />}
              {lastTrade.result === 'LOSS' && <XCircle      size={11} className="text-put"  />}
              {!lastTrade.result           && <Zap          size={11} className="text-accent animate-pulse" />}
              <span className={`font-bold
                ${lastTrade.direction === 'CALL' ? 'text-call' : 'text-put'}`}>
                {lastTrade.direction}
              </span>
              <span className="text-muted">{lastTrade.pair}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-muted">${lastTrade.amount}</span>
              {lastTrade.result === null && (
                <span className="text-accent text-[9px] font-medium">ABIERTO</span>
              )}
              {lastTrade.result === 'WIN' && (
                <span className="text-call font-bold">+${(lastTrade.amount * payout / 100).toFixed(2)}</span>
              )}
              {lastTrade.result === 'LOSS' && (
                <span className="text-put font-bold">-${lastTrade.amount.toFixed(2)}</span>
              )}
            </div>
          </div>
        )}

        {/* ── Toggle historial ─────────────────────────── */}
        {tradeLog.length > 0 && (
          <button
            onClick={() => setShowLog(v => !v)}
            className="w-full flex items-center justify-between px-2 py-1 text-[9px]
                       text-muted hover:text-text-primary transition-colors"
          >
            <div className="flex items-center gap-1">
              <BarChart2 size={10} />
              <span>Historial ({tradeLog.length})</span>
              {/* Stats rápidas */}
              {tradeLog.filter(t => t.result).length > 0 && (() => {
                const resolved = tradeLog.filter(t => t.result)
                const wins = resolved.filter(t => t.result === 'WIN').length
                const pct  = ((wins / resolved.length) * 100).toFixed(0)
                return (
                  <span className={`font-bold ml-1 ${pct >= 50 ? 'text-call' : 'text-put'}`}>
                    {pct}% win
                  </span>
                )
              })()}
            </div>
            <ChevronDown
              size={10}
              className={`transition-transform ${showLog ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {/* ── Historial expandible ─────────────────────── */}
        {showLog && tradeLog.length > 0 && (
          <div className="max-h-28 overflow-y-auto space-y-0.5 pr-0.5">
            {tradeLog.map(t => (
              <div key={t.id}
                className="flex items-center justify-between text-[9px] px-2 py-1
                           bg-surface/60 rounded hover:bg-surface transition-colors"
              >
                <span className="text-muted font-mono">{t.time}</span>
                <span className={`font-bold w-8 text-center
                  ${t.direction === 'CALL' ? 'text-call' : 'text-put'}`}>
                  {t.direction}
                </span>
                <span className="text-muted">{t.pair}</span>
                <span className="font-mono text-muted">{t.expiry}</span>
                <span className={`font-bold w-10 text-right
                  ${t.result === 'WIN'  ? 'text-call'   :
                    t.result === 'LOSS' ? 'text-put'    : 'text-accent'}`}>
                  {t.result ?? '…'}
                </span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
