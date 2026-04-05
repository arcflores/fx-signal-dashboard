// ─────────────────────────────────────────────────────────────
// useStore.js — Estado global de la app con Zustand
// Zustand es una librería minimalista de manejo de estado.
// Aquí guardamos todo lo que necesitan compartir los componentes:
// par activo, timeframe, velas, indicadores, veredicto Claude, historial.
// ─────────────────────────────────────────────────────────────
import { create } from 'zustand'

const useStore = create((set, get) => ({

  // ── Estado: Par y timeframe activos ──────────────────────
  activePair: 'EUR/USD',
  activeTF:   '5m',

  // ── Estado: Datos de velas por par+timeframe ──────────────
  // Estructura: { 'EUR/USD_5m': [{ time, open, high, low, close }] }
  candleData: {},

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
  appendCandle: (key, candle) =>
    set(state => {
      const existing = state.candleData[key] || []
      const last = existing[existing.length - 1]
      // Si el timestamp es el mismo, actualizamos la última vela (vela en formación)
      if (last && last.time === candle.time) {
        return {
          candleData: {
            ...state.candleData,
            [key]: [...existing.slice(0, -1), candle],
          },
        }
      }
      // Si es una vela nueva, la agregamos (mantenemos máximo 200 velas)
      return {
        candleData: {
          ...state.candleData,
          [key]: [...existing.slice(-199), candle],
        },
      }
    }),

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
