// ─────────────────────────────────────────────────────────────
// usePredictionScanner.js — Motor de predicción de mercado
//
// Escanea TODOS los pares × TODOS los timeframes cada N segundos.
// Por cada combinación, evalúa indicadores técnicos y genera
// predicciones tipo "orden virtual" con:
//   - Dirección: BUY / SELL
//   - Entry: precio de entrada sugerido
//   - Stop Loss: basado en ATR × multiplicador
//   - Take Profit: basado en Risk:Reward configurable
//   - Confidence: 0-100% según convergencia de indicadores
//   - Rationale: razones que soportan la predicción
//
// Cuando el precio alcanza el entry de una predicción PENDING,
// se marca como TRIGGERED y comienza a monitorear SL/TP.
// Al cerrar (WIN/LOSS), auto-escanea para generar la siguiente.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import {
  calculateRSI, calculateEMA, calculateMACD,
  calculateBollinger, calculateStochastic,
} from '../utils/indicators'
import { ALL_PAIRS, PAIR_CONFIG, BINANCE_SYMBOLS, TIMEFRAMES } from '../utils/mockForex'

// ── Configuración del scanner ────────────────────────────────
const SCAN_INTERVAL_MS   = 8000   // Cada 8 segundos
const MONITOR_INTERVAL   = 1000   // Monitor de órdenes cada 1s
const MAX_PREDICTIONS    = 8      // Máx predicciones activas simultáneas
const MIN_CONFIDENCE     = 60     // % mínimo para generar predicción
const RR_RATIO           = 2.0    // Risk:Reward → TP = SL × 2
const ATR_SL_MULTIPLIER  = 1.5    // SL = ATR × 1.5
const SCAN_TIMEFRAMES    = ['5m', '15m', '1h'] // TFs a escanear

// ── Cálculo de ATR (Average True Range) ──────────────────────
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) return 0
  let atr = 0
  for (let i = 1; i <= period; i++) {
    const c = candles[candles.length - i]
    const p = candles[candles.length - i - 1]
    if (!c || !p) return 0
    const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close))
    atr += tr
  }
  return atr / period
}

// ── Evalúa un par/TF y retorna predicción o null ─────────────
function evaluatePair(pair, tf) {
  const key     = `${pair}_${tf}`
  const candles = useStore.getState().candleData[key]
  if (!candles || candles.length < 60) return null

  const closes = candles.map(c => c.close)
  const highs  = candles.map(c => c.high)
  const lows   = candles.map(c => c.low)
  const last   = candles[candles.length - 1]
  const config = PAIR_CONFIG[pair] || { decimals: 5, pip: 0.0001 }

  // ── Calcular indicadores ───────────────────────────────
  const rsi  = calculateRSI(closes)
  const macd = calculateMACD(closes)
  const bb   = calculateBollinger(closes)
  const ema20 = calculateEMA(closes, 20)
  const ema50 = calculateEMA(closes, 50)
  const stoch = calculateStochastic(highs, lows, closes)
  const atr  = calculateATR(candles)

  if (rsi == null || macd == null || bb == null || atr <= 0) return null

  // ── Sistema de puntuación multi-indicador ──────────────
  let score   = 0  // positivo = BUY, negativo = SELL
  const reasons = []

  // RSI
  if (rsi < 30)      { score += 3; reasons.push(`RSI ${rsi.toFixed(0)} sobrevendido`) }
  else if (rsi < 40) { score += 1; reasons.push(`RSI ${rsi.toFixed(0)} bajo`) }
  else if (rsi > 70) { score -= 3; reasons.push(`RSI ${rsi.toFixed(0)} sobrecomprado`) }
  else if (rsi > 60) { score -= 1; reasons.push(`RSI ${rsi.toFixed(0)} alto`) }

  // MACD
  if (macd.histogram > 0 && macd.bullish)   { score += 2; reasons.push('MACD cruce alcista') }
  if (macd.histogram < 0 && !macd.bullish)  { score -= 2; reasons.push('MACD cruce bajista') }

  // EMA cross
  if (ema20 > ema50)       { score += 1; reasons.push(`EMA20 > EMA50`) }
  else if (ema20 < ema50)  { score -= 1; reasons.push(`EMA20 < EMA50`) }

  // Price vs EMAs
  if (last.close > ema20 && last.close > ema50) { score += 1; reasons.push('Precio sobre EMAs') }
  if (last.close < ema20 && last.close < ema50) { score -= 1; reasons.push('Precio bajo EMAs') }

  // Bollinger
  if (bb.lower && last.close <= bb.lower)   { score += 2; reasons.push('Tocando BB inferior') }
  if (bb.upper && last.close >= bb.upper)   { score -= 2; reasons.push('Tocando BB superior') }

  // Stochastic
  if (stoch) {
    if (stoch.k < 20 && stoch.d < 20)      { score += 2; reasons.push(`Stoch ${stoch.k.toFixed(0)} sobrevendido`) }
    if (stoch.k > 80 && stoch.d > 80)      { score -= 2; reasons.push(`Stoch ${stoch.k.toFixed(0)} sobrecomprado`) }
  }

  // Momentum: últimas 3 velas
  const recentCloses = closes.slice(-4)
  const momentum = recentCloses[3] - recentCloses[0]
  if (momentum > 0 && score > 0)      { score += 1; reasons.push('Momentum alcista') }
  if (momentum < 0 && score < 0)      { score += -1; /* already negative = stronger sell */ }

  // ── Filtro de convicción ───────────────────────────────
  const absScore   = Math.abs(score)
  const confidence = Math.min(95, 45 + absScore * 7)
  if (confidence < MIN_CONFIDENCE) return null

  // ── Dirección y niveles ────────────────────────────────
  const direction = score > 0 ? 'BUY' : 'SELL'
  const entry     = last.close
  const decimals  = config.decimals ?? 5

  const slDistance = atr * ATR_SL_MULTIPLIER
  const tpDistance = slDistance * RR_RATIO

  const sl = direction === 'BUY'
    ? parseFloat((entry - slDistance).toFixed(decimals))
    : parseFloat((entry + slDistance).toFixed(decimals))
  const tp = direction === 'BUY'
    ? parseFloat((entry + tpDistance).toFixed(decimals))
    : parseFloat((entry - tpDistance).toFixed(decimals))

  // Pips de riesgo y ganancia
  const pip = config.pip ?? 0.0001
  const riskPips   = Math.round(slDistance / pip)
  const rewardPips = Math.round(tpDistance / pip)

  return {
    id:         `${pair}_${tf}_${Date.now()}`,
    pair,
    tf,
    direction,
    entry:      parseFloat(entry.toFixed(decimals)),
    sl,
    tp,
    confidence,
    reasons,
    riskPips,
    rewardPips,
    rr:         RR_RATIO,
    status:     'PENDING',  // PENDING → TRIGGERED → WIN | LOSS | EXPIRED
    createdAt:  Date.now(),
    triggeredAt: null,
    closedAt:   null,
    currentPx:  entry,      // actualizado en tiempo real
  }
}

// ── Hook principal ───────────────────────────────────────────
export default function usePredictionScanner() {
  const predictionsRef = useRef([])
  const { setPredictions } = useStore()

  // ── Función de escaneo completo ────────────────────────
  const runScan = useCallback(() => {
    const current = predictionsRef.current
    const pendingCount = current.filter(p => p.status === 'PENDING' || p.status === 'TRIGGERED').length
    if (pendingCount >= MAX_PREDICTIONS) return // Ya tenemos suficientes

    const candidates = []

    // Escanear todos los pares en los TFs configurados
    const allPairs = ALL_PAIRS
    for (const pair of allPairs) {
      for (const tf of SCAN_TIMEFRAMES) {
        // No duplicar par+TF si ya hay predicción activa
        const exists = current.some(p =>
          p.pair === pair && p.tf === tf &&
          (p.status === 'PENDING' || p.status === 'TRIGGERED')
        )
        if (exists) continue

        const pred = evaluatePair(pair, tf)
        if (pred) candidates.push(pred)
      }
    }

    // Ordenar por confianza descendente y tomar los que faltan
    candidates.sort((a, b) => b.confidence - a.confidence)
    const needed = MAX_PREDICTIONS - pendingCount
    const newPreds = candidates.slice(0, needed)

    if (newPreds.length > 0) {
      const updated = [...newPreds, ...current].slice(0, 30) // mantener historial de 30
      predictionsRef.current = updated
      setPredictions(updated)
    }
  }, [setPredictions])

  // ── Monitoreo de órdenes activas ───────────────────────
  const monitorOrders = useCallback(() => {
    const preds = predictionsRef.current
    let changed = false

    const updated = preds.map(pred => {
      if (pred.status !== 'PENDING' && pred.status !== 'TRIGGERED') return pred

      // Obtener precio actual del par
      const key     = `${pred.pair}_${pred.tf}`
      const candles = useStore.getState().candleData[key]
      if (!candles || candles.length === 0) return pred

      const currentPx = candles[candles.length - 1].close
      const newPred   = { ...pred, currentPx }

      // ── PENDING → TRIGGERED (precio alcanzó entry) ─────
      if (pred.status === 'PENDING') {
        const pxHitEntry = pred.direction === 'BUY'
          ? currentPx <= pred.entry  // para BUY, esperamos que baje al entry o ya está ahí
          : currentPx >= pred.entry  // para SELL, esperamos que suba al entry
        // En realidad, como entry ≈ precio actual, se triggerea casi inmediatamente
        // Lo simulamos con un pequeño delay desde creación (3-15 seg)
        const elapsed = Date.now() - pred.createdAt
        if (elapsed > 3000 + Math.random() * 12000) {
          newPred.status      = 'TRIGGERED'
          newPred.triggeredAt = Date.now()
          changed = true
        }
      }

      // ── TRIGGERED → WIN/LOSS (precio alcanzó TP o SL) ──
      if (pred.status === 'TRIGGERED') {
        if (pred.direction === 'BUY') {
          if (currentPx >= pred.tp) {
            newPred.status   = 'WIN'
            newPred.closedAt = Date.now()
            changed = true
          } else if (currentPx <= pred.sl) {
            newPred.status   = 'LOSS'
            newPred.closedAt = Date.now()
            changed = true
          }
        } else { // SELL
          if (currentPx <= pred.tp) {
            newPred.status   = 'WIN'
            newPred.closedAt = Date.now()
            changed = true
          } else if (currentPx >= pred.sl) {
            newPred.status   = 'LOSS'
            newPred.closedAt = Date.now()
            changed = true
          }
        }

        // Expirar si lleva mucho tiempo (5 min para TF cortos, 30 min para largos)
        const maxAge = pred.tf === '5m' ? 5 * 60000 : pred.tf === '15m' ? 15 * 60000 : 60 * 60000
        if (pred.triggeredAt && (Date.now() - pred.triggeredAt > maxAge) && pred.status === 'TRIGGERED') {
          newPred.status   = 'EXPIRED'
          newPred.closedAt = Date.now()
          changed = true
        }
      }

      return newPred
    })

    if (changed) {
      predictionsRef.current = updated
      setPredictions(updated)
      // Si alguna orden se cerró, triggerea nuevo escaneo
      runScan()
    }
  }, [setPredictions, runScan])

  // ── Intervalos ─────────────────────────────────────────
  useEffect(() => {
    // Escaneo inicial después de que los datos se carguen
    const initialDelay = setTimeout(runScan, 2000)

    const scanId    = setInterval(runScan, SCAN_INTERVAL_MS)
    const monitorId = setInterval(monitorOrders, MONITOR_INTERVAL)

    return () => {
      clearTimeout(initialDelay)
      clearInterval(scanId)
      clearInterval(monitorId)
    }
  }, [runScan, monitorOrders])
}
