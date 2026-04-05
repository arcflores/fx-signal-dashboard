// ─────────────────────────────────────────────────────────────
// App.jsx — Componente raíz de la aplicación
// Define el layout principal de 3 columnas:
//
//  ┌──────────────────────────────────────────────────────┐
//  │                    HEADER (topbar)                   │
//  ├──────────┬──────────────────────────┬────────────────┤
//  │          │                          │                │
//  │Watchlist │      ChartPanel          │  SignalPanel   │
//  │ (left)   │   (velas + RSI + MACD)   │  + ClaudePanel │
//  │          │                          │   (right)      │
//  │          ├──────────────────────────┤                │
//  │          │      BottomPanel         │                │
//  │          │  (calendar/news/history) │                │
//  └──────────┴──────────────────────────┴────────────────┘
//
// También monta los hooks de datos en background:
//   - useBinanceWS: WebSocket de datos crypto en tiempo real
//   - useForexMock: Simulador de datos Forex
//   - useSignals:   Motor de cálculo de señales técnicas
// ─────────────────────────────────────────────────────────────
import { useEffect } from 'react'
import Header      from './components/Header'
import Watchlist   from './components/Watchlist'
import ChartPanel  from './components/ChartPanel'
import SignalPanel from './components/SignalPanel'
import ClaudePanel from './components/ClaudePanel'
import BottomPanel from './components/BottomPanel'

// Hooks de datos y señales
import useBinanceWS from './hooks/useBinanceWS'
import useSignals   from './hooks/useSignals'
import useForexMock from './hooks/useForexMock'

// ── Componente principal de la aplicación ────────────────────
export default function App() {
  // ── Montamos los hooks de datos en background ────────────
  // Estos hooks no renderizan nada, solo leen/escriben en el store.
  const { isConnected } = useBinanceWS()  // WebSocket Binance (crypto)
  useForexMock()                          // Simulador Forex (mock)
  useSignals()                            // Motor de señales técnicas

  return (
    // ── Contenedor principal: ocupa toda la pantalla ──────
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg text-text-primary">

      {/* ── Header: barra superior fija ───────────────────── */}
      <Header isConnected={isConnected} />

      {/* ── Área principal: tres columnas ────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── Columna izquierda: Watchlist de pares ──────── */}
        <Watchlist />

        {/* ── Columna central: Chart + Panel inferior ────── */}
        {/* flex-1 hace que esta columna ocupe todo el espacio sobrante */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">

          {/* Gráfico TradingView (ocupa ~65% de la altura) */}
          <div className="flex-1 overflow-hidden min-h-0">
            <ChartPanel />
          </div>

          {/* Panel inferior con tabs: Calendar / News / History */}
          {/* Altura fija de 200px, colapsable en pantallas pequeñas */}
          <div className="h-48 border-t border-border flex-shrink-0 overflow-hidden">
            <BottomPanel />
          </div>
        </div>

        {/* ── Columna derecha: Señales + Claude AI ──────── */}
        {/* Dividida verticalmente en dos secciones */}
        <div className="flex flex-col w-52 border-l border-border flex-shrink-0 overflow-hidden">

          {/* Panel de señales técnicas (8 indicadores) */}
          {/* Ocupa ~55% de la columna derecha */}
          <div className="flex-1 overflow-hidden min-h-0 border-b border-border">
            <SignalPanel />
          </div>

          {/* Panel de Claude AI (veredicto CALL/PUT) */}
          {/* Ocupa ~45% de la columna derecha */}
          <div className="flex-shrink-0" style={{ height: '45%' }}>
            <ClaudePanel />
          </div>
        </div>
      </div>
    </div>
  )
}
