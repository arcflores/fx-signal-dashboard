// ─────────────────────────────────────────────────────────────
// useSignals.js — Hook que calcula todos los indicadores técnicos
// Se ejecuta cada vez que cambian las velas del par activo.
// Calcula RSI, MACD, Bollinger, EMA, Stochastic, Fibonacci
// y actualiza el store con los resultados.
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import useStore from '../store/useStore'
import {
  calculateRSI,
  calculateEMA,
  calculateMACD,
  calculateBollinger,
  calculateStochastic,
  calculateFibonacci,
  getSignalForIndicator,
  calculateCompositeScore,
} from '../utils/indicators'

// Pesos de cada indicador en el score compuesto
// (mayor peso = más influencia en la señal final)
const INDICATOR_WEIGHTS = {
  rsi:       2,  // RSI: confiable para detectar extremos
  macd:      2,  // MACD: confirmación de tendencia
  bollinger: 1,  // Bollinger: volatilidad y posición relativa
  ema:       2,  // EMA cross: tendencia de corto/medio plazo
  stoch:     1,  // Stochastic: oscilador de momentum
  candles:   2,  // Patrones de velas (detectados heurísticamente)
  fibonacci: 1,  // Cercanía a nivel de Fibonacci relevante
  volume:    1,  // Tendencia del volumen
}

export default function useSignals() {
  const { activePair, activeTF, candleData, setIndicators, setSignals } = useStore()

  useEffect(() => {
    const key = `${activePair}_${activeTF}`
    const candles = candleData[key]

    // Necesitamos al menos 50 velas para calcular indicadores fiables
    if (!candles || candles.length < 50) return

    // Extraemos arrays de precios para los cálculos
    const closes = candles.map(c => c.close)
    const highs   = candles.map(c => c.high)
    const lows    = candles.map(c => c.low)
    const volumes = candles.map(c => c.volume || 0)
    const currentPrice = closes[closes.length - 1]

    // ── Calcular todos los indicadores ────────────────────────
    const rsi       = calculateRSI(closes)
    const macd      = calculateMACD(closes)
    const bollinger = calculateBollinger(closes)
    const ema20     = calculateEMA(closes, 20)
    const ema50     = calculateEMA(closes, 50)
    const stoch     = calculateStochastic(highs, lows, closes)
    const fibonacci = calculateFibonacci(highs, lows)

    // Guardamos los indicadores calculados en el store
    setIndicators({ rsi, macd, bollinger, ema20, ema50, stoch, fibonacci })

    // ── Construir señales individuales ────────────────────────
    // Cada señal tiene: nombre, valor display, señal (call/put/neutral), peso

    const signalRSI = getSignalForIndicator('rsi', rsi, currentPrice, null)
    const signalMACD = getSignalForIndicator('macd', macd, currentPrice, null)
    const signalBB   = getSignalForIndicator('bollinger', currentPrice, currentPrice, bollinger)
    const signalEMA  = getSignalForIndicator('ema', { ema20, ema50 }, currentPrice, null)
    const signalST   = getSignalForIndicator('stoch', stoch, currentPrice, null)

    // Señal de velas japonesas: detecta engulfing simple comparando las últimas 2 velas
    const lastCandle  = candles[candles.length - 1]
    const prevCandle  = candles[candles.length - 2]
    let signalCandles = 'neutral'
    let candlePattern = 'Sin patrón claro'
    if (prevCandle && lastCandle) {
      const prevBull = prevCandle.close > prevCandle.open
      const lastBull = lastCandle.close > lastCandle.open
      // Engulfing alcista: vela roja seguida de vela verde que la "engulla"
      if (!prevBull && lastBull && lastCandle.close > prevCandle.open && lastCandle.open < prevCandle.close) {
        signalCandles = 'call'
        candlePattern = 'Engulfing alcista ↑'
      }
      // Engulfing bajista: vela verde seguida de vela roja que la "engulla"
      else if (prevBull && !lastBull && lastCandle.close < prevCandle.open && lastCandle.open > prevCandle.close) {
        signalCandles = 'put'
        candlePattern = 'Engulfing bajista ↓'
      }
      // Pin bar alcista: sombra inferior larga, cuerpo pequeño arriba
      else if ((lastCandle.close - lastCandle.open) < (lastCandle.open - lastCandle.low) * 0.3) {
        signalCandles = 'call'
        candlePattern = 'Pin bar alcista'
      }
      // Pin bar bajista: sombra superior larga, cuerpo pequeño abajo
      else if ((lastCandle.open - lastCandle.close) < (lastCandle.high - lastCandle.open) * 0.3) {
        signalCandles = 'put'
        candlePattern = 'Pin bar bajista'
      }
    }

    // Señal de Fibonacci: ¿está el precio cerca de un nivel clave?
    let signalFib = 'neutral'
    let fibLabel  = 'Sin nivel activo'
    if (fibonacci) {
      const oteLevel = fibonacci.find(f => f.isOTE)
      if (oteLevel) {
        const distance = Math.abs(currentPrice - oteLevel.level)
        const pips     = distance / (highs[0] - lows[0]) * 100
        if (pips < 5) {
          signalFib = ema20 && ema50 && ema20 > ema50 ? 'call' : 'put'
          fibLabel  = `OTE 61.8% ${oteLevel.level.toFixed(5)}`
        }
      }
    }

    // Señal de volumen: el volumen aumenta en la última vela?
    let signalVolume = 'neutral'
    let volumeLabel  = 'Volumen normal'
    if (volumes.length >= 20) {
      const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      const lastVol = volumes[volumes.length - 1]
      if (lastVol > avgVol * 1.3) {
        // Volumen alto confirma la dirección del último candle
        signalVolume = lastCandle.close > lastCandle.open ? 'call' : 'put'
        volumeLabel  = `+${Math.round((lastVol / avgVol - 1) * 100)}% media`
      }
    }

    // ── Array final de señales ─────────────────────────────────
    const signals = [
      { name: 'RSI (14)',    value: rsi ? `${rsi}` : '—',      signal: signalRSI,     weight: INDICATOR_WEIGHTS.rsi       },
      { name: 'MACD',        value: macd ? (macd.bullish ? 'Alcista' : 'Bajista') : '—', signal: signalMACD, weight: INDICATOR_WEIGHTS.macd },
      { name: 'Bollinger',   value: bollinger ? (bollinger.upper - bollinger.lower).toFixed(5) + ' ancho' : '—', signal: signalBB, weight: INDICATOR_WEIGHTS.bollinger },
      { name: 'EMA 20/50',   value: ema20 && ema50 ? (ema20 > ema50 ? 'Cross alcista' : 'Cross bajista') : '—', signal: signalEMA, weight: INDICATOR_WEIGHTS.ema },
      { name: 'Stochastic',  value: stoch ? `%K ${stoch.k} / %D ${stoch.d}` : '—', signal: signalST, weight: INDICATOR_WEIGHTS.stoch },
      { name: 'Velas',       value: candlePattern, signal: signalCandles, weight: INDICATOR_WEIGHTS.candles },
      { name: 'Fibonacci',   value: fibLabel,       signal: signalFib,    weight: INDICATOR_WEIGHTS.fibonacci },
      { name: 'Volumen',     value: volumeLabel,    signal: signalVolume, weight: INDICATOR_WEIGHTS.volume  },
    ]

    // Calculamos el score compuesto y el bias final
    const { score, bias } = calculateCompositeScore(signals)
    setSignals(signals, score, bias)

  // Se recalcula cada vez que llega una vela nueva
  }, [candleData, activePair, activeTF, setIndicators, setSignals])
}
