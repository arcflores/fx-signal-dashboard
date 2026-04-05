// ─────────────────────────────────────────────────────────────
// useStore.js — Estado global de la app con Zustand
// Zustand es una librería minimalista de manejo de estado.
// Aquí guardamos todo lo que necesitan compartir los componentes:
// par activo, timeframe, velas, indicadores, veredicto Claude, historial.
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'
import { generateHistoricalCandles, FOREX_PAIRS, TIMEFRAMES } from '../utils/mockForex'

// ── Pre-seed SÍNCRONO de velas históricas ──────────────────
// CRÍTICO: Generamos las velas ANTES de que React renderice cualquier componente.
// Esto evita el problema de timing donde ChartPanel leía el store vacío:
// - ChartPanel (hijo) ejecuta useEffect → lee store → necesita datos
// - useForexMock (padre) ejecuta useEffect → siembra datos (demasiado tarde)
// Al pre-seedear aquí, el store ya tiene 150 velas cuando ChartPanel monta.
const TF_SECONDS = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '1h': 3600 }
const initialCandleData = {}
FOREX_PAIRS.forEach(pair => {
  TIMEFRAMES.forEach(tf => {
    const minutes = (TF_SECONDS[tf] || 300) / 60
    initialCandleData[`${pair}_${tf}`] = generateHistoricalCandles(pair, 150, minutes)
  })
})

const useStore = create((set, get) => ({

  // ── Estado: Par y timeframe activos ──────────────────────
  activePair: 'EUR/USD',
  activeTF:   '5m',

  // ── Estado: Datos de velas por par+timeframe ──────────────
  // Estructura: { 'EUR/USD_5m': [{ time, open, high, low, close }] }
  // Pre-seeded con 150 velas históricas por par/TF (ver arriba)
  candleData: initialCandleData,

  // ── Estado: Indicadores calculados del par/TF activo ──────
  indicators: {
    rsi:       null,   // Número 0-100
    macd:      null,   // { line, signal, histogram, bullish }
    bollinger: null,   // { upper, middle, lower, width }
    ema20:     null,   // Número (precio)
    ema50:     null,   // Número (precio)
    stoch:     null,   // { k, d }
    fibonacci: null,   // Array de niveles
  },

  // ── Estado: Señales individuales de cada indicador ────────
  // Array de { name, value, signal, weight }
  signals: [],
  compositeScore: 50,  // 0-100, 50 = neutral
  compositeBias: 'NEUTRAL', // 'CALL' | 'PUT' | 'NEUTRAL'

  // ── Estado: Veredicto de Claude AI ────────────────────────
  verdict:     null,   // { direction, confidence, expiry, reason, risk, avoid }
  isAnalyzing: false,

  // ── Estado: Panel inferior activo ─────────────────────────
  bottomTab: 'calendar', // 'calendar' | 'news' | 'history'

  // ── Estado: Historial de señales de la sesión ─────────────
  signalHistory: [],

  // ── Estado: Precio actual del par activo ──────────────────
  currentPrice: null,

  // ── Estado: Último tick individual para actualización en tiempo real ──
  // El ChartPanel escucha este campo y usa series.update() directamente,
  // lo que es MUCHO más eficiente y fluido que redibujar todo el chart.
  // Estructura: { key: 'EUR/USD_5m', candle: { time, open, high, low, close } }
  lastTick: null,

  // ── Estado: Tipo de chart activo ─────────────────────────
  // Controla qué tipo de series usa el ChartPanel de TradingView
  chartType: 'candlestick', // 'candlestick' | 'bar' | 'line' | 'area'

  // ── Estado: Herramienta de dibujo activa ─────────────────
  // La LeftToolbar escribe aquí; ChartPanel lo lee para el modo de dibujo
  drawingTool: 'cursor', // 'cursor'|'trendline'|'hline'|'vline'|'fibonacci'|'rectangle'|'text'

  // ── Estado: Visibilidad de indicadores overlay ────────────
  showIndicators: { ema20: true, ema50: true, bb: true, fibonacci: true, volume: true },

  // ── Acciones ──────────────────────────────────────────────

  // Cambia el par activo (ej. EUR/USD → GBP/USD)
  setActivePair: (pair) => set({ activePair: pair, verdict: null }),

  // Cambia el timeframe activo (ej. 5m → 15m)
  setActiveTF: (tf) => set({ activeTF: tf, verdict: null }),

  // Cambia el tab del panel inferior
  setBottomTab: (tab) => set({ bottomTab: tab }),

  // Guarda el precio actual del activo (actualizado en tiempo real)
  setCurrentPrice: (price) => set({ currentPrice: price }),

  // Guarda los indicadores calculados
  setIndicators: (indicators) => set({ indicators }),

  // Guarda las señales individuales y el score compuesto
  setSignals: (signals, score, bias) => set({
    signals,
    compositeScore: score,
    compositeBias:  bias,
  }),

  // Agrega o actualiza velas para un par+timeframe específico
  // key = 'EUR/USD_5m'
  setCandles: (key, candles) =>
    set(state => ({
      candleData: { ...state.candleData, [key]: candles },
    })),

  // Agrega una nueva vela (tick update en tiempo real)
  // También actualiza lastTick para que ChartPanel use series.update() directamente
  appendCandle: (key, candle) =>
    set(state => {
      const existing = state.candleData[key] || []
      const last = existing[existing.length - 1]
      // Si el timestamp es el mismo, actualizamos la última vela (vela en formación)
      if (last && last.time === candle.time) {
        return {
          lastTick: { key, candle },   // ← señal para series.update() en ChartPanel
          candleData: {
            ...state.candleData,
            [key]: [...existing.slice(0, -1), candle],
          },
        }
      }
      // Si es una vela nueva, la agregamos (mantenemos máximo 200 velas)
      return {
        lastTick: { key, candle },     // ← nueva vela también dispara update
        candleData: {
          ...state.candleData,
          [key]: [...existing.slice(-199), candle],
        },
      }
    }),

  // Cambia el tipo de chart (candlestick, bar, line, area)
  setChartType: (chartType) => set({ chartType }),

  // Cambia la herramienta de dibujo activa
  setDrawingTool: (drawingTool) => set({ drawingTool }),

  // Activa/desactiva un indicador overlay
  toggleIndicator: (key) => set(state => ({
    showIndicators: { ...state.showIndicators, [key]: !state.showIndicators[key] }
  })),

  // Establece el estado de análisis (mientras Claude procesa)
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),

  // Guarda el veredicto recibido de Claude
  setVerdict: (verdict) => set({ verdict, isAnalyzing: false }),

  // Limpia el veredicto para pedir uno nuevo
  clearVerdict: () => set({ verdict: null }),

  // Agrega una entrada al historial de señales de la sesión
  addToHistory: (entry) =>
    set(state => ({
      signalHistory: [entry, ...state.signalHistory].slice(0, 50), // máximo 50 registros
    })),
}))

export default useStore
