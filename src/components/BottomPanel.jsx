// ─────────────────────────────────────────────────────────────
// BottomPanel.jsx — Panel inferior con tres pestañas:
//   1. Calendario Económico — Eventos de alto impacto del día
//   2. Noticias — Titulares de mercado (crypto + forex)
//   3. Historial — Registro de señales generadas en esta sesión
// ─────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import { Calendar, Newspaper, History, AlertTriangle, Clock,
         TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import useStore from '../store/useStore'

// ── Tab 1: Calendario Económico ──────────────────────────────
// Muestra los eventos del calendario Forex Factory para hoy.
// Los eventos se cargan desde /api/calendar (proxy Vercel).
// En estado inicial muestra eventos mock de demostración.
function CalendarTab() {
  const [events, setEvents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // Cargamos eventos al montar el componente
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/calendar')
        if (!res.ok) throw new Error('API no disponible')
        const data = await res.json()
        setEvents(data.events || [])
      } catch {
        // Si el API falla, mostramos datos mock de ejemplo
        setEvents(MOCK_CALENDAR_EVENTS)
        setError('Datos de demostración (API Forex Factory no configurada)')
      } finally {
        setLoading(false)
      }
    }
    loadEvents()
  }, [])

  // Colores por impacto del evento económico
  const impactColor = {
    high:   'text-put',
    medium: 'text-warn',
    low:    'text-muted',
  }

  const impactBg = {
    high:   'bg-put',
    medium: 'bg-warn',
    low:    'bg-muted/30',
  }

  return (
    <div className="flex flex-col h-full">
      {/* Banner de advertencia si hay datos mock */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warn/10 border-b border-warn/20 flex-shrink-0">
          <AlertTriangle size={11} className="text-warn flex-shrink-0" />
          <p className="text-[10px] text-warn">{error}</p>
        </div>
      )}

      {/* Lista de eventos */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={16} className="text-muted animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-muted">No hay eventos programados para hoy.</p>
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-bg">
              <tr className="border-b border-border">
                <th className="text-left px-3 py-1.5 text-muted font-semibold text-[10px]">Hora</th>
                <th className="text-left px-3 py-1.5 text-muted font-semibold text-[10px]">Moneda</th>
                <th className="text-left px-3 py-1.5 text-muted font-semibold text-[10px]">Evento</th>
                <th className="text-center px-3 py-1.5 text-muted font-semibold text-[10px]">Impacto</th>
                <th className="text-right px-3 py-1.5 text-muted font-semibold text-[10px]">Actual</th>
                <th className="text-right px-3 py-1.5 text-muted font-semibold text-[10px]">Previsto</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <tr key={idx} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                  <td className="px-3 py-2 text-muted font-mono">{event.time}</td>
                  <td className="px-3 py-2">
                    <span className="font-bold text-text-primary">{event.currency}</span>
                  </td>
                  <td className="px-3 py-2 text-text-secondary max-w-[200px] truncate">{event.name}</td>
                  <td className="px-3 py-2 text-center">
                    {/* Indicador visual de impacto (1-3 puntos) */}
                    <div className="flex items-center justify-center gap-0.5">
                      {[1, 2, 3].map(i => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full
                                      ${event.impact === 'high' && i <= 3 ? impactBg.high
                                        : event.impact === 'medium' && i <= 2 ? impactBg.medium
                                        : event.impact === 'low' && i <= 1 ? impactBg.low
                                        : 'bg-border'}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className={`px-3 py-2 text-right font-mono
                                  ${event.actual ? 'text-text-primary font-semibold' : 'text-muted'}`}>
                    {event.actual || '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-muted">{event.forecast || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Tab 2: Noticias de mercado ───────────────────────────────
// Muestra titulares de noticias relevantes para Forex y Crypto.
// En producción, se conectaría a un feed de noticias real.
function NewsTab() {
  const { activePair } = useStore()

  // Noticias mock de demostración (se reemplazarían con API real)
  const news = MOCK_NEWS_DATA

  const sentimentColor = {
    bullish: 'text-call',
    bearish: 'text-put',
    neutral: 'text-muted',
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Aviso de datos mock */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/5 border-b border-accent/10 flex-shrink-0">
        <AlertTriangle size={11} className="text-accent flex-shrink-0" />
        <p className="text-[10px] text-accent">Titulares de demostración — conectar API de noticias para datos reales</p>
      </div>

      <div className="space-y-0">
        {news.map((item, idx) => (
          <div key={idx} className="px-3 py-2.5 border-b border-border/50 hover:bg-surface/50 transition-colors">
            <div className="flex items-start gap-2">
              {/* Indicador de sentimiento */}
              <div className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0
                               ${item.sentiment === 'bullish' ? 'bg-call'
                                 : item.sentiment === 'bearish' ? 'bg-put'
                                 : 'bg-muted'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-text-primary leading-snug font-medium">{item.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-muted">{item.source}</span>
                  <span className="text-[9px] text-muted">·</span>
                  <span className="text-[9px] text-muted">{item.time}</span>
                  {item.pairs?.length > 0 && (
                    <>
                      <span className="text-[9px] text-muted">·</span>
                      {item.pairs.map(p => (
                        <span key={p} className={`text-[9px] font-bold
                                                   ${p === activePair ? 'text-accent' : 'text-muted'}`}>
                          {p}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tab 3: Historial de señales ──────────────────────────────
// Registro cronológico de todas las señales generadas en la sesión.
// Permite revisar el desempeño y evaluar las decisiones tomadas.
function HistoryTab() {
  const { signalHistory } = useStore()

  if (signalHistory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <History size={20} className="text-muted/50" />
        <p className="text-[11px] text-muted">
          El historial de señales de esta sesión aparecerá aquí
          después de generar tu primera señal con Claude.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <table className="w-full text-[11px]">
        <thead className="sticky top-0 bg-bg">
          <tr className="border-b border-border">
            {['Hora', 'Par', 'TF', 'Señal', 'Confianza', 'Score técnico'].map(h => (
              <th key={h} className="text-left px-3 py-1.5 text-muted font-semibold text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {signalHistory.map((entry, idx) => {
            const isCall = entry.direction === 'CALL'
            const isPut  = entry.direction === 'PUT'
            const Icon   = isCall ? TrendingUp : isPut ? TrendingDown : Minus

            return (
              <tr key={idx} className="border-b border-border/50 hover:bg-surface/50 transition-colors">
                <td className="px-3 py-2 text-muted font-mono">{entry.timestamp}</td>
                <td className="px-3 py-2 font-bold text-text-primary">{entry.pair}</td>
                <td className="px-3 py-2 text-muted">{entry.tf}</td>
                <td className="px-3 py-2">
                  <div className={`flex items-center gap-1 font-bold
                                   ${isCall ? 'text-call' : isPut ? 'text-put' : 'text-muted'}`}>
                    <Icon size={11} />
                    <span>{entry.direction}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-bg rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full
                                    ${entry.confidence >= 75 ? 'bg-call'
                                      : entry.confidence >= 55 ? 'bg-warn' : 'bg-put'}`}
                        style={{ width: `${entry.confidence}%` }}
                      />
                    </div>
                    <span className="text-text-secondary">{entry.confidence}%</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={entry.bias === 'CALL' ? 'text-call' : entry.bias === 'PUT' ? 'text-put' : 'text-muted'}>
                    {entry.bias} {entry.score}%
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Componente principal BottomPanel ─────────────────────────
export default function BottomPanel() {
  const { bottomTab, setBottomTab } = useStore()

  const TABS = [
    { id: 'calendar', label: 'Calendario', Icon: Calendar },
    { id: 'news',     label: 'Noticias',   Icon: Newspaper },
    { id: 'history',  label: 'Historial',  Icon: History },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Barra de tabs ──────────────────────────────────── */}
      <div className="flex items-center border-b border-border bg-surface flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setBottomTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2
                        ${bottomTab === tab.id
                          ? 'border-accent text-accent'
                          : 'border-transparent text-muted hover:text-text-primary'}`}
          >
            <tab.Icon size={12} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Contenido del tab activo ───────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {bottomTab === 'calendar' && <CalendarTab />}
        {bottomTab === 'news'     && <NewsTab />}
        {bottomTab === 'history'  && <HistoryTab />}
      </div>
    </div>
  )
}

// ── Datos mock de ejemplo para el calendario ─────────────────
// Se reemplazan con datos reales desde /api/calendar
const MOCK_CALENDAR_EVENTS = [
  { time: '08:30', currency: 'USD', name: 'Nonfarm Payrolls',           impact: 'high',   actual: null,    forecast: '180K' },
  { time: '08:30', currency: 'USD', name: 'Unemployment Rate',           impact: 'high',   actual: null,    forecast: '3.8%' },
  { time: '10:00', currency: 'EUR', name: 'CPI Flash Estimate y/y',      impact: 'high',   actual: null,    forecast: '2.4%' },
  { time: '13:00', currency: 'GBP', name: 'Manufacturing PMI',           impact: 'medium', actual: null,    forecast: '50.3' },
  { time: '14:30', currency: 'CAD', name: 'Trade Balance',               impact: 'medium', actual: null,    forecast: '-2.1B' },
  { time: '15:00', currency: 'USD', name: 'ISM Manufacturing PMI',       impact: 'high',   actual: null,    forecast: '50.1' },
  { time: '17:00', currency: 'USD', name: 'Fed Member Speeches',         impact: 'medium', actual: null,    forecast: null  },
]

// ── Datos mock de noticias ───────────────────────────────────
const MOCK_NEWS_DATA = [
  {
    title:     'El dólar cae ante expectativas de recorte de tasas de la Fed en junio',
    source:    'Reuters',
    time:      'hace 12 min',
    sentiment: 'bearish',
    pairs:     ['EUR/USD', 'GBP/USD'],
  },
  {
    title:     'Bitcoin supera $95,000 impulsado por ETF flows positivos',
    source:    'CoinDesk',
    time:      'hace 28 min',
    sentiment: 'bullish',
    pairs:     ['BTC/USD'],
  },
  {
    title:     'Eurozona: IPC de marzo confirma desaceleración de la inflación al 2.2%',
    source:    'ECB News',
    time:      'hace 45 min',
    sentiment: 'neutral',
    pairs:     ['EUR/USD'],
  },
  {
    title:     'USD/JPY alcanza 153.40 ante intervención verbal del BoJ',
    source:    'FX Street',
    time:      'hace 1 hora',
    sentiment: 'bearish',
    pairs:     ['USD/JPY'],
  },
  {
    title:     'Ethereum: actualización Dencun reduce comisiones de L2 un 90%',
    source:    'Decrypt',
    time:      'hace 2 horas',
    sentiment: 'bullish',
    pairs:     ['ETH/USD'],
  },
]
