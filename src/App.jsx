// ─────────────────────────────────────────────────────────────
// App.jsx — Layout principal de la plataforma (estilo TradingView)
//
// Layout:
//  ┌────────────────────────────────────────────────────────────┐
//  │                   HEADER (topbar, h-12)                    │
//  ├──────┬────────┬────────────────────────────┬───────────────┤
//  │      │        │                            │               │
//  │ Left │Watch   │      ChartPanel             │  SignalPanel  │
//  │Toolbar│ list  │  (velas + RSI + MACD)       │  +            │
//  │(44px)│(120px) │  Leyenda OHLCV + Volumen    │  ClaudePanel  │
//  │      │        │                            │  (230px)      │
//  │      │        ├────────────────────────────│               │
//  │      │        │   BottomPanel (h-36)        │               │
//  │      │        │ Calendar | News | History   │               │
//  └──────┴────────┴────────────────────────────┴───────────────┘
//
// Hooks de datos montados en background:
//   - useBinanceWS  WebSocket Binance (crypto real-time)
//   - useForexMock  Simulador Forex con tick 500ms
//   - useSignals    Motor de señales técnicas
// ─────────────────────────────────────────────────────────────
import Header      from './components/Header'
import LeftToolbar from './components/LeftToolbar'
import Watchlist   from './components/Watchlist'
import ChartPanel  from './components/ChartPanel'
import SignalPanel from './components/SignalPanel'
import ClaudePanel from './components/ClaudePanel'
import BottomPanel from './components/BottomPanel'

// Hooks de datos (no renderizan nada — solo leen/escriben en el store)
import useBinanceWS from './hooks/useBinanceWS'
import useSignals   from './hooks/useSignals'
import useForexMock from './hooks/useForexMock'

export default function App() {
  // ── Montamos los hooks de datos en background ────────────
  const { isConnected } = useBinanceWS()
  useForexMock()
  useSignals()

  return (
    // ── Contenedor principal: ocupa toda la pantalla ──────
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text-primary"
         style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* ── Header: barra superior estilo TradingView ─────── */}
      <Header isConnected={isConnected} />

      {/* ── Área principal: cuatro columnas ──────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Col 1: LeftToolbar — herramientas de dibujo ── */}
        {/* 44px, igual que TradingView */}
        <LeftToolbar />

        {/* ── Col 2: Watchlist de pares Forex/Crypto ───────── */}
        {/* 120px, compact list con precios en tiempo real */}
        <Watchlist />

        {/* ── Col 3: Chart + Panel inferior ────────────────── */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Gráfico principal: ocupa todo el espacio disponible menos el bottom */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ChartPanel />
          </div>

          {/* Panel inferior: Calendario / Noticias / Historial */}
          <div className="border-t border-border flex-shrink-0" style={{ height: '144px' }}>
            <BottomPanel />
          </div>
        </div>

        {/* ── Col 4: Señales + Claude AI ────────────────────── */}
        {/* Dividida verticalmente: señales (~55%) + claude (~45%) */}
        <div
          className="flex flex-col border-l border-border flex-shrink-0 overflow-hidden bg-bg"
          style={{ width: '234px' }}
        >
          {/* Panel de señales técnicas (semáforo de indicadores) */}
          <div className="flex-1 overflow-hidden min-h-0 border-b border-border">
            <SignalPanel />
          </div>

          {/* Panel de Claude AI (veredicto CALL/PUT) */}
          <div className="flex-shrink-0 overflow-hidden" style={{ height: '46%' }}>
            <ClaudePanel />
          </div>
        </div>

      </div>
    </div>
  )
}
