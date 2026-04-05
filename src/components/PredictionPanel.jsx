// ─────────────────────────────────────────────────────────────
// PredictionPanel.jsx — Panel de predicciones / órdenes virtuales
//
// Muestra las predicciones del scanner automático:
//   - Dirección BUY/SELL con Entry, SL, TP
//   - Confianza % y razones técnicas
//   - Status en tiempo real: PENDING → TRIGGERED → WIN/LOSS
//   - Stats de sesión (win rate, profit factor)
//   - Señales del par activo (compactas)
//
// El usuario evalúa las predicciones aquí y las ejecuta
// manualmente en su broker externo.
// ─────────────────────────────────────────────────────────────
import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Target, Shield, Crosshair, Clock,
  CheckCircle2, XCircle, AlertTriangle, Radar, ChevronDown,
  ChevronRight, Zap, Activity, BarChart2, Timer,
} from 'lucide-react'
import useStore from '../store/useStore'
import { PAIR_CONFIG } from '../utils/mockForex'

// ── Status config ────────────────────────────────────────────
const STATUS_CONFIG = {
  PENDING:   { label: 'Pendiente',  color: '#F59E0B', bg: 'bg-warn/10',    border: 'border-warn/30',    Icon: Clock },
  TRIGGERED: { label: 'En curso',   color: '#3B82F6', bg: 'bg-accent/10',  border: 'border-accent/30',  Icon: Zap },
  WIN:       { label: 'Ganada',     color: '#26A69A', bg: 'bg-call/10',    border: 'border-call/30',    Icon: CheckCircle2 },
  LOSS:      { label: 'Perdida',    color: '#EF5350', bg: 'bg-put/10',     border: 'border-put/30',     Icon: XCircle },
  EXPIRED:   { label: 'Expirada',   color: '#64748B', bg: 'bg-neutral/10', border: 'border-neutral/30', Icon: Timer },
}

// ── Tarjeta individual de predicción ─────────────────────────
function PredictionCard({ pred, onSelectPair }) {
  const [expanded, setExpanded] = useState(false)
  const config   = PAIR_CONFIG[pred.pair] ?? { decimals: 5, pip: 0.0001 }
  const decimals = config.decimals ?? 5
  const status   = STATUS_CONFIG[pred.status] || STATUS_CONFIG.PENDING
  const StatusIcon = status.Icon
  const isActive = pred.status === 'PENDING' || pred.status === 'TRIGGERED'
  const isBuy    = pred.direction === 'BUY'

  // Progreso hacia TP (solo para TRIGGERED)
  let progress = 0
  if (pred.status === 'TRIGGERED' && pred.currentPx) {
    const totalDist = Math.abs(pred.tp - pred.entry)
    const currentDist = isBuy
      ? pred.currentPx - pred.entry
      : pred.entry - pred.currentPx
    progress = Math.max(-100, Math.min(100, (currentDist / totalDist) * 100))
  }

  // Tiempo transcurrido
  const elapsed = pred.triggeredAt
    ? Math.floor((Date.now() - pred.triggeredAt) / 1000)
    : Math.floor((Date.now() - pred.createdAt) / 1000)
  const elapsedStr = elapsed < 60
    ? `${elapsed}s`
    : elapsed < 3600
      ? `${Math.floor(elapsed/60)}m ${elapsed%60}s`
      : `${Math.floor(elapsed/3600)}h`

  return (
    <div
      className={`border rounded-md transition-all cursor-pointer
                  ${status.bg} ${status.border}
                  ${isActive ? 'hover:border-accent/50' : 'opacity-70'}`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* ── Header de la tarjeta ──────────────────────────── */}
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* Dirección */}
        <div className={`flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0
                         ${isBuy ? 'bg-call/20' : 'bg-put/20'}`}>
          {isBuy
            ? <TrendingUp   size={13} className="text-call" strokeWidth={2.5} />
            : <TrendingDown size={13} className="text-put"  strokeWidth={2.5} />
          }
        </div>

        {/* Par y dirección */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onSelectPair(pred.pair) }}
              className={`text-[11px] font-bold hover:underline
                          ${isBuy ? 'text-call' : 'text-put'}`}
            >
              {pred.direction} {pred.pair}
            </button>
            <span className="text-[9px] text-muted font-mono">{pred.tf}</span>
          </div>
          {/* Entry price */}
          <span className="text-[10px] font-mono text-text-secondary">
            @ {pred.entry.toFixed(decimals)}
          </span>
        </div>

        {/* Confianza */}
        <div className="flex flex-col items-end gap-0.5">
          <span className={`text-[10px] font-extrabold
                            ${pred.confidence >= 75 ? 'text-call' : pred.confidence >= 60 ? 'text-warn' : 'text-muted'}`}>
            {pred.confidence}%
          </span>
          <div className="flex items-center gap-1">
            <StatusIcon size={10} style={{ color: status.color }} />
            <span className="text-[9px]" style={{ color: status.color }}>{status.label}</span>
          </div>
        </div>

        {/* Expand chevron */}
        {expanded
          ? <ChevronDown  size={12} className="text-muted flex-shrink-0" />
          : <ChevronRight size={12} className="text-muted flex-shrink-0" />
        }
      </div>

      {/* ── Barra de progreso (solo TRIGGERED) ─────────── */}
      {pred.status === 'TRIGGERED' && (
        <div className="mx-2.5 mb-1.5 h-1 rounded-full bg-surface/80 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${progress >= 0 ? 'bg-call' : 'bg-put'}`}
            style={{ width: `${Math.abs(progress)}%`, marginLeft: progress < 0 ? 'auto' : 0 }}
          />
        </div>
      )}

      {/* ── Detalle expandido ──────────────────────────── */}
      {expanded && (
        <div className="px-2.5 pb-2 space-y-1.5 border-t border-border/30 pt-1.5">

          {/* SL / TP / R:R */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="text-muted block">Stop Loss</span>
              <span className="text-put font-mono font-semibold">{pred.sl.toFixed(decimals)}</span>
              <span className="text-put text-[9px] ml-1">-{pred.riskPips}p</span>
            </div>
            <div>
              <span className="text-muted block">Take Profit</span>
              <span className="text-call font-mono font-semibold">{pred.tp.toFixed(decimals)}</span>
              <span className="text-call text-[9px] ml-1">+{pred.rewardPips}p</span>
            </div>
            <div>
              <span className="text-muted block">R:R</span>
              <span className="text-accent font-bold">1:{pred.rr}</span>
            </div>
          </div>

          {/* Precio actual (si activa) */}
          {isActive && pred.currentPx && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted">Precio actual</span>
              <span className="font-mono text-text-primary">{pred.currentPx.toFixed(decimals)}</span>
            </div>
          )}

          {/* Tiempo */}
          <div className="flex items-center justify-between text-[9px] text-muted">
            <span>{new Date(pred.createdAt).toLocaleTimeString('es')}</span>
            <span>{elapsedStr}</span>
          </div>

          {/* Razones técnicas */}
          <div className="space-y-0.5">
            {pred.reasons.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[9px] text-text-secondary">
                <div className={`w-1 h-1 rounded-full flex-shrink-0
                                 ${isBuy ? 'bg-call' : 'bg-put'}`} />
                {r}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Stats de la sesión ───────────────────────────────────────
function SessionStats({ predictions }) {
  const closed  = predictions.filter(p => p.status === 'WIN' || p.status === 'LOSS')
  const wins    = closed.filter(p => p.status === 'WIN').length
  const losses  = closed.filter(p => p.status === 'LOSS').length
  const active  = predictions.filter(p => p.status === 'PENDING' || p.status === 'TRIGGERED').length
  const winRate = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0

  return (
    <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40 text-[10px]">
      <div className="flex items-center gap-3">
        <span className="text-muted">Activas: <b className="text-accent">{active}</b></span>
        <span className="text-muted">Ganadas: <b className="text-call">{wins}</b></span>
        <span className="text-muted">Perdidas: <b className="text-put">{losses}</b></span>
      </div>
      {closed.length > 0 && (
        <span className={`font-bold ${winRate >= 50 ? 'text-call' : 'text-put'}`}>
          WR: {winRate}%
        </span>
      )}
    </div>
  )
}

// ── Signal Summary compacto ──────────────────────────────────
function SignalSummary() {
  const { signals, compositeScore, compositeBias, activePair, activeTF } = useStore()

  if (!signals || signals.length === 0) return null

  const callCount    = signals.filter(s => s.signal === 'call').length
  const putCount     = signals.filter(s => s.signal === 'put').length
  const neutralCount = signals.filter(s => s.signal === 'neutral').length

  return (
    <div className="px-2.5 py-1.5 border-b border-border/40">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] text-muted font-semibold uppercase tracking-wider">
          {activePair} · {activeTF}
        </span>
        <span className={`text-[10px] font-extrabold
                          ${compositeBias === 'CALL' ? 'text-call' : compositeBias === 'PUT' ? 'text-put' : 'text-muted'}`}>
          {compositeBias} {compositeScore}%
        </span>
      </div>
      {/* Mini bars */}
      <div className="flex gap-1 text-[9px]">
        <span className="text-call font-bold">{callCount} BUY</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{neutralCount} —</span>
        <span className="text-muted">·</span>
        <span className="text-put font-bold">{putCount} SELL</span>
      </div>
    </div>
  )
}

// ── Componente principal PredictionPanel ─────────────────────
export default function PredictionPanel() {
  const { predictions, setActivePair } = useStore()
  const [filter, setFilter] = useState('active') // 'active' | 'all' | 'closed'

  const filtered = useMemo(() => {
    if (filter === 'active') return predictions.filter(p => p.status === 'PENDING' || p.status === 'TRIGGERED')
    if (filter === 'closed') return predictions.filter(p => p.status === 'WIN' || p.status === 'LOSS' || p.status === 'EXPIRED')
    return predictions
  }, [predictions, filter])

  const handleSelectPair = (pair) => {
    setActivePair(pair)
  }

  return (
    <div className="flex flex-col bg-[#0B0E11] select-none" style={{ height: '100%', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between px-2.5 py-2 border-b border-border/60 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Radar size={12} className="text-accent" />
          <span className="text-[11px] font-bold text-text-primary uppercase tracking-wider">
            Scanner
          </span>
          <span className="text-[9px] text-muted">Auto-Scan</span>
        </div>
        {/* Indicador de escaneo */}
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-call animate-pulse" />
          <span className="text-[9px] text-call font-medium">ACTIVO</span>
        </div>
      </div>

      {/* ── Signal summary del par activo ─────────────── */}
      <SignalSummary />

      {/* ── Session stats ────────────────────────────── */}
      <SessionStats predictions={predictions} />

      {/* ── Filter tabs ──────────────────────────────── */}
      <div className="flex border-b border-border/40 flex-shrink-0">
        {[
          { key: 'active', label: 'Activas' },
          { key: 'all',    label: 'Todas' },
          { key: 'closed', label: 'Cerradas' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 py-1.5 text-[10px] font-semibold transition-colors
                        border-b-2 ${filter === tab.key
                          ? 'text-accent border-accent'
                          : 'text-muted border-transparent hover:text-text-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Lista de predicciones ──────────────────── */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <Radar size={24} className="mb-2 animate-pulse" />
            <span className="text-[11px]">Escaneando mercados...</span>
            <span className="text-[9px] mt-1">Las predicciones aparecerán aquí</span>
          </div>
        ) : (
          filtered.map(pred => (
            <PredictionCard
              key={pred.id}
              pred={pred}
              onSelectPair={handleSelectPair}
            />
          ))
        )}
      </div>
    </div>
  )
}
