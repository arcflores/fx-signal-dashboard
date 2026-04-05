// ─────────────────────────────────────────────────────────────
// useForexMock.js — Simulador de datos Forex en tiempo real
// Tick cada 500ms para animación fluida (como broker real).
// Usa random walk con reversión a la media para movimientos realistas.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import { FOREX_PAIRS, PAIR_CONFIG } from '../utils/mockForex'

// Duración de cada timeframe en segundos
const TF_SECONDS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '1h': 3600 }

// Tick cada 500ms — animación fluida como un broker real
const TICK_MS = 500

// Precios vivos por par (cache local, más eficiente que leer el store en cada tick)
const livePrices = {}

// ── Genera un movimiento de precio realista ───────────────────
// Random walk + reversión a la media + factor de sesión de trading
function nextPrice(pair, current) {
  const config = PAIR_CONFIG[pair]
  if (!config) return current

  const pip      = config.pip
  const volPips  = pip * (config.volatility || 3)

  // Sesión de trading activa = más volatilidad (Londres 08-17 UTC / NY 13-22 UTC)
  const hour     = new Date().getUTCHours()
  const active   = (hour >= 8 && hour <= 22)
  const sessMult = active ? 1.5 : 0.5

  // Reversión a la media: evita que el precio se aleje demasiado del base
  const deviation    = current - config.base
  const maxDev       = pip * 100
  const meanRev      = (deviation / maxDev) * -0.2 * volPips

  // Movimiento aleatorio + reversión
  const move  = (Math.random() - 0.5) * 2 * volPips * sessMult + meanRev
  return parseFloat((current + move).toFixed(config.decimals))
}

export default function useForexMock() {
  const { activePair, activeTF, appendCandle, setCurrentPrice } = useStore()
  const tickRef = useRef(null)

  // ── Inicialización de precios vivos desde el store pre-seeded ──
  // El store ya tiene 150 velas históricas (pre-seeded en useStore.js).
  // Aquí solo inicializamos el cache local 'livePrices' desde esas velas,
  // para que el primer tick continúe exactamente desde el último close histórico.
  useEffect(() => {
    FOREX_PAIRS.forEach(pair => {
      const config = PAIR_CONFIG[pair]
      // Para cada par, tomamos el último close de cualquier TF (todos parten del mismo precio)
      const key5m  = `${pair}_5m`
      const candles = useStore.getState().candleData[key5m]
      if (candles && candles.length > 0) {
        livePrices[pair] = candles[candles.length - 1].close
      } else {
        livePrices[pair] = config?.base ?? 1.0
      }
    })
  }, []) // Solo una vez al montar — el store ya tiene los datos

  // ── Tick en tiempo real: solo para el par Forex activo ────────
  // Crypto usa Binance WebSocket (useBinanceWS.js)
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (!FOREX_PAIRS.includes(activePair)) return

    const tfSec = TF_SECONDS[activeTF] || 300
    const key   = `${activePair}_${activeTF}`

    const tick = () => {
      // Precio actual → nuevo precio con movimiento realista
      const current  = livePrices[activePair] ?? PAIR_CONFIG[activePair]?.base ?? 1.0
      const newPrice = nextPrice(activePair, current)
      livePrices[activePair] = newPrice

      // Timestamp de inicio de la vela actual (redondeado al TF)
      const now         = Math.floor(Date.now() / 1000)
      const candleStart = Math.floor(now / tfSec) * tfSec

      const candles    = useStore.getState().candleData[key] || []
      const last       = candles[candles.length - 1]
      if (!last) return

      if (last.time === candleStart) {
        // Misma vela: actualizamos close, high y low en tiempo real
        appendCandle(key, {
          time:  candleStart,
          open:  last.open,
          high:  Math.max(last.high, newPrice),
          low:   Math.min(last.low,  newPrice),
          close: newPrice,
        })
      } else {
        // Nueva vela: open = close anterior (sin gaps)
        appendCandle(key, {
          time:  candleStart,
          open:  last.close,
          high:  Math.max(last.close, newPrice),
          low:   Math.min(last.close, newPrice),
          close: newPrice,
        })
      }

      setCurrentPrice(newPrice)
    }

    tick() // primer tick inmediato
    tickRef.current = setInterval(tick, TICK_MS)
    return () => clearInterval(tickRef.current)
  }, [activePair, activeTF, appendCandle, setCurrentPrice])
}
