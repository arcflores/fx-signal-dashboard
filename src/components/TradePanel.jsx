// ─────────────────────────────────────────────────────────────
// TradePanel.jsx — Panel de Profundidad de Mercado
//
// Módulo de análisis (SOLO LECTURA — sin ejecución de órdenes).
// Simula en tiempo real:
//
//   ✦ Level 2 (Order Book): Bids y Asks con profundidad y tamaño
//   ✦ Time & Sales (Tape): Flujo de órdenes recientes, bloques grandes
//   ✦ Spread actual
//   ✦ Indicador de presión compradora vs vendedora (ΔVOL)
//
// Propósito: lectura del order flow como lo hacen TradeStation / DAS Trader.
// Los datos son simulados pero se comportan realistamente alrededor
// del precio de mercado actual con spread apropiado por par.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { Activity, BookOpen, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import useStore from '../store/useStore'
import { PAIR_CONFIG } from '../utils/mockForex'

// ── Constantes ───────────────────────────────────────────────
const BOOK_LEVELS  = 8   // Niveles de bid/ask a mostrar
const TAPE_MAX     = 40  // Máximo de entradas en el tape
const TICK_MS      = 800 // Velocidad de actualización del book
const TAPE_MS      = 600 // Velocidad de nuevas entradas en el tape

// ── Genera un nivel de book (bid o ask) alrededor de un precio base
function genLevel(basePrice, tickSize, offset, side) {
  const price = side === 'ask'
    ? parseFloat((basePrice + offset * tickSize).toFixed(5))
    : parseFloat((basePrice - offset * tickSize).toFixed(5))
  const size  = Math.floor(500 + Math.random() * 4500)
  const total = Math.floor(size * (1 + Math.random() * 3))
  return { price, size, total }
}

// ── Genera el order book completo alrededor del precio actual ─
function generateBook(basePrice, decimals, spreadPips) {
  const tickSize = 1 / Math.pow(10, decimals)
  const spreadOff = spreadPips * tickSize

  const midPrice = basePrice
  const askBase  = parseFloat((midPrice + spreadOff / 2).toFixed(decimals))
  const bidBase  = parseFloat((midPrice - spreadOff / 2).toFixed(decimals))

  const asks = Array.from({ length: BOOK_LEVELS }, (_, i) =>
    genLevel(askBase, tickSize, i, 'ask')
  ).reverse() // ASK: el más bajo arriba en la pantalla

  const bids = Array.from({ length: BOOK_LEVELS }, (_, i) =>
    genLevel(bidBase, tickSize, i, 'bid')
  )

  const spread = parseFloat((asks[asks.length - 1].price - bids[0].price).toFixed(decimals))
  const spreadPct = ((spread / midPrice) * 100).toFixed(4)

  return { asks, bids, spread, spreadPct, midPrice }
}

// ── Genera una entrada del Time & Sales tape ──────────────────
function genTapeEntry(price, decimals) {
  const isBlock   = Math.random() < 0.08            // 8% son bloques grandes
  const isBuy     = Math.random() > 0.5
  const tickSize  = 1 / Math.pow(10, decimals)
  const px        = parseFloat((price + (Math.random() - 0.5) * tickSize * 3).toFixed(decimals))
  const size      = isBlock
    ? Math.floor(5000  + Math.random() * 20000)
    : Math.floor(100   + Math.random() * 2000)

  const now = new Date()
  return {
    id:      Date.now() + Math.random(),
    time:    `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`,
    price:   px,
    size,
    isBuy,
    isBlock,
  }
}

// ── Barra de volumen del book (visual de profundidad) ─────────
function BookBar({ size, maxSize, side }) {
  const pct = Math.min(100, (size / maxSize) * 100)
  return (
    <div className="absolute inset-y-0 right-0 opacity-30"
         style={{
           width:      `${pct}%`,
           background: side === 'bid' ? '#26A69A' : '#EF5350',
         }}
    />
  )
}

// ── Panel de Order Book (Level 2) ─────────────────────────────
function OrderBook({ book, decimals, activePair }) {
  if (!book) return null
  const { asks, bids, spread } = book

  const allSizes = [...asks, ...bids].map(l => l.size)
  const maxSize  = Math.max(...allSizes, 1)

  return (
    <div className="flex flex-col text-[10px] font-mono">

      {/* Header columns */}
      <div className="flex items-center justify-between px-2 py-0.5
                      text-[9px] text-muted font-sans border-b border-border/40 mb-0.5">
        <span className="w-16">Precio</span>
        <span className="text-right flex-1">Tamaño</span>
        <span className="text-right w-16">Total</span>
      </div>

      {/* ASK levels (rojo, invertidos) */}
      {asks.map((level, i) => (
        <div key={i} className="relative flex items-center justify-between px-2 py-[2px]
                                 hover:bg-surface/60 transition-colors">
          <BookBar size={level.size} maxSize={maxSize} side="ask" />
          <span className="text-put z-10 w-16">{level.price.toFixed(decimals)}</span>
          <span className="text-text-secondary z-10 flex-1 text-right">{level.size.toLocaleString()}</span>
          <span className="text-muted z-10 w-16 text-right">{level.total.toLocaleString()}</span>
        </div>
      ))}

      {/* Spread */}
      <div className="flex items-center justify-center gap-3 py-1.5 bg-[#0D1117]
                      text-[9px] border-y border-border/60 my-0.5">
        <span className="text-muted">SPREAD</span>
        <span className="text-accent font-semibold">{spread.toFixed(decimals)}</span>
        <span className="text-muted">{activePair}</span>
      </div>

      {/* BID levels (verde) */}
      {bids.map((level, i) => (
        <div key={i} className="relative flex items-center justify-between px-2 py-[2px]
                                 hover:bg-surface/60 transition-colors">
          <BookBar size={level.size} maxSize={maxSize} side="bid" />
          <span className="text-call z-10 w-16">{level.price.toFixed(decimals)}</span>
          <span className="text-text-secondary z-10 flex-1 text-right">{level.size.toLocaleString()}</span>
          <span className="text-muted z-10 w-16 text-right">{level.total.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

// ── Panel de Time & Sales (Tape) ──────────────────────────────
function TapePanel({ entries, decimals }) {
  const listRef = useRef(null)

  // Auto-scroll al tope cuando llegan nuevas entradas
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [entries.length])

  return (
    <div ref={listRef} className="overflow-y-auto flex flex-col gap-px pr-0.5"
         style={{ maxHeight: '100%' }}>

      {/* Header */}
      <div className="sticky top-0 flex items-center justify-between px-2 py-1
                      text-[9px] text-muted bg-[#0B0E11] border-b border-border/40 z-10 font-sans">
        <span className="w-14">Hora</span>
        <span className="flex-1 text-center">Precio</span>
        <span className="w-16 text-right">Tamaño</span>
      </div>

      {entries.map(e => (
        <div key={e.id}
          className={`flex items-center justify-between px-2 py-[2px] text-[10px] font-mono
                      transition-colors hover:bg-surface/50
                      ${e.isBlock ? 'bg-warn/10 font-bold' : ''}`}
        >
          <span className="text-muted w-14 text-[9px]">{e.time}</span>
          <span className={`flex-1 text-center ${e.isBuy ? 'text-call' : 'text-put'}`}>
            {e.price.toFixed(decimals)}
          </span>
          <span className={`w-16 text-right text-[10px]
            ${e.isBlock ? (e.isBuy ? 'text-call font-bold' : 'text-put font-bold') : 'text-text-secondary'}`}>
            {e.size >= 1000 ? `${(e.size/1000).toFixed(1)}K` : e.size}
            {e.isBlock && ' ⚡'}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Indicador de presión compradora/vendedora ─────────────────
function FlowPressure({ tape }) {
  if (!tape || tape.length < 5) return null

  const recent   = tape.slice(0, 20)
  const buyVol   = recent.filter(e => e.isBuy).reduce((s, e) => s + e.size, 0)
  const sellVol  = recent.filter(e => !e.isBuy).reduce((s, e) => s + e.size, 0)
  const total    = buyVol + sellVol || 1
  const buyPct   = Math.round((buyVol / total) * 100)
  const sellPct  = 100 - buyPct
  const dominant = buyPct > 55 ? 'COMPRADORES' : sellPct > 55 ? 'VENDEDORES' : 'NEUTRAL'
  const domColor = buyPct > 55 ? '#26A69A' : sellPct > 55 ? '#EF5350' : '#64748B'

  return (
    <div className="px-2 py-1 border-t border-border/40">
      <div className="flex items-center justify-between mb-1 text-[9px]">
        <span className="text-muted">FLUJO (últimas 20)</span>
        <span className="font-bold" style={{ color: domColor }}>{dominant}</span>
      </div>
      {/* Barra de presión */}
      <div className="flex h-2 rounded-full overflow-hidden bg-surface">
        <div style={{ width: `${buyPct}%`, background: '#26A69A' }} className="transition-all duration-500" />
        <div style={{ width: `${sellPct}%`, background: '#EF5350' }} className="transition-all duration-500" />
      </div>
      <div className="flex justify-between text-[9px] mt-0.5">
        <span className="text-call">{buyPct}% Buy</span>
        <span className="text-put">{sellPct}% Sell</span>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────
export default function TradePanel() {
  const { activePair, currentPrice } = useStore()
  const pairCfg  = PAIR_CONFIG[activePair] ?? { decimals: 5, spread: 1.2 }
  const decimals = pairCfg.decimals ?? 5

  // ── Tabs: Book | Tape
  const [activeTab, setActiveTab] = useState('book')

  // ── Estado del book y tape ────────────────────────────────
  const [book,  setBook]  = useState(null)
  const [tape,  setTape]  = useState([])
  const priceRef = useRef(currentPrice)

  // Sync precio actual
  useEffect(() => { priceRef.current = currentPrice }, [currentPrice])

  // ── Actualización del Order Book ──────────────────────────
  useEffect(() => {
    const update = () => {
      const px = priceRef.current
      if (!px) return
      setBook(generateBook(px, decimals, pairCfg.spread ?? 1.2))
    }
    update()
    const id = setInterval(update, TICK_MS)
    return () => clearInterval(id)
  }, [activePair, decimals])

  // ── Actualización del Time & Sales ────────────────────────
  useEffect(() => {
    const add = () => {
      const px = priceRef.current
      if (!px) return
      const entry = genTapeEntry(px, decimals)
      setTape(prev => [entry, ...prev].slice(0, TAPE_MAX))
    }
    const id = setInterval(add, TAPE_MS)
    return () => clearInterval(id)
  }, [activePair, decimals])

  // ── Reset al cambiar par ──────────────────────────────────
  useEffect(() => {
    setBook(null)
    setTape([])
  }, [activePair])

  return (
    <div className="flex flex-col bg-[#0B0E11] border-t border-border/60 select-none"
         style={{ height: '100%', overflow: 'hidden' }}>

      {/* ── Header con tabs ─────────────────────────────── */}
      <div className="flex items-center border-b border-border/60 flex-shrink-0">
        <button
          onClick={() => setActiveTab('book')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold
                      border-b-2 transition-colors
                      ${activeTab === 'book'
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted hover:text-text-secondary'}`}
        >
          <BookOpen size={10} />
          Level 2
        </button>
        <button
          onClick={() => setActiveTab('tape')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold
                      border-b-2 transition-colors
                      ${activeTab === 'tape'
                        ? 'border-accent text-accent'
                        : 'border-transparent text-muted hover:text-text-secondary'}`}
        >
          <Activity size={10} />
          Time & Sales
        </button>

        {/* Precio actual en tiempo real */}
        <div className="ml-auto flex items-center gap-1.5 pr-2 text-[10px] font-mono">
          <span className="text-muted">{activePair}</span>
          <span className="text-text-primary font-semibold">
            {currentPrice?.toFixed(decimals) ?? '——'}
          </span>
        </div>
      </div>

      {/* ── Contenido ───────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'book' ? (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              <OrderBook book={book} decimals={decimals} activePair={activePair} />
            </div>
            <FlowPressure tape={tape} />
          </div>
        ) : (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden">
              <TapePanel entries={tape} decimals={decimals} />
            </div>
            <FlowPressure tape={tape} />
          </div>
        )}
      </div>
    </div>
  )
}
