// ─────────────────────────────────────────────────────────────
// ChartPanel.jsx — Panel principal del gráfico de precios
// Usa TradingView Lightweight Charts v4 para renderizar:
//   - Gráfico de velas japonesas (candlestick)
//   - Overlays: EMA20 (azul), EMA50 (naranja), Bollinger Bands
//   - Líneas de Fibonacci
//   - Sub-panel: RSI con zonas de sobrecompra/sobreventa
//   - Sub-panel: MACD (histograma + líneas)
// Todo se recalcula al cambiar el par o el timeframe.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, LineStyle } from 'lightweight-charts'
import useStore from '../store/useStore'
import { calculateEMAArray, calculateBollinger, calculateRSI, calculateMACD } from '../utils/indicators'

// ── Configuración visual del chart ───────────────────────────
// Paleta oscura que coincide con el tema general de la app.
const CHART_THEME = {
  layout: {
    background:    { type: ColorType.Solid, color: '#0B0E11' },
    textColor:     '#9B9EA3',
    fontSize:      11,
    fontFamily:    'Inter, sans-serif',
  },
  grid: {
    vertLines:   { color: '#1A1D23', style: LineStyle.Dashed },
    horzLines:   { color: '#1A1D23', style: LineStyle.Dashed },
  },
  crosshair: {
    mode:   CrosshairMode.Normal,
    vertLine: { color: '#3B82F6', labelBackgroundColor: '#3B82F6' },
    horzLine: { color: '#3B82F6', labelBackgroundColor: '#3B82F6' },
  },
  rightPriceScale: {
    borderColor:    '#1E2228',
    textColor:      '#9B9EA3',
    scaleMarginTop:    0.1,
    scaleMarginBottom: 0.1,
  },
  timeScale: {
    borderColor:       '#1E2228',
    timeVisible:       true,
    secondsVisible:    false,
    tickMarkFormatter: (time) => {
      // Formateamos la hora como HH:MM para timeframes cortos
      const date = new Date(time * 1000)
      return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
    },
  },
}

// ── Hook para crear y destruir el chart ──────────────────────
// Gestiona el ciclo de vida del chart de TradingView.
// Retorna las referencias al chart y a los series.
function useTVChart(containerRef, rsiRef, macdRef) {
  const chartRef   = useRef(null) // Chart principal (candlestick)
  const rsiChartRef  = useRef(null) // Chart sub-panel RSI
  const macdChartRef = useRef(null) // Chart sub-panel MACD

  // Series del chart principal
  const candleSeriesRef = useRef(null)
  const ema20SeriesRef  = useRef(null)
  const ema50SeriesRef  = useRef(null)
  const bbUpperRef      = useRef(null)
  const bbMiddleRef     = useRef(null)
  const bbLowerRef      = useRef(null)
  const fibLinesRef     = useRef([]) // Array de líneas de Fibonacci

  // Series del sub-panel RSI
  const rsiSeriesRef    = useRef(null)
  const rsiOBRef        = useRef(null) // Línea 70 (sobrecompra)
  const rsiOSRef        = useRef(null) // Línea 30 (sobreventa)

  // Series del sub-panel MACD
  const macdLineRef     = useRef(null)
  const macdSignalRef   = useRef(null)
  const macdHistRef     = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !rsiRef.current || !macdRef.current) return

    // ── Crear chart principal ────────────────────────────
    const chart = createChart(containerRef.current, {
      ...CHART_THEME,
      width:  containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      handleScroll:    { mouseWheel: true, pressedMouseMove: true },
      handleScale:     { axisPressedMouseMove: true, mouseWheel: true },
    })
    chartRef.current = chart

    // ── Serie de velas japonesas ─────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor:        '#26A69A', // Verde para velas alcistas
      downColor:      '#EF5350', // Rojo para velas bajistas
      borderUpColor:  '#26A69A',
      borderDownColor:'#EF5350',
      wickUpColor:    '#26A69A',
      wickDownColor:  '#EF5350',
    })
    candleSeriesRef.current = candleSeries

    // ── Serie EMA 20 (azul — tendencia corta) ────────────
    ema20SeriesRef.current = chart.addLineSeries({
      color:      '#3B82F6',
      lineWidth:  1,
      title:      'EMA20',
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Serie EMA 50 (naranja — tendencia media) ─────────
    ema50SeriesRef.current = chart.addLineSeries({
      color:      '#F59E0B',
      lineWidth:  1,
      title:      'EMA50',
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Bollinger Bands (líneas blancas translúcidas) ────
    bbUpperRef.current = chart.addLineSeries({
      color:      'rgba(148, 163, 184, 0.4)',
      lineWidth:  1,
      lineStyle:  LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    bbMiddleRef.current = chart.addLineSeries({
      color:      'rgba(148, 163, 184, 0.25)',
      lineWidth:  1,
      lineStyle:  LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
    })
    bbLowerRef.current = chart.addLineSeries({
      color:      'rgba(148, 163, 184, 0.4)',
      lineWidth:  1,
      lineStyle:  LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Sub-panel RSI ─────────────────────────────────────
    const rsiChart = createChart(rsiRef.current, {
      ...CHART_THEME,
      width:  rsiRef.current.clientWidth,
      height: rsiRef.current.clientHeight,
      rightPriceScale: { ...CHART_THEME.rightPriceScale, scaleMarginTop: 0.2, scaleMarginBottom: 0.2 },
    })
    rsiChartRef.current = rsiChart

    rsiSeriesRef.current = rsiChart.addLineSeries({
      color:      '#A78BFA', // Violeta para RSI
      lineWidth:  1.5,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'RSI',
    })

    // Línea horizontal en 70 (sobrecompra)
    rsiOBRef.current = rsiChart.addLineSeries({
      color:     'rgba(239, 83, 80, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Línea horizontal en 30 (sobreventa)
    rsiOSRef.current = rsiChart.addLineSeries({
      color:     'rgba(38, 166, 154, 0.4)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // ── Sub-panel MACD ────────────────────────────────────
    const macdChart = createChart(macdRef.current, {
      ...CHART_THEME,
      width:  macdRef.current.clientWidth,
      height: macdRef.current.clientHeight,
      rightPriceScale: { ...CHART_THEME.rightPriceScale, scaleMarginTop: 0.3, scaleMarginBottom: 0.3 },
    })
    macdChartRef.current = macdChart

    macdLineRef.current = macdChart.addLineSeries({
      color:     '#3B82F6',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'MACD',
    })
    macdSignalRef.current = macdChart.addLineSeries({
      color:     '#F59E0B',
      lineWidth: 1.5,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'Signal',
    })
    macdHistRef.current = macdChart.addHistogramSeries({
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'Hist',
    })

    // ── Sincronizar crosshair entre los tres charts ───────
    // Cuando movemos el cursor en uno, se mueve en todos.
    const syncCrosshair = (sourceChart, targetCharts) => {
      sourceChart.subscribeCrosshairMove(param => {
        if (!param.point) return
        targetCharts.forEach(tc => {
          if (tc) {
            const logical = sourceChart.timeScale().coordinateToLogical(param.point.x)
            if (logical !== null) {
                const range = tc.timeScale().getVisibleLogicalRange()
                const from  = (range && range.from != null) ? range.from : 0
                tc.timeScale().scrollToPosition(logical - from, false)
              }
          }
        })
      })
    }

    // ── Sincronizar rango de tiempo entre charts ──────────
    chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
      if (range && rsiChartRef.current) rsiChartRef.current.timeScale().setVisibleLogicalRange(range)
      if (range && macdChartRef.current) macdChartRef.current.timeScale().setVisibleLogicalRange(range)
    })

    // ── ResizeObserver: redimiensona el chart con la ventana ─
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current)
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
      if (rsiRef.current)
        rsiChart.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight })
      if (macdRef.current)
        macdChart.applyOptions({ width: macdRef.current.clientWidth, height: macdRef.current.clientHeight })
    })
    resizeObserver.observe(containerRef.current)

    // Cleanup: destruimos los charts al desmontar el componente
    return () => {
      resizeObserver.disconnect()
      chart.remove()
      rsiChart.remove()
      macdChart.remove()
    }
  }, []) // Solo se ejecuta una vez al montar

  return {
    chartRef, candleSeriesRef,
    ema20SeriesRef, ema50SeriesRef,
    bbUpperRef, bbMiddleRef, bbLowerRef,
    fibLinesRef, chartMainRef: chartRef,
    rsiSeriesRef, rsiOBRef, rsiOSRef,
    macdLineRef, macdSignalRef, macdHistRef,
    rsiChartRef, macdChartRef,
  }
}

// ── Componente principal ChartPanel ──────────────────────────
export default function ChartPanel() {
  // Refs de los contenedores DOM de los tres charts
  const containerRef = useRef(null) // Chart principal (velas)
  const rsiRef       = useRef(null) // Sub-panel RSI
  const macdRef      = useRef(null) // Sub-panel MACD

  // Datos del store global
  // lastTick es el tick individual más reciente — lo usamos para series.update() directo
  // candleData NO se subscribe aquí para evitar re-renders en cada tick (500ms)
  const { activePair, activeTF, indicators, lastTick } = useStore()

  // Creamos los charts (hook)
  const {
    chartRef, candleSeriesRef,
    ema20SeriesRef, ema50SeriesRef,
    bbUpperRef, bbMiddleRef, bbLowerRef,
    fibLinesRef, chartMainRef,
    rsiSeriesRef, rsiOBRef, rsiOSRef,
    macdLineRef, macdSignalRef, macdHistRef,
    rsiChartRef, macdChartRef,
  } = useTVChart(containerRef, rsiRef, macdRef)

  // ── TICK EN TIEMPO REAL: series.update() cada 500ms ──────
  // Esta es la clave para animación fluida: NO redibujamos todo el chart,
  // solo actualizamos la vela actual con series.update() — igual que un broker.
  // Este efecto corre cada 500ms (cuando lastTick cambia).
  useEffect(() => {
    if (!lastTick) return
    const activeKey = `${activePair}_${activeTF}`
    if (lastTick.key !== activeKey) return
    if (!candleSeriesRef.current) return

    // series.update() actualiza SOLO la vela actual sin redibujar el chart completo
    // Esto da la animación fluida de cuerpo/mecha que se ve en los brokers reales
    candleSeriesRef.current.update(lastTick.candle)
  }, [lastTick, activePair, activeTF])

  // ── CARGA INICIAL: setData() cuando cambia par o TF ──────
  // Solo se ejecuta al cambiar de par/timeframe, NO en cada tick.
  // Leemos las velas del store directamente (no del closure) para tener los datos más frescos.
  useEffect(() => {
    const key     = `${activePair}_${activeTF}`
    // Leemos directo del store para evitar el closure stale (sin añadir candleData a deps)
    const candles = useStore.getState().candleData[key]
    if (!candles || candles.length < 2) return

    const closes = candles.map(c => c.close)
    const highs  = candles.map(c => c.high)
    const lows   = candles.map(c => c.low)

    // ── Velas principales (carga inicial completa) ─────
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData(candles)
    }

    // ── EMA 20 y EMA 50 ───────────────────────────────
    const ema20Arr = calculateEMAArray(closes, 20)
    const ema50Arr = calculateEMAArray(closes, 50)

    // Alineamos los arrays EMA con los timestamps de las velas
    const ema20Data = ema20Arr.map((value, i) => ({
      time:  candles[i + 20 - 1]?.time,
      value,
    })).filter(d => d.time)

    const ema50Data = ema50Arr.map((value, i) => ({
      time:  candles[i + 50 - 1]?.time,
      value,
    })).filter(d => d.time)

    if (ema20SeriesRef.current) ema20SeriesRef.current.setData(ema20Data)
    if (ema50SeriesRef.current) ema50SeriesRef.current.setData(ema50Data)

    // ── Bollinger Bands ──────────────────────────────
    // Calculamos BB rolling para cada vela (ventana deslizante de 20)
    const bbUpperData  = []
    const bbMiddleData = []
    const bbLowerData  = []

    for (let i = 19; i < closes.length; i++) {
      const slice  = closes.slice(i - 19, i + 1)
      const sma    = slice.reduce((a, b) => a + b, 0) / 20
      const stdDev = Math.sqrt(slice.reduce((a, v) => a + Math.pow(v - sma, 2), 0) / 20)
      const time   = candles[i].time

      bbUpperData.push(  { time, value: parseFloat((sma + 2 * stdDev).toFixed(5)) })
      bbMiddleData.push( { time, value: parseFloat(sma.toFixed(5)) })
      bbLowerData.push(  { time, value: parseFloat((sma - 2 * stdDev).toFixed(5)) })
    }

    if (bbUpperRef.current)  bbUpperRef.current.setData(bbUpperData)
    if (bbMiddleRef.current) bbMiddleRef.current.setData(bbMiddleData)
    if (bbLowerRef.current)  bbLowerRef.current.setData(bbLowerData)

    // ── Fibonacci: dibujamos líneas de precio ────────
    // Eliminamos las líneas previas de Fibonacci
    if (chartRef.current && fibLinesRef.current.length > 0) {
      fibLinesRef.current.forEach(series => {
        try { chartRef.current.removeSeries(series) } catch {}
      })
      fibLinesRef.current = []
    }

    // Colores para cada nivel de Fibonacci
    const fibColors = {
      '0.0%':   'rgba(156,163,175,0.3)',
      '23.6%':  'rgba(251,191,36,0.5)',
      '38.2%':  'rgba(249,115,22,0.5)',
      '50.0%':  'rgba(148,163,184,0.5)',
      '61.8%':  'rgba(59,130,246,0.7)', // OTE - más prominente
      '78.6%':  'rgba(167,139,250,0.5)',
      '100.0%': 'rgba(156,163,175,0.3)',
    }

    if (chartRef.current && indicators.fibonacci) {
      indicators.fibonacci.forEach(fib => {
        const series = chartRef.current.addLineSeries({
          color:     fibColors[fib.label] || 'rgba(255,255,255,0.2)',
          lineWidth: fib.isOTE ? 2 : 1,
          lineStyle: fib.isOTE ? LineStyle.Solid : LineStyle.Dashed,
          priceLineVisible: true,
          priceLineWidth:   fib.isOTE ? 2 : 1,
          priceLineColor:   fibColors[fib.label] || 'rgba(255,255,255,0.2)',
          lastValueVisible: true,
          title: `Fib ${fib.label}`,
        })
        // Dibujamos una línea horizontal en el nivel de Fibonacci
        const firstTime = candles[0].time
        const lastTime  = candles[candles.length - 1].time
        series.setData([
          { time: firstTime, value: fib.level },
          { time: lastTime,  value: fib.level },
        ])
        fibLinesRef.current.push(series)
      })
    }

    // ── RSI: calculamos array histórico ──────────────
    if (rsiSeriesRef.current) {
      const rsiData = []
      // Calculamos RSI para cada punto desde la vela 14 en adelante
      for (let i = 14; i < closes.length; i++) {
        const slice = closes.slice(0, i + 1)
        const rsi   = calculateRSI(slice)
        if (rsi !== null) {
          rsiData.push({ time: candles[i].time, value: rsi })
        }
      }
      rsiSeriesRef.current.setData(rsiData)

      // Líneas de referencia en 70 y 30
      const rsiTimes = [candles[0].time, candles[candles.length - 1].time]
      if (rsiOBRef.current) rsiOBRef.current.setData(rsiTimes.map(t => ({ time: t, value: 70 })))
      if (rsiOSRef.current) rsiOSRef.current.setData(rsiTimes.map(t => ({ time: t, value: 30 })))
    }

    // ── MACD: calculamos array histórico ─────────────
    if (macdLineRef.current) {
      const macdLineData = []
      const macdSigData  = []
      const macdHistData = []

      // Calculamos MACD para cada punto desde la vela 35 en adelante
      for (let i = 35; i < closes.length; i++) {
        const slice = closes.slice(0, i + 1)

        // Calculamos EMA 12 y 26 para este slice
        const k12 = 2 / (12 + 1)
        const k26 = 2 / (26 + 1)

        let ema12 = slice.slice(0, 12).reduce((a, b) => a + b, 0) / 12
        let ema26 = slice.slice(0, 26).reduce((a, b) => a + b, 0) / 26

        for (let j = 12; j < slice.length; j++) ema12 = slice[j] * k12 + ema12 * (1 - k12)
        for (let j = 26; j < slice.length; j++) ema26 = slice[j] * k26 + ema26 * (1 - k26)

        const macdVal = parseFloat((ema12 - ema26).toFixed(5))
        const time    = candles[i].time

        macdLineData.push({ time, value: macdVal })
        // Señal simplificada: EMA9 del MACD (usamos valor anterior como aproximación)
        if (macdLineData.length >= 9) {
          const last9  = macdLineData.slice(-9).map(d => d.value)
          const sigVal = last9.reduce((a, b) => a + b, 0) / 9
          macdSigData.push({ time, value: parseFloat(sigVal.toFixed(5)) })
          macdHistData.push({
            time,
            value: parseFloat((macdVal - sigVal).toFixed(5)),
            color: macdVal > sigVal ? 'rgba(38,166,154,0.7)' : 'rgba(239,83,80,0.7)',
          })
        }
      }

      macdLineRef.current.setData(macdLineData)
      if (macdSignalRef.current) macdSignalRef.current.setData(macdSigData)
      if (macdHistRef.current)   macdHistRef.current.setData(macdHistData)
    }

    // Ajustamos vista al contenido en la carga inicial (no en cada tick)
    if (chartRef.current) chartRef.current.timeScale().fitContent()
    if (rsiChartRef.current) rsiChartRef.current.timeScale().fitContent()
    if (macdChartRef.current) macdChartRef.current.timeScale().fitContent()

  // Solo re-ejecutamos al cambiar par/TF o indicadores (NO en cada tick)
  // Los ticks se manejan arriba con series.update() vía lastTick
  }, [activePair, activeTF, indicators])

  return (
    // ── Layout: 3 paneles verticales (velas + RSI + MACD) ──
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">

      {/* ── Gráfico principal de velas ───────────────────── */}
      <div className="relative" style={{ flex: '1 1 60%', minHeight: 0 }}>
        {/* Etiquetas de overlays activos */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-2 pointer-events-none">
          <span className="text-[10px] font-bold" style={{ color: '#3B82F6' }}>EMA20</span>
          <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>EMA50</span>
          <span className="text-[10px] font-bold text-muted">BB(20,2)</span>
          <span className="text-[10px] font-bold" style={{ color: 'rgba(59,130,246,0.9)' }}>FIB</span>
        </div>
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* ── Sub-panel RSI ────────────────────────────────── */}
      <div className="relative border-t border-border" style={{ flex: '0 0 18%', minHeight: 0 }}>
        <div className="absolute top-1 left-2 z-10 pointer-events-none">
          <span className="text-[10px] font-bold text-muted">RSI(14)</span>
        </div>
        <div ref={rsiRef} className="w-full h-full" />
      </div>

      {/* ── Sub-panel MACD ───────────────────────────────── */}
      <div className="relative border-t border-border" style={{ flex: '0 0 18%', minHeight: 0 }}>
        <div className="absolute top-1 left-2 z-10 pointer-events-none">
          <span className="text-[10px] font-bold text-muted">MACD(12,26,9)</span>
        </div>
        <div ref={macdRef} className="w-full h-full" />
      </div>
    </div>
  )
}
