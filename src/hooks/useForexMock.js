// ─────────────────────────────────────────────────────────────
// useForexMock.js — Hook que simula datos Forex en tiempo real
// Mientras OANDA API no esté conectada, este hook:
//   1. Carga velas históricas iniciales para cada par Forex
//   2. Genera nuevas velas cada N segundos simulando el mercado
//   3. Actualiza el precio actual del par activo en el store
//
// Para conectar OANDA real: reemplazar este hook por useOandaWS.js
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import {
  FOREX_PAIRS,
  PAIR_CONFIG,
  generateHistoricalCandles,
  generateNewCandle,
  TIMEFRAMES,
} from '../utils/mockForex'

// Mapeamos cada timeframe a su duración en minutos
const TF_MINUTES = {
  '1m':  1,
  '3m':  3,
  '5m':  5,
  '15m': 15,
  '1h':  60,
}

// Intervalo de tick (en ms) para simular el mercado
// Usamos un intervalo rápido para demostración visual
const TICK_INTERVAL_MS = 3000 // Actualiza cada 3 segundos

export default function useForexMock() {
  const { activePair, activeTF, setCandles, appendCandle, setCurrentPrice } = useStore()
  const tickRef = useRef(null) // Referencia al intervalo de tick

  // ── Paso 1: Carga inicial de velas históricas ─────────────
  // Al montar, generamos datos históricos para todos los pares Forex
  // y todos los timeframes. Esto rellena el chart desde el primer render.
  useEffect(() => {
    FOREX_PAIRS.forEach(pair => {
      TIMEFRAMES.forEach(tf => {
        const minutes  = TF_MINUTES[tf] || 1
        // Generamos 100 velas históricas para cada combinación par+TF
        const candles  = generateHistoricalCandles(pair, 100, minutes)
        const key      = `${pair}_${tf}`
        setCandles(key, candles)
      })
    })
  }, [setCandles]) // Solo se ejecuta una vez al montar

  // ── Paso 2: Simulación de tick en tiempo real ─────────────
  // Generamos nuevas velas periódicamente para el par/TF activo.
  // Si el par no es Forex, detenemos el tick (lo maneja Binance WS).
  useEffect(() => {
    // Limpiamos intervalo anterior si existe
    if (tickRef.current) clearInterval(tickRef.current)

    // Solo simulamos si el par activo es Forex (no crypto)
    if (!FOREX_PAIRS.includes(activePair)) return

    const minutes  = TF_MINUTES[activeTF] || 1
    const key      = `${activePair}_${activeTF}`

    // Función de tick: genera una nueva vela basada en la última
    const tick = () => {
      const state = useStore.getState()
      const candles = state.candleData[key] || []
      if (candles.length === 0) return

      const lastCandle  = candles[candles.length - 1]
      const now         = Math.floor(Date.now() / 1000)
      const candleStart = Math.floor(now / (minutes * 60)) * (minutes * 60)

      // Si estamos dentro del mismo intervalo de vela: actualizamos la vela actual
      if (candleStart === lastCandle.time) {
        const config    = PAIR_CONFIG[activePair]
        const variation = (Math.random() - 0.5) * config.pip * 4
        const newClose  = parseFloat((lastCandle.close + variation).toFixed(config.decimals))
        const updatedCandle = {
          ...lastCandle,
          close: newClose,
          high:  Math.max(lastCandle.high, newClose),
          low:   Math.min(lastCandle.low, newClose),
        }
        appendCandle(key, updatedCandle)
        setCurrentPrice(newClose)
      } else {
        // Si es una nueva vela: la generamos a partir del precio anterior
        const newCandle = generateNewCandle(activePair, lastCandle.close, candleStart, minutes)
        if (newCandle) {
          appendCandle(key, newCandle)
          setCurrentPrice(newCandle.close)
        }
      }
    }

    // Ejecutamos el primer tick inmediatamente
    tick()

    // Luego ejecutamos cada TICK_INTERVAL_MS milisegundos
    tickRef.current = setInterval(tick, TICK_INTERVAL_MS)

    // Cleanup: limpiamos el intervalo al cambiar de par/TF
    return () => {
      if (tickRef.current) clearInterval(tickRef.current)
    }
  }, [activePair, activeTF, appendCandle, setCurrentPrice])

  // Este hook no retorna nada; solo tiene efectos secundarios en el store
}
