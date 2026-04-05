// ─────────────────────────────────────────────────────────────
// App.jsx — Layout principal estilo TradingView / TradeStation
//
// LAYOUT:
//  ┌────────────────────────────────────────────────────────────┐
//  │                   HEADER (topbar, h-12)                    │
//  ├──┬──║──────┬──────────────────────────║──────────────────┤
//  │  │  ║      │                          ║                  │
//  │LT│  ║Watch │      ChartPanel          ║  Signals +       │
//  │  │ ≡║list  │  (velas+RSI+MACD)        ║  Claude AI +     │
//  │  │  ║      │  OHLCV legend + Volume   ║  Trade Entry     │
//  │  │  ║      ├──────────────────────────║                  │
//  │  │  ║      │   BottomPanel (h-36)     ║                  │
//  └──┴──║──────┴──────────────────────────║──────────────────┘
//
// ≡ = Drag handles para redimensionar columnas
//
// Funcionalidades:
//   ✦ Resize handles entre columnas (arrastrar para ajustar ancho)
//   ✦ Trade Entry Panel (CALL/PUT + expiración + monto)
//   ✦ Hooks de datos: Binance WebSocket, Forex Mock, Signals
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react'
import Header      from './components/Header'
import LeftToolbar from './components/LeftToolbar'
import Watchlist   from './components/Watchlist'
import ChartPanel  from './components/ChartPanel'
import SignalPanel from './components/SignalPanel'
import ClaudePanel from './components/ClaudePanel'
import TradePanel  from './components/TradePanel'
import BottomPanel from './components/BottomPanel'

import useBinanceWS from './hooks/useBinanceWS'
import useSignals   from './hooks/useSignals'
import useForexMock from './hooks/useForexMock'

// ── ResizeHandle: handle de arrastre entre columnas ──────────
// Permite al usuario redimensionar las columnas arrastrando.
// 'onDelta' recibe el delta en px del arrastre (positivo = derecha).
function ResizeHandle({ onDelta, vertical = false }) {
  const dragRef = useRef(null)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    const startPos = vertical ? e.clientY : e.clientX

    const onMouseMove = (e) => {
      const delta = (vertical ? e.clientY : e.clientX) - startPos
      onDelta(delta)
    }
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = vertical ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }, [onDelta, vertical])

  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className={`flex-shrink-0 group relative z-10 transition-colors
        ${vertical
          ? 'h-1 w-full cursor-row-resize hover:bg-accent/40 bg-border'
          : 'w-1 h-full cursor-col-resize hover:bg-accent/40 bg-border'
        }`}
      title="Arrastrar para redimensionar"
    >
      {/* Indicador visual del handle */}
      <div className={`absolute inset-0 flex items-center justify-center opacity-0
                       group-hover:opacity-100 transition-opacity pointer-events-none`}>
        {vertical
          ? <div className="flex gap-0.5"><div className="w-8 h-0.5 bg-accent/60 rounded" /></div>
          : <div className="flex flex-col gap-0.5"><div className="h-8 w-0.5 bg-accent/60 rounded" /></div>
        }
      </div>
    </div>
  )
}

// ── Componente principal App ──────────────────────────────────
export default function App() {
  // ── Hooks de datos en background ─────────────────────────
  const { isConnected } = useBinanceWS()
  useForexMock()
  useSignals()

  // ── Estado de anchos de columna (redimensionables) ────────
  const [watchlistWidth, setWatchlistWidth]   = useState(130)   // px
  const [rightPanelWidth, setRightPanelWidth] = useState(240)   // px

  // ── Estado de alturas del panel derecho ───────────────────
  const [signalHeight, setSignalHeight]       = useState(45)    // % de la col derecha

  // Callbacks de resize — actualizan los anchos con límites mínimos/máximos
  const resizeWatchlist = useCallback((delta) => {
    setWatchlistWidth(w => Math.max(80, Math.min(220, w + delta)))
  }, [])

  const resizeRightPanel = useCallback((delta) => {
    setRightPanelWidth(w => Math.max(180, Math.min(380, w - delta)))
  }, [])

  const resizeSignalPanel = useCallback((delta) => {
    setSignalHeight(h => Math.max(25, Math.min(70, h + delta / 8)))
  }, [])

  return (
    <div
      className="flex flex-col overflow-hidden bg-bg text-text-primary"
      style={{
        width: '100vw',
        height: '100vh',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <Header isConnected={isConnected} />

      {/* ── Área principal con 4 columnas ─────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Col 1: Left Toolbar (herramientas de dibujo) ── */}
        <LeftToolbar />

        {/* ── Col 2: Watchlist (redimensionable) ─────────── */}
        <div style={{ width: watchlistWidth, flexShrink: 0, overflow: 'hidden' }}>
          <Watchlist />
        </div>

        {/* ── Handle resize watchlist / chart ─────────────── */}
        <ResizeHandle onDelta={resizeWatchlist} />

        {/* ── Col 3: Chart + Bottom panel ─────────────────── */}
        {/* flex: 1 → toma todo el espacio sobrante */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* CHART: ocupa todo el espacio disponible menos el BottomPanel */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* El wrapper explícito con display:flex asegura que ChartPanel recibe altura */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <ChartPanel />
            </div>
          </div>

          {/* Bottom panel: Calendario / Noticias / Historial */}
          <div style={{ height: '140px', flexShrink: 0, borderTop: '1px solid #1E2732' }}>
            <BottomPanel />
          </div>
        </div>

        {/* ── Handle resize chart / right panel ───────────── */}
        <ResizeHandle onDelta={resizeRightPanel} />

        {/* ── Col 4: Panel derecho (Señales + Claude + Trade) ─ */}
        <div
          style={{
            width: rightPanelWidth,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderLeft: '1px solid #1E2732',
            background: '#0B0E11',
          }}
        >
          {/* Señales técnicas */}
          <div style={{ flex: `0 0 ${signalHeight}%`, overflow: 'hidden', borderBottom: '1px solid #1E2732' }}>
            <SignalPanel />
          </div>

          {/* Handle resize signals / claude */}
          <ResizeHandle onDelta={resizeSignalPanel} vertical />

          {/* Claude AI */}
          <div style={{ flex: '1 1 0%', overflow: 'hidden', minHeight: 0, borderBottom: '1px solid #1E2732' }}>
            <ClaudePanel />
          </div>

          {/* Trade Entry Panel (CALL/PUT) */}
          <div style={{ flexShrink: 0 }}>
            <TradePanel />
          </div>
        </div>

      </div>
    </div>
  )
}
