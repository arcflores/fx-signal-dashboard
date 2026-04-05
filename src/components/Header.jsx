// ─────────────────────────────────────────────────────────────
// Header.jsx — Barra superior de herramientas (estilo TradingView)
// Incluye:
//   - Logo y nombre de la plataforma
//   - Selector de par con precio en tiempo real
//   - Botones de timeframe (1m, 3m, 5m, 15m, 1h)
//   - Selector de tipo de chart (velas, barras, línea, área)
//   - Botón de indicadores (muestra/oculta EMA20/50, BB, Fibonacci, Volumen)
//   - Badge de sesgo compuesto CALL/PUT
//   - Indicador de conexión (Binance Live vs Mock Data)
// ─────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react'
import {
  TrendingUp, Wifi, WifiOff, ChevronDown, Settings2,
  CandlestickChart, BarChart2, LineChart, AreaChart,
  Layers, Bell, Maximize2, RefreshCw, Activity,
} from 'lucide-react'
import useStore from '../store/useStore'
import {
  ALL_PAIRS, FOREX_PAIRS, CRYPTO_PAIRS, TIMEFRAMES, PAIR_CONFIG,
} from '../utils/mockForex'

// ── Tipos de chart disponibles ────────────────────────────────
const CHART_TYPES = [
  { id: 'candlestick', label: 'Velas japonesas', Icon: CandlestickChart },
  { id: 'bar',         label: 'Barras OHLC',    Icon: BarChart2 },
  { id: 'line',        label: 'Línea',           Icon: LineChart  },
  { id: 'area',        label: 'Área',            Icon: AreaChart  },
]

// ── Selector de par con dropdown ─────────────────────────────
function PairSelector({ activePair, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // Cierra el dropdown al hacer clic fuera
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md
                   text-sm font-bold text-text-primary hover:bg-surface
                   transition-colors cursor-pointer border border-transparent
                   hover:border-border"
      >
        {activePair}
        <ChevronDown size={12} className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-[#131722] border border-border
                        rounded-md shadow-2xl z-[100] overflow-hidden">
          {/* Forex group */}
          <div className="px-3 py-1.5 text-[10px] text-muted font-semibold uppercase tracking-widest
                          bg-surface border-b border-border">
            Forex
          </div>
          {FOREX_PAIRS.map(pair => (
            <button
              key={pair}
              onClick={() => { onChange(pair); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[13px] font-medium
                          transition-colors hover:bg-surface/80
                          ${activePair === pair ? 'text-accent bg-accent/5' : 'text-text-primary'}`}
            >
              {pair}
            </button>
          ))}
          {/* Crypto group */}
          <div className="px-3 py-1.5 text-[10px] text-muted font-semibold uppercase tracking-widest
                          bg-surface border-t border-b border-border">
            Crypto
          </div>
          {CRYPTO_PAIRS.map(pair => (
            <button
              key={pair}
              onClick={() => { onChange(pair); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[13px] font-medium
                          transition-colors hover:bg-surface/80
                          ${activePair === pair ? 'text-accent bg-accent/5' : 'text-text-primary'}`}
            >
              {pair}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Selector de tipo de chart ─────────────────────────────────
function ChartTypeSelector({ chartType, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const active = CHART_TYPES.find(c => c.id === chartType) || CHART_TYPES[0]
  const ActiveIcon = active.Icon

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        title={active.label}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-muted
                   hover:text-text-primary hover:bg-surface transition-colors border
                   border-transparent hover:border-border"
      >
        <ActiveIcon size={15} />
        <ChevronDown size={10} className="text-muted" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-44 bg-[#131722] border border-border
                        rounded-md shadow-2xl z-[100] overflow-hidden">
          {CHART_TYPES.map(ct => {
            const CtIcon = ct.Icon
            return (
              <button
                key={ct.id}
                onClick={() => { onChange(ct.id); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px]
                            transition-colors hover:bg-surface
                            ${chartType === ct.id ? 'text-accent bg-accent/5' : 'text-text-primary'}`}
              >
                <CtIcon size={14} />
                {ct.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Botón de indicadores con dropdown ────────────────────────
function IndicatorsButton() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { showIndicators, toggleIndicator } = useStore()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const INDICATOR_LIST = [
    { key: 'ema20',     label: 'EMA 20',             color: '#3B82F6' },
    { key: 'ema50',     label: 'EMA 50',             color: '#F59E0B' },
    { key: 'bb',        label: 'Bollinger Bands',    color: 'rgba(148,163,184,0.6)' },
    { key: 'fibonacci', label: 'Fibonacci Levels',   color: 'rgba(59,130,246,0.8)' },
    { key: 'volume',    label: 'Volumen',             color: '#6B7280' },
  ]

  const activeCount = Object.values(showIndicators).filter(Boolean).length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium
                    transition-colors border
                    ${open ? 'text-accent bg-accent/10 border-accent/30' : 'text-muted hover:text-text-primary hover:bg-surface border-transparent hover:border-border'}`}
      >
        <Layers size={14} />
        <span>Indicadores</span>
        {activeCount > 0 && (
          <span className="bg-accent/20 text-accent text-[10px] px-1 rounded font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-[#131722] border border-border
                        rounded-md shadow-2xl z-[100] overflow-hidden">
          <div className="px-3 py-2 text-[10px] text-muted font-semibold uppercase tracking-widest
                          bg-surface border-b border-border">
            Overlays del chart
          </div>
          {INDICATOR_LIST.map(ind => (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface transition-colors"
            >
              {/* Checkbox visual */}
              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                               transition-all ${showIndicators[ind.key]
                                 ? 'bg-accent border-accent'
                                 : 'border-border bg-transparent'}`}
              >
                {showIndicators[ind.key] && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
              {/* Pastilla de color */}
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: ind.color }} />
              <span className="text-[12px] text-text-primary">{ind.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Componente principal Header ───────────────────────────────
export default function Header({ isConnected }) {
  const {
    activePair, activeTF, currentPrice,
    compositeBias, compositeScore,
    chartType, setChartType,
    setActivePair, setActiveTF,
  } = useStore()

  const isCrypto   = CRYPTO_PAIRS.includes(activePair)
  const pairConfig = PAIR_CONFIG[activePair]
  const decimals   = pairConfig?.decimals ?? 5

  // Precio formateado con los decimales correctos del par
  const formattedPrice = currentPrice ? currentPrice.toFixed(decimals) : '——'

  // Calcula cambio porcentual (mock: +/- aleatorio pequeño para demo)
  const priceDiff  = currentPrice && pairConfig ? currentPrice - pairConfig.base : 0
  const pricePct   = pairConfig && pairConfig.base ? ((priceDiff / pairConfig.base) * 100) : 0
  const priceUp    = priceDiff >= 0

  // Color del bias
  const biasColors = {
    CALL:    'text-call bg-call/10 border-call/30',
    PUT:     'text-put  bg-put/10  border-put/30',
    NEUTRAL: 'text-muted bg-surface border-border',
  }

  return (
    <header className="h-12 bg-[#131722] border-b border-border flex items-center
                       px-3 gap-1 flex-shrink-0 select-none" style={{ zIndex: 20 }}>

      {/* ── Logo ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mr-2 flex-shrink-0">
        <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
          <TrendingUp size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-[13px] font-extrabold text-text-primary tracking-tight hidden sm:block">
          FX Signal
        </span>
      </div>

      {/* ── Divisor ───────────────────────────────────────── */}
      <div className="w-px h-6 bg-border mx-1" />

      {/* ── Par activo ──────────────────────────────────────── */}
      <PairSelector activePair={activePair} onChange={setActivePair} />

      {/* ── Precio + cambio % ───────────────────────────────── */}
      <div className="flex items-baseline gap-2 ml-1">
        <span className="text-[15px] font-mono font-bold text-text-primary tracking-tight">
          {formattedPrice}
        </span>
        <span className={`text-[11px] font-semibold ${priceUp ? 'text-call' : 'text-put'}`}>
          {priceUp ? '+' : ''}{priceDiff.toFixed(decimals)} ({priceUp ? '+' : ''}{pricePct.toFixed(2)}%)
        </span>
      </div>

      {/* ── Divisor ───────────────────────────────────────── */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* ── Timeframes ──────────────────────────────────────── */}
      <div className="flex items-center gap-0.5">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setActiveTF(tf)}
            className={`px-2.5 py-1 text-[12px] font-bold rounded transition-colors
                        ${activeTF === tf
                          ? 'bg-accent text-white'
                          : 'text-muted hover:text-text-primary hover:bg-surface'}`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* ── Divisor ───────────────────────────────────────── */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* ── Tipo de chart ───────────────────────────────────── */}
      <ChartTypeSelector chartType={chartType} onChange={setChartType} />

      {/* ── Indicadores overlay ─────────────────────────────── */}
      <IndicatorsButton />

      {/* ── Spacer flexible ─────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Badge bias compuesto ─────────────────────────────── */}
      {compositeBias !== 'NEUTRAL' && (
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-md border text-[11px] font-extrabold
                         tracking-wider transition-all ${biasColors[compositeBias] || biasColors.NEUTRAL}`}>
          <Activity size={11} />
          {compositeBias} {compositeScore}%
        </div>
      )}

      {/* ── Divisor ───────────────────────────────────────── */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* ── Estado de conexión ──────────────────────────────── */}
      <div className={`flex items-center gap-1.5 text-[11px] flex-shrink-0
                       ${isConnected || !isCrypto ? 'text-call' : 'text-muted'}`}>
        {isConnected || !isCrypto ? <Wifi size={13} /> : <WifiOff size={13} />}
        <span className="hidden md:inline">
          {isCrypto
            ? (isConnected ? 'Binance Live' : 'Conectando...')
            : 'Forex: simulado'}
        </span>
      </div>

      {/* ── Botones de acción ───────────────────────────────── */}
      <div className="flex items-center gap-1 ml-2">
        <button
          title="Configuración"
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted
                     hover:text-text-primary hover:bg-surface transition-colors"
        >
          <Settings2 size={14} />
        </button>
      </div>
    </header>
  )
}
