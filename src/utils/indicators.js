// ─────────────────────────────────────────────────────────────
// indicators.js — Cálculos de indicadores técnicos en JavaScript puro
// Todos los indicadores usados en la plataforma se calculan aquí:
// RSI, EMA, MACD, Bollinger Bands, Stochastic, Fibonacci
// ─────────────────────────────────────────────────────────────

// ── RSI (Relative Strength Index) ────────────────────────────
// Mide la velocidad y magnitud de los movimientos de precio.
// Por encima de 70 = sobrecomprado → posible PUT
// Por debajo de 30 = sobrevendido  → posible CALL
export function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return null

  let gains = 0
  let losses = 0

  // Primera pasada: promedio inicial de ganancias y pérdidas
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff >= 0) gains += diff
    else losses += Math.abs(diff)
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  // Suavizado exponencial (método Wilder) para el resto de velas
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff >= 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }

  // Si no hay pérdidas, el RSI es 100 (mercado solo sube)
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return parseFloat((100 - 100 / (1 + rs)).toFixed(2))
}

// ── EMA (Exponential Moving Average) ─────────────────────────
// Media móvil que da más peso a los precios recientes.
// EMA 20 = tendencia corto plazo | EMA 50 = tendencia media
export function calculateEMA(closes, period) {
  if (closes.length < period) return null

  // Multiplicador: cuánto peso tienen los precios nuevos
  const k = 2 / (period + 1)

  // Valor inicial = SMA de los primeros 'period' precios
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period

  // Avanzamos desde el periodo en adelante aplicando la fórmula EMA
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
  }

  return parseFloat(ema.toFixed(5))
}

// Genera array completo de valores EMA para dibujar la línea en el chart
export function calculateEMAArray(closes, period) {
  if (closes.length < period) return []
  const k = 2 / (period + 1)
  const result = []
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(parseFloat(ema.toFixed(5)))
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k)
    result.push(parseFloat(ema.toFixed(5)))
  }
  return result
}

// ── MACD (Moving Average Convergence Divergence) ─────────────
// Diferencia entre EMA12 y EMA26. Cuando la línea MACD cruza
// la señal (EMA9 del MACD) hacia arriba → CALL, hacia abajo → PUT
export function calculateMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return null

  const ema12 = calculateEMA(closes, fast)
  const ema26 = calculateEMA(closes, slow)
  if (!ema12 || !ema26) return null

  const macdLine = parseFloat((ema12 - ema26).toFixed(5))

  // Para la línea de señal necesitamos un array de valores MACD históricos
  const ema12arr = calculateEMAArray(closes, fast)
  const ema26arr = calculateEMAArray(closes, slow)
  // Alineamos los dos arrays (el de 26 empieza después)
  const offset = slow - fast
  const macdArr = ema26arr.map((v, i) => ema12arr[i + offset] - v)

  const signalLine = calculateEMA(macdArr, signal)
  const histogram = signalLine ? parseFloat((macdLine - signalLine).toFixed(5)) : 0

  return {
    line:      macdLine,
    signal:    signalLine ? parseFloat(signalLine.toFixed(5)) : null,
    histogram: histogram,
    // Dirección del cruce (positivo = alcista, negativo = bajista)
    bullish:   histogram > 0,
  }
}

// ── Bollinger Bands ───────────────────────────────────────────
// Banda media = SMA20 | Banda superior/inferior = media ± 2σ
// Precio en banda superior → sobrecomprado
// Precio en banda inferior → sobrevendido
// Precio tocando media desde abajo con volumen → CALL
export function calculateBollinger(closes, period = 20, multiplier = 2) {
  if (closes.length < period) return null

  // Tomamos las últimas 'period' velas
  const recent = closes.slice(-period)
  const sma = recent.reduce((a, b) => a + b, 0) / period

  // Desviación estándar
  const variance = recent.reduce((a, v) => a + Math.pow(v - sma, 2), 0) / period
  const stdDev = Math.sqrt(variance)

  return {
    upper:  parseFloat((sma + multiplier * stdDev).toFixed(5)),
    middle: parseFloat(sma.toFixed(5)),
    lower:  parseFloat((sma - multiplier * stdDev).toFixed(5)),
    // Ancho de banda: mayor ancho = mayor volatilidad
    width:  parseFloat(((multiplier * 2 * stdDev) / sma * 100).toFixed(3)),
  }
}

// ── Stochastic Oscillator ─────────────────────────────────────
// %K mide dónde está el precio actual en el rango high-low del periodo.
// %D es la media de %K (señal de confirmación).
// Debajo de 20 = sobrevendido → CALL | Arriba de 80 = sobrecomprado → PUT
export function calculateStochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  if (closes.length < kPeriod) return null

  const recentHighs  = highs.slice(-kPeriod)
  const recentLows   = lows.slice(-kPeriod)
  const currentClose = closes[closes.length - 1]

  const highestHigh = Math.max(...recentHighs)
  const lowestLow   = Math.min(...recentLows)

  // Si el rango es 0 (mercado completamente plano), devolvemos 50
  if (highestHigh === lowestLow) return { k: 50, d: 50 }

  const k = parseFloat(((currentClose - lowestLow) / (highestHigh - lowestLow) * 100).toFixed(2))

  // %D simplificado: promedio del último %K (en producción usaríamos array de K)
  const d = k

  return { k, d }
}

// ── Fibonacci Retracement ─────────────────────────────────────
// Identifica niveles de soporte/resistencia basados en ratios
// de la secuencia de Fibonacci: 23.6%, 38.2%, 50%, 61.8%, 78.6%
// El nivel 61.8% (OTE - Optimal Trade Entry) es el más importante en ICT
export function calculateFibonacci(highs, lows) {
  if (!highs.length || !lows.length) return null

  // Buscamos el swing high y swing low en las últimas 50 velas
  const lookback = Math.min(highs.length, 50)
  const recentHighs = highs.slice(-lookback)
  const recentLows  = lows.slice(-lookback)

  const swingHigh = Math.max(...recentHighs)
  const swingLow  = Math.min(...recentLows)
  const range     = swingHigh - swingLow

  // Ratios estándar de Fibonacci
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

  return ratios.map(r => ({
    ratio: r,
    level: parseFloat((swingHigh - range * r).toFixed(5)),
    label: `${(r * 100).toFixed(1)}%`,
    isOTE: r === 0.618, // Optimal Trade Entry (más importante)
  }))
}

// ── Señal de cada indicador ───────────────────────────────────
// Retorna 'call', 'put' o 'neutral' para cada indicador
// dado el valor calculado y el precio actual.
export function getSignalForIndicator(name, value, price, bollinger) {
  if (value === null || value === undefined) return 'neutral'

  switch (name) {
    case 'rsi':
      if (value < 35) return 'call'    // Sobrevendido
      if (value > 65) return 'put'     // Sobrecomprado
      return 'neutral'

    case 'macd':
      if (!value) return 'neutral'
      return value.bullish ? 'call' : 'put'

    case 'bollinger':
      if (!bollinger) return 'neutral'
      // Precio cerca de banda inferior → call | cerca de superior → put
      const rangeB = bollinger.upper - bollinger.lower
      if (rangeB === 0) return 'neutral'
      const pos = (price - bollinger.lower) / rangeB
      if (pos < 0.25) return 'call'
      if (pos > 0.75) return 'put'
      return 'neutral'

    case 'ema':
      // EMA 20 por encima de EMA 50 = tendencia alcista
      if (!value.ema20 || !value.ema50) return 'neutral'
      return value.ema20 > value.ema50 ? 'call' : 'put'

    case 'stoch':
      if (!value) return 'neutral'
      if (value.k < 25) return 'call'
      if (value.k > 75) return 'put'
      return 'neutral'

    default:
      return 'neutral'
  }
}

// ── Score Compuesto ───────────────────────────────────────────
// Toma todas las señales y calcula un porcentaje CALL vs PUT
// usando pesos por indicador (los más fiables tienen más peso)
export function calculateCompositeScore(signals) {
  const total  = signals.reduce((a, s) => a + s.weight, 0)
  const callW  = signals.filter(s => s.signal === 'call').reduce((a, s) => a + s.weight, 0)
  const score  = total > 0 ? Math.round((callW / total) * 100) : 50
  const bias   = score >= 60 ? 'CALL' : score <= 40 ? 'PUT' : 'NEUTRAL'
  return { score, bias }
}
