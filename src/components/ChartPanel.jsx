// ─────────────────────────────────────────────────────────────
// ChartPanel.jsx — Panel principal del gráfico (estilo TradingView)
//
// Características:
//   ✦ Velas japonesas con colores alcista/bajista
//   ✦ Leyenda OHLCV en tiempo real (top-left del chart)
//   ✦ EMA20 (azul) + EMA50 (naranja) sobre las velas
//   ✦ Bollinger Bands (bandas dinámicas)
//   ✦ Niveles de Fibonacci (coloreados)
//   ✦ Volumen en histograma (semi-transparente)
//   ✦ Sub-panel RSI(14) con zonas 70/30
//   ✦ Sub-panel MACD(12,26,9) con histograma
//   ✦ Soporte para chartType: candlestick | bar | line | area
//   ✦ Crosshair sincronizado entre los 3 charts
//   ✦ Responde al toggle de indicadores (showIndicators)
//   ✦ ResizeObserver para layout responsive
//
// Optimización de rendimiento:
//   - series.update() para ticks en tiempo real (500ms) — NO re-renderiza React
//   - series.setData() solo al cambiar par / timeframe / indicadores
//   - lastTick en Zustand como señal de tick → evita subscripción a candleData
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts'
import useStore from '../store/useStore'
import { calculateEMAArray, calculateBollinger, calculateRSI, calculateMACD } from '../utils/indicators'
import { PAIR_CONFIG } from '../utils/mockForex'

// ── Paleta de colores del tema ───────────────────────────────
const COLORS = {
  bg:         '#0B0E11',
  surface:    '#131722',
  border:     '#1E2732',
  text:       '#9B9EA3',
  grid:       '#1A1D23',
  bullish:    '#26A69A',
  bearish:    '#EF5350',
  ema20:      '#3B82F6',
  ema50:      '#F59E0B',
  bbBand:     'rgba(148,163,184,0.35)',
  bbMiddle:   'rgba(148,163,184,0.2)',
  rsi:        '#A78BFA',
  macdLine:   '#3B82F6',
  macdSig:    '#F59E0B',
  volUp:      'rgba(38,166,154,0.35)',
  volDown:    'rgba(239,83,80,0.35)',
  crosshair:  '#3B82F6',
}

// ── Opciones base de chart ────────────────────────────────────
const BASE_CHART_OPTIONS = {
  layout: {
    background: { type: ColorType.Solid, color: COLORS.bg },
    textColor:  COLORS.text,
    fontSize:   11,
    fontFamily: 'Inter, -apple-system, sans-serif',
  },
  grid: {
    vertLines: { color: COLORS.grid, style: LineStyle.Dashed },
    horzLines: { color: COLORS.grid, style: LineStyle.Dashed },
  },
  crosshair: {
    mode:     CrosshairMode.Normal,
    vertLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.crosshair },
    horzLine: { color: COLORS.crosshair, width: 1, style: LineStyle.Dashed, labelBackgroundColor: COLORS.crosshair },
  },
  rightPriceScale: {
    borderColor:    COLORS.border,
    textColor:      COLORS.text,
    scaleMarginTop:    0.08,
    scaleMarginBottom: 0.08,
  },
  timeScale: {
    borderColor:       COLORS.border,
    timeVisible:       true,
    secondsVisible:    true,
    tickMarkFormatter: (time) => {
      const d = new Date(time * 1000)
      return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
    },
  },
  handleScroll:  { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
  handleScale:   { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
}

// ── Hook: crea los tres charts y sus series ──────────────────
// Gestiona el ciclo de vida completo de los charts de TradingView.
// Acepta refs para los 3 contenedores DOM y callbacks para actualizaciones.
function useTVChart(containerRef, rsiRef, macdRef, onOHLCV) {
  // ── Refs del chart principal ───────────────────────────
  const chartRef         = useRef(null)
  const candleSeriesRef  = useRef(null) // Serie activa (cambia con chartType)
  const ema20Ref         = useRef(null)
  const ema50Ref         = useRef(null)
  const bbUpperRef       = useRef(null)
  const bbMiddleRef      = useRef(null)
  const bbLowerRef       = useRef(null)
  const volumeRef        = useRef(null)
  const fibLinesRef      = useRef([])

  // ── Refs del sub-panel RSI ─────────────────────────────
  const rsiChartRef      = useRef(null)
  const rsiSeriesRef     = useRef(null)
  const rsiOBRef         = useRef(null)
  const rsiOSRef         = useRef(null)

  // ── Refs del sub-panel MACD ────────────────────────────
  const macdChartRef     = useRef(null)
  const macdLineRef      = useRef(null)
  const macdSignalRef    = useRef(null)
  const macdHistRef      = useRef(null)

  // Callback para actualizar la leyenda OHLCV (pasado como prop)
  const onOHLCVRef = useRef(onOHLCV)
  useEffect(() => { onOHLCVRef.current = onOHLCV }, [onOHLCV])

  useEffect(() => {
    if (!containerRef.current || !rsiRef.current || !macdRef.current) return

    // ── Chart principal ────────────────────────────────
    const chart = createChart(containerRef.current, {
      ...BASE_CHART_OPTIONS,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    })
    chartRef.current = chart

    // ── Serie de velas (candlestick por defecto) ───────
    const candleSeries = chart.addCandlestickSeries({
      upColor:         COLORS.bullish,
      downColor:       COLORS.bearish,
      borderUpColor:   COLORS.bullish,
      borderDownColor: COLORS.bearish,
      wickUpColor:     COLORS.bullish,
      wickDownColor:   COLORS.bearish,
    })
    candleSeriesRef.current = candleSeries

    // ── EMA 20 (azul) ─────────────────────────────────
    ema20Ref.current = chart.addLineSeries({
      color:            COLORS.ema20,
      lineWidth:        1.5,
      title:            'EMA20',
      priceLineVisible: false,
      lastValueVisible: true,
    })

    // ── EMA 50 (naranja) ──────────────────────────────
    ema50Ref.current = chart.addLineSeries({
      color:            COLORS.ema50,
      lineWidth:        1.5,
      title:            'EMA50',
      priceLineVisible: false,
      lastValueVisible: true,
    })

    // ── Bollinger Bands ───────────────────────────────
    bbUpperRef.current = chart.addLineSeries({
      color:            COLORS.bbBand,
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    bbMiddleRef.current = chart.addLineSeries({
      color:            COLORS.bbMiddle,
      lineWidth:        1,
      lineStyle:        LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    bbLowerRef.current = chart.addLineSeries({
      color:            COLORS.bbBand,
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Volumen (histograma en la parte inferior del chart) ─
    volumeRef.current = chart.addHistogramSeries({
      priceFormat:      { type: 'volume' },
      priceScaleId:     'volume',   // escala separada para el volumen
      priceLineVisible: false,
      lastValueVisible: false,
    })
    // Configuramos la escala de volumen para que ocupe solo el 20% inferior
    chart.priceScale('volume').applyOptions({
      scaleMarginTop:    0.82,
      scaleMarginBottom: 0,
    })

    // ── Leyenda OHLCV: suscripción al crosshair ────────
    // Actualizamos el DOM directamente (sin setState) para no perder rendimiento
    chart.subscribeCrosshairMove((param) => {
      if (param.seriesData && param.seriesData.has(candleSeries)) {
        const bar = param.seriesData.get(candleSeries)
        if (bar) {
          onOHLCVRef.current?.({
            time:  param.time,
            open:  bar.open,
            high:  bar.high,
            low:   bar.low,
            close: bar.close,
          })
        }
      } else if (!param.point) {
        // Cursor fuera del chart → mostramos la última vela
        onOHLCVRef.current?.(null)
      }
    })

    // ── Sub-panel RSI ──────────────────────────────────
    const rsiChart = createChart(rsiRef.current, {
      ...BASE_CHART_OPTIONS,
      width:  rsiRef.current.clientWidth,
      height: rsiRef.current.clientHeight,
      rightPriceScale: {
        ...BASE_CHART_OPTIONS.rightPriceScale,
        scaleMarginTop:    0.15,
        scaleMarginBottom: 0.15,
      },
    })
    rsiChartRef.current = rsiChart

    rsiSeriesRef.current = rsiChart.addLineSeries({
      color:            COLORS.rsi,
      lineWidth:        1.5,
      title:            'RSI',
      priceLineVisible: false,
      lastValueVisible: true,
    })
    // Zona sobrecompra (70)
    rsiOBRef.current = rsiChart.addLineSeries({
      color:     'rgba(239,83,80,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    // Zona sobreventa (30)
    rsiOSRef.current = rsiChart.addLineSeries({
      color:     'rgba(38,166,154,0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Sub-panel MACD ────────────────────────────────
    const macdChart = createChart(macdRef.current, {
      ...BASE_CHART_OPTIONS,
      width:  macdRef.current.clientWidth,
      height: macdRef.current.clientHeight,
      rightPriceScale: {
        ...BASE_CHART_OPTIONS.rightPriceScale,
        scaleMarginTop:    0.25,
        scaleMarginBottom: 0.25,
      },
    })
    macdChartRef.current = macdChart

    macdLineRef.current = macdChart.addLineSeries({
      color:     COLORS.macdLine,
      lineWidth: 1.5,
      title:     'MACD',
      priceLineVisible: false,
      lastValueVisible: true,
    })
    macdSignalRef.current = macdChart.addLineSeries({
      color:     COLORS.macdSig,
      lineWidth: 1.5,
      title:     'Signal',
      priceLineVisible: false,
      lastValueVisible: true,
    })
    macdHistRef.current = macdChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Hist',
    })

    // ── Sincronizar TimeScale entre los 3 charts ───────
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (!range) return
      if (rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange(range)
      if (macdChartRef.current) macdChartRef.current.timeScale().setVisibleLogicalRange(range)
    })

    // ── ResizeObserver responsive ──────────────────────
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      if (rsiRef.current)       rsiChart.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight })
      if (macdRef.current)      macdChart.applyOptions({ width: macdRef.current.clientWidth, height: macdRef.current.clientHeight })
    })
    if (containerRef.current) ro.observe(containerRef.current)
    if (rsiRef.current)        ro.observe(rsiRef.current)
    if (macdRef.current)       ro.observe(macdRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      rsiChart.remove()
      macdChart.remove()
    }
  }, []) // Solo al montar

  return {
    chartRef, candleSeriesRef,
    ema20Ref, ema50Ref,
    bbUpperRef, bbMiddleRef, bbLowerRef,
    volumeRef, fibLinesRef,
    rsiSeriesRef, rsiOBRef, rsiOSRef,
    macdLineRef, macdSignalRef, macdHistRef,
    rsiChartRef, macdChartRef,
  }
}

// ── Leyenda OHLCV (overlay top-left del chart) ───────────────
// Muestra Open, High, Low, Close de la vela bajo el crosshair.
// Se actualiza directamente via DOM (sin setState) para máximo rendimiento.
function OHLCVLegend({ ohlcv, pair, tf }) {
  const config   = PAIR_CONFIG[pair]
  const decimals = config?.decimals ?? 5
  if (!ohlcv) return null

  const isUp     = ohlcv.close >= ohlcv.open
  const pctChg   = ohlcv.open ? ((ohlcv.close - ohlcv.open) / ohlcv.open * 100) : 0

  const fmt = (v) => v != null ? v.toFixed(decimals) : '—'

  return (
    <div className="absolute top-2 left-2 z-20 flex items-center gap-3 pointer-events-none
                    bg-bg/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border/50">
      {/* Par y TF */}
      <span className="text-[10px] font-bold text-muted">{pair} · {tf}</span>
      {/* OHLC values */}
      <span className="text-[10px] font-mono">
        <span className="text-muted">O </span>
        <span className="text-text-primary">{fmt(ohlcv.open)}</span>
      </span>
      <span className="text-[10px] font-mono">
        <span className="text-muted">H </span>
        <span className="text-call">{fmt(ohlcv.high)}</span>
      </span>
      <span className="text-[10px] font-mono">
        <span className="text-muted">L </span>
        <span className="text-put">{fmt(ohlcv.low)}</span>
      </span>
      <span className="text-[10px] font-mono">
        <span className="text-muted">C </span>
        <span className={isUp ? 'text-call' : 'text-put'}>{fmt(ohlcv.close)}</span>
      </span>
      {/* Cambio % */}
      <span className={`text-[10px] font-bold ${isUp ? 'text-call' : 'text-put'}`}>
        {isUp ? '+' : ''}{pctChg.toFixed(2)}%
      </span>
    </div>
  )
}

// ── Badge de overlay activo ───────────────────────────────────
function OverlayBadge({ color, label }) {
  return (
    <span className="text-[10px] font-bold" style={{ color }}>
      {label}
    </span>
  )
}

// ── Componente principal ChartPanel ──────────────────────────
export default function ChartPanel() {
  // Refs de los contenedores DOM de los tres charts
  const containerRef = useRef(null)
  const rsiRef       = useRef(null)
  const macdRef      = useRef(null)

  // ── Estado OHLCV para la leyenda ──────────────────────────
  const [ohlcv, setOhlcv] = useState(null)

  // Callback memoizado para actualizar la leyenda OHLCV
  const handleOHLCV = useCallback((bar) => setOhlcv(bar), [])

  // ── Datos del store global ─────────────────────────────────
  const {
    activePair, activeTF, indicators,
    lastTick, chartType, showIndicators,
  } = useStore()

  // ── Creamos los tres charts (hook) ─────────────────────────
  const {
    chartRef, candleSeriesRef,
    ema20Ref, ema50Ref,
    bbUpperRef, bbMiddleRef, bbLowerRef,
    volumeRef, fibLinesRef,
    rsiSeriesRef, rsiOBRef, rsiOSRef,
    macdLineRef, macdSignalRef, macdHistRef,
    rsiChartRef, macdChartRef,
  } = useTVChart(containerRef, rsiRef, macdRef, handleOHLCV)

  // ── Efecto 1: TICK EN TIEMPO REAL (500ms) ─────────────────
  // Solo actualiza la vela actual con series.update() → animación fluida
  useEffect(() => {
    if (!lastTick) return
    const activeKey = `${activePair}_${activeTF}`
    if (lastTick.key !== activeKey) return
    if (!candleSeriesRef.current) return

    // update() solo modifica la vela actual, no redibuja todo el chart
    candleSeriesRef.current.update(lastTick.candle)

    // Actualiza la leyenda con el precio actual (sin esperar el crosshair)
    setOhlcv(prev => prev ? { ...prev, close: lastTick.candle.close, high: Math.max(prev.high || 0, lastTick.candle.close), low: Math.min(prev.low || Infinity, lastTick.candle.close) } : lastTick.candle)

    // Actualiza volumen si está visible
    if (volumeRef.current && showIndicators.volume) {
      const c = lastTick.candle
      volumeRef.current.update({
        time:  c.time,
        value: c.volume ?? Math.round(100 + Math.random() * 500),
        color: c.close >= c.open ? COLORS.volUp : COLORS.volDown,
      })
    }
  }, [lastTick, activePair, activeTF])

  // ── Efecto 2: CARGA INICIAL / CAMBIO PAR-TF ───────────────
  // setData() completo: velas + todos los indicadores
  // Se ejecuta al cambiar par, TF, indicadores o tipo de chart
  useEffect(() => {
    const key     = `${activePair}_${activeTF}`
    const candles = useStore.getState().candleData[key]
    if (!candles || candles.length < 5) return

    const closes = candles.map(c => c.close)
    const config  = PAIR_CONFIG[activePair]

    // ── Velas / Bars / Line / Area ──────────────────────
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candles)
    }

    // Inicializamos la leyenda OHLCV con la última vela
    const last = candles[candles.length - 1]
    if (last) setOhlcv(last)

    // ── Volumen ─────────────────────────────────────────
    if (volumeRef.current) {
      const volData = candles.map(c => ({
        time:  c.time,
        value: c.volume ?? Math.round(100 + Math.random() * 500),
        color: c.close >= c.open ? COLORS.volUp : COLORS.volDown,
      }))
      volumeRef.current.setData(volData)
      // Visibilidad según toggle de indicadores
      volumeRef.current.applyOptions({ visible: showIndicators.volume !== false })
    }

    // ── EMA 20 ──────────────────────────────────────────
    if (ema20Ref.current) {
      const arr = calculateEMAArray(closes, 20)
      ema20Ref.current.setData(
        arr.map((v, i) => ({ time: candles[i + 19]?.time, value: v })).filter(d => d.time)
      )
      ema20Ref.current.applyOptions({ visible: showIndicators.ema20 !== false })
    }

    // ── EMA 50 ──────────────────────────────────────────
    if (ema50Ref.current) {
      const arr = calculateEMAArray(closes, 50)
      ema50Ref.current.setData(
        arr.map((v, i) => ({ time: candles[i + 49]?.time, value: v })).filter(d => d.time)
      )
      ema50Ref.current.applyOptions({ visible: showIndicators.ema50 !== false })
    }

    // ── Bollinger Bands ─────────────────────────────────
    if (bbUpperRef.current) {
      const upper = [], middle = [], lower = []
      for (let i = 19; i < closes.length; i++) {
        const slice = closes.slice(i - 19, i + 1)
        const sma   = slice.reduce((a, b) => a + b, 0) / 20
        const std   = Math.sqrt(slice.reduce((a, v) => a + (v - sma) ** 2, 0) / 20)
        const t     = candles[i].time
        upper.push({ time: t, value: parseFloat((sma + 2 * std).toFixed(config?.decimals ?? 5)) })
        middle.push({ time: t, value: parseFloat(sma.toFixed(config?.decimals ?? 5)) })
        lower.push({ time: t, value: parseFloat((sma - 2 * std).toFixed(config?.decimals ?? 5)) })
      }
      bbUpperRef.current.setData(upper)
      bbMiddleRef.current?.setData(middle)
      bbLowerRef.current?.setData(lower)
      const vis = showIndicators.bb !== false
      bbUpperRef.current.applyOptions({ visible: vis })
      bbMiddleRef.current?.applyOptions({ visible: vis })
      bbLowerRef.current?.applyOptions({ visible: vis })
    }

    // ── Fibonacci ───────────────────────────────────────
    // Limpiamos líneas anteriores
    if (chartRef.current && fibLinesRef.current.length > 0) {
      fibLinesRef.current.forEach(s => { try { chartRef.current.removeSeries(s) } catch {} })
      fibLinesRef.current = []
    }

    if (chartRef.current && indicators.fibonacci && showIndicators.fibonacci !== false) {
      const fibColors = {
        '0.0%':   'rgba(156,163,175,0.25)',
        '23.6%':  'rgba(251,191,36,0.5)',
        '38.2%':  'rgba(249,115,22,0.5)',
        '50.0%':  'rgba(148,163,184,0.45)',
        '61.8%':  'rgba(59,130,246,0.75)',
        '78.6%':  'rgba(167,139,250,0.5)',
        '100.0%': 'rgba(156,163,175,0.25)',
      }
      indicators.fibonacci.forEach(fib => {
        const s = chartRef.current.addLineSeries({
          color:            fibColors[fib.label] || 'rgba(255,255,255,0.2)',
          lineWidth:        fib.isOTE ? 2 : 1,
          lineStyle:        fib.isOTE ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: true,
          priceLineWidth:   fib.isOTE ? 2 : 1,
          priceLineColor:   fibColors[fib.label] || 'rgba(255,255,255,0.2)',
          lastValueVisible: true,
          title:            `Fib ${fib.label}`,
        })
        s.setData([
          { time: candles[0].time,               value: fib.level },
          { time: candles[candles.length-1].time, value: fib.level },
        ])
        fibLinesRef.current.push(s)
      })
    }

    // ── RSI (14) ────────────────────────────────────────
    if (rsiSeriesRef.current) {
      const rsiData = []
      for (let i = 14; i < closes.length; i++) {
        const v = calculateRSI(closes.slice(0, i + 1))
        if (v != null) rsiData.push({ time: candles[i].time, value: v })
      }
      rsiSeriesRef.current.setData(rsiData)
      // Líneas 70 y 30
      const t0 = candles[0].time, tn = candles[candles.length-1].time
      rsiOBRef.current?.setData([{ time: t0, value: 70 }, { time: tn, value: 70 }])
      rsiOSRef.current?.setData([{ time: t0, value: 30 }, { time: tn, value: 30 }])
    }

    // ── MACD (12,26,9) ───────────────────────────────────
    if (macdLineRef.current) {
      const lineData = [], sigData = [], histData = []
      const k12 = 2 / 13, k26 = 2 / 27

      for (let i = 35; i < closes.length; i++) {
        const slice = closes.slice(0, i + 1)
        let ema12 = slice.slice(0, 12).reduce((a,b) => a+b, 0) / 12
        let ema26 = slice.slice(0, 26).reduce((a,b) => a+b, 0) / 26
        for (let j = 12; j < slice.length; j++) ema12 = slice[j] * k12 + ema12 * (1 - k12)
        for (let j = 26; j < slice.length; j++) ema26 = slice[j] * k26 + ema26 * (1 - k26)

        const macdVal = parseFloat((ema12 - ema26).toFixed(config?.decimals ?? 5))
        lineData.push({ time: candles[i].time, value: macdVal })

        if (lineData.length >= 9) {
          const sig = parseFloat((lineData.slice(-9).reduce((a,b) => a + b.value, 0) / 9).toFixed(config?.decimals ?? 5))
          sigData.push({ time: candles[i].time, value: sig })
          histData.push({
            time:  candles[i].time,
            value: parseFloat((macdVal - sig).toFixed(config?.decimals ?? 5)),
            color: macdVal > sig ? 'rgba(38,166,154,0.75)' : 'rgba(239,83,80,0.75)',
          })
        }
      }

      macdLineRef.current.setData(lineData)
      macdSignalRef.current?.setData(sigData)
      macdHistRef.current?.setData(histData)
    }

    // Ajustamos la vista al contenido en la carga inicial
    if (chartRef.current) chartRef.current.timeScale().fitContent()
    if (rsiChartRef.current) rsiChartRef.current.timeScale().fitContent()
    if (macdChartRef.current) macdChartRef.current.timeScale().fitContent()

  }, [activePair, activeTF, indicators, chartType, showIndicators])

  return (
    // ── Layout vertical: chart principal + RSI + MACD ────
    <div className="flex flex-col flex-1 overflow-hidden min-h-0 bg-bg">

      {/* ── Gráfico principal de velas ───────────────────── */}
      <div className="relative" style={{ flex: '1 1 60%', minHeight: 0 }}>

        {/* ── Leyenda OHLCV (actualizada en tiempo real) ─── */}
        <OHLCVLegend ohlcv={ohlcv} pair={activePair} tf={activeTF} />

        {/* ── Badges de overlays activos (top-right del chart) ─ */}
        <div className="absolute top-2 right-3 z-20 flex items-center gap-2 pointer-events-none">
          {showIndicators.ema20   !== false && <OverlayBadge color={COLORS.ema20} label="EMA20" />}
          {showIndicators.ema50   !== false && <OverlayBadge color={COLORS.ema50} label="EMA50" />}
          {showIndicators.bb      !== false && <OverlayBadge color="rgba(148,163,184,0.7)" label="BB(20)" />}
          {showIndicators.fibonacci !== false && <OverlayBadge color="rgba(59,130,246,0.8)" label="FIB" />}
          {showIndicators.volume  !== false && <OverlayBadge color="#6B7280" label="VOL" />}
        </div>

        {/* Contenedor del chart de TradingView */}
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* ── Sub-panel RSI(14) ────────────────────────────── */}
      <div
        className="relative border-t border-border"
        style={{ flex: '0 0 18%', minHeight: 0 }}
      >
        <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: COLORS.rsi }}>RSI(14)</span>
          <span className="text-[9px] text-muted">70 / 30</span>
        </div>
        <div ref={rsiRef} className="w-full h-full" />
      </div>

      {/* ── Sub-panel MACD(12,26,9) ──────────────────────── */}
      <div
        className="relative border-t border-border"
        style={{ flex: '0 0 18%', minHeight: 0 }}
      >
        <div className="absolute top-1 left-2 z-10 pointer-events-none flex items-center gap-2">
          <span className="text-[10px] font-bold" style={{ color: COLORS.macdLine }}>MACD</span>
          <span className="text-[9px] text-muted">(12,26,9)</span>
          <span className="text-[9px]" style={{ color: COLORS.macdSig }}>Signal</span>
        </div>
        <div ref={macdRef} className="w-full h-full" />
      </div>
    </div>
  )
}
