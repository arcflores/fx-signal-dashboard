// ─────────────────────────────────────────────────────────────
// ClaudePanel.jsx — Panel de análisis con Claude AI
// Este componente:
//   1. Recopila todos los indicadores técnicos del store
//   2. Envía el contexto completo a /api/analyze (Vercel serverless)
//   3. Recibe y muestra el veredicto de Claude: CALL/PUT + confianza
//   4. Guarda la operación en el historial de la sesión
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Sparkles, TrendingUp, TrendingDown, Minus,
         AlertTriangle, Clock, ShieldAlert, CheckCircle, Loader2 } from 'lucide-react'
import useStore from '../store/useStore'
import { PAIR_CONFIG } from '../utils/mockForex'

// ── Función: construir el prompt de contexto ─────────────────
// Toma todos los datos del mercado y genera un resumen estructurado
// que Claude puede analizar para tomar una decisión informada.
function buildAnalysisContext(pair, tf, currentPrice, signals, indicators, score, bias) {
  const pairConfig = PAIR_CONFIG[pair]

  // Formateamos las señales de cada indicador
  const signalLines = signals.map(s =>
    `  - ${s.name}: ${s.value} → ${s.signal.toUpperCase()} (peso: ${s.weight})`
  ).join('\n')

  // Construimos el contexto completo en texto para Claude
  return `
ANÁLISIS TÉCNICO PARA BINARY OPTIONS — ${pair} / ${tf}
══════════════════════════════════════════════════════

📊 PAR: ${pair}  |  TIMEFRAME: ${tf}  |  PRECIO: ${currentPrice?.toFixed(pairConfig?.decimals ?? 5) ?? '—'}

📈 SCORE COMPUESTO: ${score}% → ${bias}

📉 SEÑALES INDIVIDUALES (8 indicadores):
${signalLines}

📐 INDICADORES CALCULADOS:
  • RSI(14):        ${indicators.rsi ?? '—'}
  • MACD:          ${indicators.macd ? `Línea: ${indicators.macd.line} | Señal: ${indicators.macd.signal} | Hist: ${indicators.macd.histogram}` : '—'}
  • Bollinger:     ${indicators.bollinger ? `Sup: ${indicators.bollinger.upper} | Med: ${indicators.bollinger.middle} | Inf: ${indicators.bollinger.lower}` : '—'}
  • EMA 20/50:     ${indicators.ema20 ?? '—'} / ${indicators.ema50 ?? '—'}
  • Stochastic:    ${indicators.stoch ? `%K: ${indicators.stoch.k} | %D: ${indicators.stoch.d}` : '—'}
  • Fibonacci OTE: ${indicators.fibonacci ? indicators.fibonacci.find(f => f.isOTE)?.level.toFixed(5) ?? '—' : '—'}
`.trim()
}

// ── Componente: Tarjeta de veredicto ─────────────────────────
// Muestra el resultado del análisis de Claude con todos sus campos.
function VerdictCard({ verdict }) {
  if (!verdict) return null

  // Colores y estilos según dirección CALL/PUT
  const isCall  = verdict.direction === 'CALL'
  const isPut   = verdict.direction === 'PUT'
  const color   = isCall ? 'call' : isPut ? 'put' : 'muted'
  const Icon    = isCall ? TrendingUp : isPut ? TrendingDown : Minus
  const bgClass = isCall
    ? 'bg-call/5 border-call/20'
    : isPut
    ? 'bg-put/5 border-put/20'
    : 'bg-surface border-border'

  // Nivel de confianza → color de la barra
  const confColor = verdict.confidence >= 75
    ? 'bg-call'
    : verdict.confidence >= 55
    ? 'bg-warn'
    : 'bg-put'

  return (
    <div className={`rounded-xl border p-3 ${bgClass} transition-all`}>

      {/* ── Dirección y confianza ──────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 text-${color}`}>
          <Icon size={20} strokeWidth={2.5} />
          <span className="text-xl font-black tracking-wider">{verdict.direction}</span>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold text-${color}`}>{verdict.confidence}%</div>
          <div className="text-[9px] text-muted">Confianza</div>
        </div>
      </div>

      {/* ── Barra de confianza ─────────────────────────── */}
      <div className="h-1.5 bg-bg rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${confColor} rounded-full transition-all duration-700`}
          style={{ width: `${verdict.confidence}%` }}
        />
      </div>

      {/* ── Expiración recomendada ─────────────────────── */}
      <div className="flex items-center gap-1.5 mb-2">
        <Clock size={11} className="text-muted flex-shrink-0" />
        <span className="text-[11px] text-text-secondary">
          Expiración: <strong className="text-text-primary">{verdict.expiry}</strong>
        </span>
      </div>

      {/* ── Razón del veredicto ────────────────────────── */}
      <p className="text-[11px] text-text-secondary leading-relaxed mb-3 border-t border-border pt-2">
        {verdict.reason}
      </p>

      {/* ── Gestión de riesgo ──────────────────────────── */}
      {verdict.risk && (
        <div className="flex items-start gap-1.5 mb-2">
          <ShieldAlert size={11} className="text-warn flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-warn leading-tight">{verdict.risk}</p>
        </div>
      )}

      {/* ── Factores adversos / condiciones a evitar ──── */}
      {verdict.avoid && (
        <div className="flex items-start gap-1.5">
          <AlertTriangle size={11} className="text-put/70 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted leading-tight">{verdict.avoid}</p>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ClaudePanel ─────────────────────────
export default function ClaudePanel() {
  const {
    activePair, activeTF, currentPrice,
    signals, indicators, compositeScore, compositeBias,
    verdict, isAnalyzing,
    setAnalyzing, setVerdict, addToHistory,
  } = useStore()

  // Error local (si la llamada a la API falla)
  const [error, setError] = useState(null)

  // ── Función: enviar análisis a Claude AI ─────────────────
  const handleAnalyze = async () => {
    if (isAnalyzing) return
    if (signals.length === 0) {
      setError('No hay señales disponibles. Espera a que carguen los datos de mercado.')
      return
    }

    setError(null)
    setAnalyzing(true)

    // Construimos el contexto de análisis
    const context = buildAnalysisContext(
      activePair, activeTF, currentPrice,
      signals, indicators, compositeScore, compositeBias
    )

    try {
      // Llamamos al endpoint serverless de Vercel que proxea a Claude API
      const response = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ context, pair: activePair, tf: activeTF }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Error de red' }))
        throw new Error(err.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      // Guardamos el veredicto en el store
      setVerdict(data)

      // Agregamos al historial de la sesión
      addToHistory({
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        pair:       activePair,
        tf:         activeTF,
        direction:  data.direction,
        confidence: data.confidence,
        score:      compositeScore,
        bias:       compositeBias,
      })

    } catch (err) {
      setError(`Error al analizar: ${err.message}`)
      setAnalyzing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 p-3 h-full">

      {/* ── Cabecera con logo Claude ──────────────────────── */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Sparkles size={14} className="text-accent" />
        <span className="text-[11px] font-bold text-text-primary">Claude AI</span>
        <span className="text-[9px] text-muted ml-auto">claude-sonnet-4-6</span>
      </div>

      {/* ── Estado actual del mercado (resumen) ──────────── */}
      <div className="bg-surface rounded-lg border border-border p-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">Par activo</span>
          <span className="text-[11px] font-bold text-text-primary">{activePair}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted">Timeframe</span>
          <span className="text-[11px] font-semibold text-text-primary">{activeTF}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted">Score técnico</span>
          <span className={`text-[11px] font-bold
                            ${compositeBias === 'CALL' ? 'text-call'
                              : compositeBias === 'PUT' ? 'text-put'
                              : 'text-muted'}`}>
            {compositeBias} {compositeScore}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-muted">Señales</span>
          <span className="text-[10px] text-text-secondary">{signals.length} indicadores</span>
        </div>
      </div>

      {/* ── Botón Analizar ────────────────────────────────── */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || signals.length === 0}
        className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-bold
                    transition-all duration-200 flex-shrink-0
                    ${isAnalyzing
                      ? 'bg-accent/20 text-accent/60 cursor-not-allowed'
                      : signals.length === 0
                      ? 'bg-surface text-muted cursor-not-allowed border border-border'
                      : 'bg-accent hover:bg-accent/90 text-white cursor-pointer shadow-lg shadow-accent/20'
                    }`}
      >
        {isAnalyzing ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Analizando...</span>
          </>
        ) : (
          <>
            <Sparkles size={14} />
            <span>Analizar con Claude</span>
          </>
        )}
      </button>

      {/* ── Mensaje de error ──────────────────────────────── */}
      {error && (
        <div className="flex items-start gap-2 bg-put/10 border border-put/20 rounded-lg p-2 flex-shrink-0">
          <AlertTriangle size={12} className="text-put flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-put leading-tight">{error}</p>
        </div>
      )}

      {/* ── Veredicto de Claude ───────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {verdict ? (
          <VerdictCard verdict={verdict} />
        ) : (
          // Estado vacío: instrucciones para el usuario
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 py-4">
            <div className="w-10 h-10 rounded-full bg-surface border border-border
                            flex items-center justify-center">
              <Sparkles size={18} className="text-muted" />
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Presiona <strong className="text-accent">Analizar con Claude</strong> para obtener
              un veredicto CALL/PUT con nivel de confianza y tiempo de expiración recomendado.
            </p>
            <div className="text-[9px] text-muted/60 space-y-1">
              <p>✓ Analiza 8 indicadores técnicos</p>
              <p>✓ Detecta patrones de confluencia</p>
              <p>✓ Recomienda expiración óptima</p>
              <p>✓ Identifica factores de riesgo</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Disclaimer legal ──────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-border pt-2">
        <p className="text-[8px] text-muted/50 text-center leading-tight">
          Solo para análisis. No es asesoramiento financiero.
          Opera solo capital que puedas permitirte perder.
        </p>
      </div>
    </div>
  )
}
