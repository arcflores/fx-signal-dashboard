// ─────────────────────────────────────────────────────────────
// SignalPanel.jsx — Panel derecho de señales e indicadores
// Muestra un "semáforo" con el estado de cada indicador:
//   - RSI, MACD, Bollinger Bands, EMA, Stochastic
//   - Patrones de velas japonesas, Fibonacci, Volumen
// Incluye el score compuesto con gauge visual CALL/PUT.
// ─────────────────────────────────────────────────────────────
import { ArrowUp, ArrowDown, Minus, BarChart2, Activity } from 'lucide-react'
import useStore from '../store/useStore'

// ── Configuración visual por tipo de señal ───────────────────
const SIGNAL_STYLES = {
  call:    { bg: 'bg-call/10',    border: 'border-call/30',    text: 'text-call',    icon: ArrowUp,   label: 'CALL' },
  put:     { bg: 'bg-put/10',     border: 'border-put/30',     text: 'text-put',     icon: ArrowDown, label: 'PUT'  },
  neutral: { bg: 'bg-surface',    border: 'border-border',      text: 'text-muted',   icon: Minus,     label: '—'    },
}

// ── Fila individual de indicador ─────────────────────────────
// Muestra nombre, valor calculado y señal CALL/PUT/NEUTRAL.
function IndicatorRow({ name, value, signal, weight }) {
  const style     = SIGNAL_STYLES[signal] || SIGNAL_STYLES.neutral
  const IconComp  = style.icon

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border
                     ${style.bg} ${style.border} transition-all`}>

      {/* Icono de señal */}
      <div className={`flex-shrink-0 ${style.text}`}>
        <IconComp size={13} />
      </div>

      {/* Nombre del indicador */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-semibold text-text-secondary truncate">{name}</div>
        {/* Valor calculado */}
        <div className="text-[9px] text-muted truncate mt-0.5">{value}</div>
      </div>

      {/* Badge CALL / PUT / — */}
      <div className={`flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded
                       ${style.bg} ${style.text}`}>
        {style.label}
      </div>

      {/* Peso del indicador (puntos de influencia) */}
      <div className="flex-shrink-0 flex gap-0.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className={`w-1 h-1 rounded-full ${i < weight ? style.text : 'bg-border'}`}
          />
        ))}
      </div>
    </div>
  )
}

// ── Gauge de score compuesto ─────────────────────────────────
// Barra de progreso que va de PUT (0) a CALL (100),
// con zona neutra en el centro (40-60).
function CompositeGauge({ score, bias }) {
  // El score es 0-100 donde 50 = neutral, >60 = CALL, <40 = PUT
  const callWeight    = score          // Peso de señales CALL
  const putWeight     = 100 - score    // Peso de señales PUT

  // Color de la barra según el bias
  const barColor = bias === 'CALL'
    ? 'bg-call'
    : bias === 'PUT'
    ? 'bg-put'
    : 'bg-muted'

  // Texto descriptivo del score
  const strength = score > 75 || score < 25
    ? 'Fuerte'
    : score > 60 || score < 40
    ? 'Moderado'
    : 'Débil'

  return (
    <div className="px-3 py-3 border-b border-border">
      {/* Cabecera del gauge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wider">
          Score Compuesto
        </span>
        <span className={`text-xs font-bold
                          ${bias === 'CALL' ? 'text-call' : bias === 'PUT' ? 'text-put' : 'text-muted'}`}>
          {bias} {score}%
        </span>
      </div>

      {/* Barra de progreso PUT ←→ CALL */}
      <div className="relative h-3 bg-bg rounded-full overflow-hidden border border-border">
        {/* Zona neutra (franja central) */}
        <div className="absolute left-[40%] right-[40%] h-full bg-muted/10 z-0" />

        {/* Barra de CALL (desde el centro hacia la derecha) */}
        {bias === 'CALL' && (
          <div
            className="absolute top-0 left-1/2 h-full bg-call/70 rounded-r-full transition-all duration-500"
            style={{ width: `${(score - 50) * 2}%` }}
          />
        )}
        {/* Barra de PUT (desde el centro hacia la izquierda) */}
        {bias === 'PUT' && (
          <div
            className="absolute top-0 right-1/2 h-full bg-put/70 rounded-l-full transition-all duration-500"
            style={{ width: `${(50 - score) * 2}%` }}
          />
        )}

        {/* Marcador central (neutral) */}
        <div className="absolute left-1/2 top-0 w-px h-full bg-muted/50 z-10" />
      </div>

      {/* Etiquetas PUT y CALL */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-put font-semibold">PUT</span>
        <span className="text-[9px] text-muted">{strength}</span>
        <span className="text-[9px] text-call font-semibold">CALL</span>
      </div>

      {/* Desglose numérico */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-call" />
          <span className="text-[10px] text-text-secondary">CALL: {callWeight}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-put" />
          <span className="text-[10px] text-text-secondary">PUT: {putWeight}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal SignalPanel ─────────────────────────
export default function SignalPanel() {
  const { signals, compositeScore, compositeBias, indicators } = useStore()

  // Separamos señales por tipo para mostrarlas agrupadas
  const callSignals    = signals.filter(s => s.signal === 'call')
  const putSignals     = signals.filter(s => s.signal === 'put')
  const neutralSignals = signals.filter(s => s.signal === 'neutral')

  return (
    <aside className="w-52 bg-bg border-l border-border flex flex-col flex-shrink-0 overflow-hidden">

      {/* ── Cabecera ──────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 flex-shrink-0">
        <Activity size={12} className="text-accent" />
        <span className="text-[10px] font-semibold text-muted uppercase tracking-widest">
          Señales
        </span>
      </div>

      {/* ── Gauge de score compuesto ──────────────────────── */}
      <CompositeGauge score={compositeScore} bias={compositeBias} />

      {/* ── Lista de indicadores ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {signals.length === 0 ? (
          // Estado vacío: esperando datos de velas
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <BarChart2 size={24} className="text-muted/50" />
            <p className="text-[10px] text-muted leading-tight">
              Esperando datos de mercado para calcular indicadores...
            </p>
          </div>
        ) : (
          // Renderizamos cada indicador con su señal
          signals.map((signal, idx) => (
            <IndicatorRow
              key={signal.name}
              name={signal.name}
              value={signal.value}
              signal={signal.signal}
              weight={signal.weight}
            />
          ))
        )}
      </div>

      {/* ── Resumen de conteo CALL / PUT / NEUTRAL ───────── */}
      {signals.length > 0 && (
        <div className="px-3 py-2 border-t border-border flex items-center justify-around flex-shrink-0">
          <div className="text-center">
            <div className="text-sm font-bold text-call">{callSignals.length}</div>
            <div className="text-[9px] text-muted">CALL</div>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <div className="text-sm font-bold text-muted">{neutralSignals.length}</div>
            <div className="text-[9px] text-muted">NEUTRAL</div>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="text-center">
            <div className="text-sm font-bold text-put">{putSignals.length}</div>
            <div className="text-[9px] text-muted">PUT</div>
          </div>
        </div>
      )}
    </aside>
  )
}
