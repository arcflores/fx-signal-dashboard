// ─────────────────────────────────────────────────────────────
// App.jsx — Layout principal estilo TradeStation
//
// LAYOUT:
//  ┌────────────────────────────────────────────────────────────┐
//  │                   HEADER (topbar, h-12)                    │
//  ├──┬──║──────┬──────────────────────────║──────────────────┤
//  │  │  ║      │                          ║                  │
//  │LT│  ║Watch │      ChartPanel          ║  Prediction      │
//  │  │ ≡║list  │  (velas+RSI+MACD)        ║  Scanner +       │
//  │  │  ║      │  + Drawing tools         ║  Virtual Orders  │
//  │  │  ║      ├──────────────────────────║  + Signals       │
//  │  │  ║      │   BottomPanel            ║                  │
//  └──┴──║──────┴──────────────────────────║──────────────────┘
//
// ≡ = Drag handles para redimensionar columnas
//
// Funcionalidades:
//   ✦ Scanner automático de predicciones (todas las parejas)
//   ✦ Órdenes virtuales con Entry/SL/TP para evaluar
//   ✦ Auto-rotación: cuando una orden cierra, escanea siguiente
//   ✦ Herramientas de dibujo funcionales (H-Line, Trendline, Fib)
//   ✦ Indicadores configurables (periodos editables)
//   ✦ Market Depth (Level 2 + Time & Sales) en bottom panel
// ─────────────────────────────────────────────────────────────
import { useState, useCallback, useRef } from 'react'
import Header          from './components/Header'
import LeftToolbar     from './components/LeftToolbar'
import Watchlist       from './components/Watchlist'
import ChartPanel      from './components/ChartPanel'
import PredictionPanel from './components/PredictionPanel'
import BottomPanel     from './components/BottomPanel'

import useBinanceWS          from './hooks/useBinanceWS'
import useSignals             from './hooks/useSignals'
import useForexMock           from './hooks/useForexMock'
import usePredictionScanner   from './hooks/usePredictionScanner'

// ── ResizeHandle: handle de arrastre entre columnas ──────────
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
  usePredictionScanner()

  // ── Estado de anchos de columna (redimensionables) ────────
  const [watchlistWidth, setWatchlistWidth]   = useState(130)
  const [rightPanelWidth, setRightPanelWidth] = useState(280)
  const [bottomHeight, setBottomHeight]       = useState(140)

  const resizeWatchlist = useCallback((delta) => {
    setWatchlistWidth(w => Math.max(80, Math.min(220, w + delta)))
  }, [])

  const resizeRightPanel = useCallback((delta) => {
    setRightPanelWidth(w => Math.max(200, Math.min(400, w - delta)))
  }, [])

  const resizeBottom = useCallback((delta) => {
    setBottomHeight(h => Math.max(60, Math.min(300, h - delta)))
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

      {/* ── Área principal ───────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>

        {/* ── Col 1: Left Toolbar ───────────────────────── */}
        <LeftToolbar />

        {/* ── Col 2: Watchlist ───────────────────────────── */}
        <div style={{ width: watchlistWidth, flexShrink: 0, overflow: 'hidden' }}>
          <Watchlist />
        </div>

        <ResizeHandle onDelta={resizeWatchlist} />

        {/* ── Col 3: Chart + Bottom ─────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

          {/* Chart */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
              <ChartPanel />
            </div>
          </div>

          {/* Resize handle bottom */}
          <ResizeHandle onDelta={resizeBottom} vertical />

          {/* Bottom panel */}
          <div style={{ height: bottomHeight, flexShrink: 0 }}>
            <BottomPanel />
          </div>
        </div>

        <ResizeHandle onDelta={resizeRightPanel} />

        {/* ── Col 4: Prediction Scanner ─────────────────── */}
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
          <PredictionPanel />
        </div>

      </div>
    </div>
  )
}
