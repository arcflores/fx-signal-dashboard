// ─────────────────────────────────────────────────────────────
// Watchlist.jsx — Panel lateral izquierdo con todos los pares
// Muestra precio, cambio porcentual y sesgo compuesto (CALL/PUT)
// de cada par. Al hacer clic cambia el par activo en el store.
// ─────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import useStore from '../store/useStore'
import { getInitialWatchlistData, PAIR_CONFIG, FOREX_PAIRS, CRYPTO_PAIRS, BINANCE_SYMBOLS } from '../utils/mockForex'

// ── Hook interno: simula actualizaciones de precio en tiempo real ──
// Para los pares Forex (mock data) actualiza los precios cada ~2 segundos
// simulando el "tick" del mercado. Para crypto, el price viene del store.
function useWatchlistPrices() {
  const { activePair, candleData } = useStore()

  // Estado local: datos de cada par para la watchlist
  // Incluye Forex (de getInitialWatchlistData) + Crypto con precios base
  const [watchData, setWatchData] = useState(() => {
    const forex  = getInitialWatchlistData()
    const crypto = Object.keys(BINANCE_SYMBOLS).map(pair => ({
      pair,
      price:  pair.startsWith('BTC') ? '94500.00' : pair.startsWith('ETH') ? '3280.00' : '185.00',
      change: '+0.00%',
      up:     true,
    }))
    return [...forex, ...crypto]
  })

  // Actualizamos Forex con pequeñas variaciones aleatorias (simula tick)
  useEffect(() => {
    const interval = setInterval(() => {
      setWatchData(prev => prev.map(item => {
        // Solo actualizamos forex; los precios crypto vienen del store
        if (!FOREX_PAIRS.includes(item.pair)) return item

        const config = PAIR_CONFIG[item.pair]
        if (!config) return item

        // Variación pequeña: ±3 pips aleatoria
        const variation = (Math.random() - 0.5) * config.pip * 6
        const newPrice  = parseFloat(item.price) + variation
        const change    = newPrice - config.base
        const changePct = (change / config.base * 100)

        return {
          ...item,
          price:  newPrice.toFixed(config.decimals),
          change: changePct >= 0
            ? `+${changePct.toFixed(2)}%`
            : `${changePct.toFixed(2)}%`,
          up: changePct >= 0,
        }
      }))
    }, 2000) // Actualiza cada 2 segundos

    return () => clearInterval(interval)
  }, [])

  // Actualizamos precio de pares crypto desde el store (dato real de Binance)
  useEffect(() => {
    CRYPTO_PAIRS.forEach(pair => {
      const key = `${pair}_${useStore.getState().activeTF}`
      const candles = candleData[key]
      if (candles && candles.length > 0) {
        const lastCandle  = candles[candles.length - 1]
        const firstCandle = candles[0]
        const change      = ((lastCandle.close - firstCandle.open) / firstCandle.open * 100)
        setWatchData(prev => prev.map(item =>
          item.pair === pair
            ? {
                ...item,
                price:  lastCandle.close.toFixed(2),
                change: change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`,
                up:     change >= 0,
              }
            : item
        ))
      }
    })
  }, [candleData])

  return watchData
}

// ── Componente de fila de par ────────────────────────────────
// Renderiza una fila de la watchlist con precio y % de cambio.
function WatchlistRow({ item, isActive, onClick, bias }) {
  // Colores de bias
  const biasConfig = {
    CALL:    { bg: 'bg-call/10', text: 'text-call', label: 'C' },
    PUT:     { bg: 'bg-put/10',  text: 'text-put',  label: 'P' },
    NEUTRAL: { bg: 'bg-surface', text: 'text-muted', label: '—' },
  }
  const b = biasConfig[bias] || biasConfig.NEUTRAL

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2.5 gap-2 hover:bg-surface/80 transition-colors
                  border-b border-border/50 text-left group
                  ${isActive ? 'bg-surface border-l-2 border-l-accent' : 'border-l-2 border-l-transparent'}`}
    >
      {/* Nombre del par */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate
                         ${isActive ? 'text-accent' : 'text-text-primary'}`}>
          {item.pair}
        </div>
        {/* Precio actual */}
        <div className="text-xs font-mono text-text-secondary mt-0.5 truncate">
          {item.price}
        </div>
      </div>

      {/* Cambio % y badge de bias */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        {/* Porcentaje de cambio con flecha */}
        <div className={`flex items-center gap-0.5 text-xs font-medium
                         ${item.up ? 'text-call' : 'text-put'}`}>
          {item.up
            ? <TrendingUp size={10} />
            : <TrendingDown size={10} />
          }
          <span className="font-mono text-[10px]">{item.change}</span>
        </div>

        {/* Badge de sesgo CALL/PUT/NEUTRAL */}
        <div className={`w-5 h-4 rounded flex items-center justify-center text-[9px] font-bold
                         ${b.bg} ${b.text}`}>
          {b.label}
        </div>
      </div>
    </button>
  )
}

// ── Componente principal Watchlist ───────────────────────────
export default function Watchlist() {
  const { activePair, setActivePair, signals, compositeBias } = useStore()
  const watchData = useWatchlistPrices()

  // Mapeamos cada par a su sesgo calculado
  // En esta versión, el sesgo calculado corresponde solo al par activo.
  // En una versión futura, cada par tendría su propio cálculo independiente.
  const getBias = (pair) => pair === activePair ? compositeBias : 'NEUTRAL'

  return (
    <aside className="bg-bg border-r border-border flex flex-col flex-shrink-0 overflow-hidden" style={{ width: '130px' }}>
      {/* ── Cabecera del panel ───────────────────────────── */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">
          Watchlist
        </span>
      </div>

      {/* ── Sección Forex ────────────────────────────────── */}
      <div className="flex-shrink-0">
        <div className="px-3 py-1 bg-surface/50">
          <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Forex</span>
        </div>
        {watchData
          .filter(item => FOREX_PAIRS.includes(item.pair))
          .map(item => (
            <WatchlistRow
              key={item.pair}
              item={item}
              isActive={activePair === item.pair}
              onClick={() => setActivePair(item.pair)}
              bias={getBias(item.pair)}
            />
          ))
        }
      </div>

      {/* ── Sección Crypto ───────────────────────────────── */}
      <div className="flex-shrink-0">
        <div className="px-3 py-1 bg-surface/50 border-t border-border">
          <span className="text-[9px] font-bold text-muted uppercase tracking-widest">Crypto</span>
        </div>
        {watchData
          .filter(item => CRYPTO_PAIRS.includes(item.pair))
          .map(item => (
            <WatchlistRow
              key={item.pair}
              item={item}
              isActive={activePair === item.pair}
              onClick={() => setActivePair(item.pair)}
              bias={getBias(item.pair)}
            />
          ))
        }
      </div>

      {/* ── Espaciador inferior ──────────────────────────── */}
      <div className="flex-1" />

      {/* ── Footer: nota de datos mock ───────────────────── */}
      <div className="px-3 py-2 border-t border-border flex-shrink-0">
        <p className="text-[9px] text-muted text-center leading-tight">
          Forex: datos simulados<br />
          Crypto: Binance Live
        </p>
      </div>
    </aside>
  )
}
