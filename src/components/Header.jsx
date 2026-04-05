// ─────────────────────────────────────────────────────────────
// Header.jsx — Barra de navegación superior
// Muestra: logo, par activo con precio en tiempo real,
// selectores de par y timeframe, y badge de conexión a datos.
// ─────────────────────────────────────────────────────────────
import { TrendingUp, Wifi, WifiOff, ChevronDown } from 'lucide-react'
import useStore from '../store/useStore'
import {
  ALL_PAIRS,
  FOREX_PAIRS,
  CRYPTO_PAIRS,
  TIMEFRAMES,
  PAIR_CONFIG,
} from '../utils/mockForex'

// ── Componente de selector de par ────────────────────────────
// Muestra un dropdown con todos los pares agrupados por tipo.
function PairSelector({ activePair, onChange }) {
  return (
    <div className="relative group">
      {/* Botón que muestra el par activo */}
      <button className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg
                         text-sm font-medium hover:border-accent transition-colors cursor-pointer">
        <span className="text-text-primary">{activePair}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>

      {/* Dropdown con todos los pares disponibles */}
      <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-border rounded-lg
                      shadow-2xl z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible
                      transition-all duration-150">

        {/* Grupo: Forex */}
        <div className="px-3 py-1.5 text-xs text-muted font-semibold uppercase tracking-wider border-b border-border">
          Forex
        </div>
        {FOREX_PAIRS.map(pair => (
          <button
            key={pair}
            onClick={() => onChange(pair)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-bg transition-colors
                        ${activePair === pair ? 'text-accent' : 'text-text-primary'}`}
          >
            {pair}
          </button>
        ))}

        {/* Grupo: Crypto */}
        <div className="px-3 py-1.5 text-xs text-muted font-semibold uppercase tracking-wider
                        border-t border-b border-border">
          Crypto
        </div>
        {CRYPTO_PAIRS.map(pair => (
          <button
            key={pair}
            onClick={() => onChange(pair)}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-bg transition-colors
                        ${activePair === pair ? 'text-accent' : 'text-text-primary'}`}
          >
            {pair}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Componente de selector de timeframe ──────────────────────
// Muestra botones para cada timeframe disponible.
function TFSelector({ activeTF, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
      {TIMEFRAMES.map(tf => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors
                      ${activeTF === tf
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-text-primary'}`}
        >
          {tf}
        </button>
      ))}
    </div>
  )
}

// ── Componente principal del Header ──────────────────────────
export default function Header({ isConnected }) {
  // Extraemos estado y acciones del store global
  const {
    activePair,
    activeTF,
    currentPrice,
    compositeBias,
    compositeScore,
    setActivePair,
    setActiveTF,
  } = useStore()

  // Determinamos si el par activo usa datos reales (crypto) o mock (forex)
  const isCrypto = CRYPTO_PAIRS.includes(activePair)

  // Obtenemos la configuración del par para formatear el precio correctamente
  const pairConfig = PAIR_CONFIG[activePair]
  const decimals   = pairConfig?.decimals ?? 5

  // Formateamos el precio con los decimales correctos para cada par
  const formattedPrice = currentPrice
    ? currentPrice.toFixed(decimals)
    : '—'

  // Color y texto del badge de sesgo compuesto
  const biasColor = compositeBias === 'CALL'
    ? 'text-call bg-call/10 border-call/30'
    : compositeBias === 'PUT'
    ? 'text-put bg-put/10 border-put/30'
    : 'text-muted bg-surface border-border'

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center px-4 gap-4 flex-shrink-0">

      {/* ── Logo y nombre de la app ───────────────────────── */}
      <div className="flex items-center gap-2 mr-2">
        <TrendingUp size={20} className="text-accent" />
        <span className="text-sm font-bold text-text-primary tracking-tight">FX Signal</span>
      </div>

      {/* ── Separador vertical ───────────────────────────── */}
      <div className="w-px h-6 bg-border" />

      {/* ── Selector de par activo ───────────────────────── */}
      <PairSelector activePair={activePair} onChange={setActivePair} />

      {/* ── Precio actual en tiempo real ─────────────────── */}
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-mono font-bold text-text-primary tracking-tight">
          {formattedPrice}
        </span>
      </div>

      {/* ── Selector de timeframe ─────────────────────────── */}
      <TFSelector activeTF={activeTF} onChange={setActiveTF} />

      {/* ── Espaciador flexible: empuja los elementos a la derecha ── */}
      <div className="flex-1" />

      {/* ── Badge de sesgo compuesto ─────────────────────── */}
      {compositeBias !== 'NEUTRAL' && (
        <div className={`px-3 py-1 rounded-md border text-xs font-bold tracking-wider ${biasColor}`}>
          {compositeBias} {compositeScore}%
        </div>
      )}

      {/* ── Indicador de conexión a datos ────────────────── */}
      <div className={`flex items-center gap-1.5 text-xs ${isConnected || !isCrypto ? 'text-call' : 'text-put'}`}>
        {isConnected || !isCrypto
          ? <Wifi size={14} />
          : <WifiOff size={14} />
        }
        <span className="hidden sm:inline">
          {isCrypto
            ? (isConnected ? 'Binance Live' : 'Conectando...')
            : 'Mock Data'}
        </span>
      </div>
    </header>
  )
}
