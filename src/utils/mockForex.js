// ─────────────────────────────────────────────────────────────
// mockForex.js — Generador de datos Forex simulados
// Mientras OANDA API no esté conectada, este módulo genera
// datos de precio realistas para los pares Forex.
// Los precios se mueven con distribución aleatoria normal
// que simula el comportamiento real del mercado intradía.
// ─────────────────────────────────────────────────────────────

// Precios base y configuración de cada par (valores reales de abril 2026)
export const PAIR_CONFIG = {
  // volatility = multiplicador de movimiento en pips por tick
  'EUR/USD': { base: 1.0842, pip: 0.0001, decimals: 5, spread: 0.00012, volatility: 3 },
  'USD/JPY': { base: 151.34, pip: 0.01,   decimals: 3, spread: 0.015,   volatility: 4 },
  'GBP/USD': { base: 1.2634, pip: 0.0001, decimals: 5, spread: 0.00015, volatility: 5 },
  'AUD/USD': { base: 0.6521, pip: 0.0001, decimals: 5, spread: 0.00013, volatility: 3 },
  'USD/CAD': { base: 1.3842, pip: 0.0001, decimals: 5, spread: 0.00014, volatility: 3 },
}

// Mapeo de pares Forex a pares de Binance (para datos reales de crypto)
export const BINANCE_SYMBOLS = {
  'BTC/USD': 'btcusdt',
  'ETH/USD': 'ethusdt',
  'SOL/USD': 'solusdt',
}

// Todos los pares disponibles en la plataforma
export const ALL_PAIRS = [
  ...Object.keys(PAIR_CONFIG),
  ...Object.keys(BINANCE_SYMBOLS),
]

// Pares Forex (usan datos mock hasta que OANDA esté conectado)
export const FOREX_PAIRS = Object.keys(PAIR_CONFIG)

// Pares crypto (usan datos reales de Binance WebSocket)
export const CRYPTO_PAIRS = Object.keys(BINANCE_SYMBOLS)

// ── Generador de velas históricas ────────────────────────────
// Crea un array de velas OHLCV simuladas para cargar el chart inicial.
// 'n' velas hacia atrás desde el momento actual.
export function generateHistoricalCandles(pair, n = 100, intervalMinutes = 1) {
  const config = PAIR_CONFIG[pair]
  if (!config) return []

  const candles = []
  let price = config.base + (Math.random() - 0.5) * config.pip * 50

  // Volatilidad por timeframe (más tiempo = velas más grandes)
  const volatility = config.pip * 8 * Math.sqrt(intervalMinutes)

  // Tiempo de inicio = hace 'n' intervalos
  const now = Math.floor(Date.now() / 1000)
  const startTime = now - n * intervalMinutes * 60

  for (let i = 0; i < n; i++) {
    const time = startTime + i * intervalMinutes * 60
    const open = price

    // Movimiento con leve sesgo (simula tendencia suave)
    const trend = (Math.random() - 0.49) * volatility
    const close = open + trend

    // High y Low con wicks realistas
    const wickMultiplier = 0.3 + Math.random() * 0.7
    const high = Math.max(open, close) + Math.abs(trend) * wickMultiplier
    const low  = Math.min(open, close) - Math.abs(trend) * wickMultiplier

    // Volumen simulado (mayor en movimientos fuertes)
    const volume = 100 + Math.random() * 500 + Math.abs(trend / volatility) * 200

    candles.push({
      time,
      open:   parseFloat(open.toFixed(config.decimals)),
      high:   parseFloat(high.toFixed(config.decimals)),
      low:    parseFloat(low.toFixed(config.decimals)),
      close:  parseFloat(close.toFixed(config.decimals)),
      volume: Math.round(volume),
    })

    price = close
  }

  return candles
}

// ── Generador de nueva vela (tick update) ────────────────────
// Cada vez que el intervalo termina, creamos una nueva vela
// basada en el último precio conocido.
export function generateNewCandle(pair, lastClose, time, intervalMinutes = 1) {
  const config = PAIR_CONFIG[pair]
  if (!config) return null

  const volatility = config.pip * 8 * Math.sqrt(intervalMinutes)
  const open  = lastClose
  const trend = (Math.random() - 0.49) * volatility
  const close = open + trend
  const wick  = Math.abs(trend) * (0.3 + Math.random() * 0.7)
  const high  = Math.max(open, close) + wick
  const low   = Math.min(open, close) - wick

  return {
    time,
    open:  parseFloat(open.toFixed(config.decimals)),
    high:  parseFloat(high.toFixed(config.decimals)),
    low:   parseFloat(low.toFixed(config.decimals)),
    close: parseFloat(close.toFixed(config.decimals)),
    volume: Math.round(100 + Math.random() * 500),
  }
}

// ── Datos de la watchlist ─────────────────────────────────────
// Estado inicial de todos los pares para mostrar en el sidebar
export function getInitialWatchlistData() {
  return Object.entries(PAIR_CONFIG).map(([pair, config]) => {
    const change = (Math.random() - 0.5) * config.pip * 120
    return {
      pair,
      price:  (config.base + change).toFixed(config.decimals),
      change: change >= 0
        ? `+${(change / config.base * 100).toFixed(2)}%`
        : `${(change / config.base * 100).toFixed(2)}%`,
      up:     change >= 0,
    }
  })
}

// Intervalos de Binance por timeframe de la plataforma
export const TF_TO_BINANCE = {
  '1m':  '1m',
  '3m':  '3m',
  '5m':  '5m',
  '15m': '15m',
  '1h':  '1h',
}

// Timeframes disponibles en la plataforma
export const TIMEFRAMES = ['1m', '3m', '5m', '15m', '1h']
