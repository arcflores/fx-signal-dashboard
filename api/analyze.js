// ─────────────────────────────────────────────────────────────
// api/analyze.js — Serverless Function de Vercel para Claude AI
//
// Esta función actúa como proxy entre el frontend y la API de Claude.
// No exponemos la API key al cliente — solo vive aquí en el servidor.
//
// Flujo:
//   Frontend → POST /api/analyze → Esta función → Claude API → Respuesta JSON
//
// La respuesta JSON tiene esta estructura:
//   {
//     direction:  'CALL' | 'PUT' | 'NEUTRAL',
//     confidence: 0-100,           // Porcentaje de confianza
//     expiry:     '1m' | '3m' | '5m',
//     reason:     'Explicación corta en español',
//     risk:       'Factor de riesgo principal',
//     avoid:      'Condición que invalidaría la señal',
//   }
// ─────────────────────────────────────────────────────────────

// Importamos el SDK de Anthropic para comunicarnos con Claude
const Anthropic = require('@anthropic-ai/sdk')

// ── Prompt del sistema para Claude ───────────────────────────
// Define el rol y las reglas de respuesta de Claude.
// Es crítico que siempre devuelva JSON válido para que el frontend
// pueda parsearlo sin errores.
const SYSTEM_PROMPT = `Eres un analista experto en trading de binary options, especializado en análisis técnico intradía para Forex y Crypto.

TAREA: Analizar los indicadores técnicos proporcionados y emitir un veredicto CALL/PUT para una operación de binary options.

REGLAS DE RESPUESTA:
1. Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin markdown, sin explicaciones fuera del JSON.
2. El JSON debe tener exactamente estos campos:
   {
     "direction": "CALL" | "PUT" | "NEUTRAL",
     "confidence": número entero 0-100,
     "expiry": "1m" | "3m" | "5m",
     "reason": "Una oración corta explicando el veredicto principal",
     "risk": "El factor de riesgo más importante a vigilar",
     "avoid": "Condición del mercado que invalidaría esta señal"
   }
3. "confidence" debe ser honesto: si las señales se contradicen, no superes 60%.
4. Si el score compuesto es NEUTRAL (40-60%), emite "NEUTRAL" con confidence bajo.
5. Prioriza la CONFLUENCIA: más indicadores alineados = mayor confianza.
6. El "expiry" debe ser conservador: si hay alta volatilidad, recomienda tiempos más cortos.
7. Siempre en ESPAÑOL para reason, risk y avoid.`

// ── Handler principal de la serverless function ──────────────
module.exports = async function handler(req, res) {
  // Solo aceptamos método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Usa POST.' })
  }

  // Validamos que la API key esté configurada como variable de entorno
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY no configurada. Agrega la variable de entorno en Vercel.'
    })
  }

  // Extraemos el contexto de análisis del body del request
  const { context, pair, tf } = req.body
  if (!context) {
    return res.status(400).json({ error: 'El campo "context" es requerido en el body.' })
  }

  try {
    // ── Inicializamos el cliente de Claude ──────────────────
    const client = new Anthropic({ apiKey })

    // ── Enviamos el análisis a Claude Sonnet 4.6 ───────────
    // Usamos claude-sonnet-4-6 por su balance entre velocidad y precisión
    const message = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 512,  // El veredicto es corto, no necesitamos más
      system:     SYSTEM_PROMPT,
      messages: [
        {
          role:    'user',
          content: `Analiza los siguientes indicadores técnicos y emite tu veredicto:\n\n${context}`,
        },
      ],
    })

    // ── Extraemos el texto de la respuesta ──────────────────
    const rawText = message.content[0]?.text || ''

    // ── Parseamos el JSON de la respuesta ──────────────────
    // Claude puede a veces envolver el JSON en ```json ... ``
    // Limpiamos cualquier markdown antes de parsear.
    const cleaned = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let verdict
    try {
      verdict = JSON.parse(cleaned)
    } catch (parseErr) {
      // Si el JSON no es válido, devolvemos un veredicto de fallback
      console.error('[analyze] JSON parse error:', parseErr, 'Raw:', rawText)
      verdict = {
        direction:  'NEUTRAL',
        confidence: 50,
        expiry:     '5m',
        reason:     'No se pudo procesar la respuesta de Claude. Intenta de nuevo.',
        risk:       'Error de parsing en la respuesta AI',
        avoid:      'Verifica la conexión y vuelve a intentar',
      }
    }

    // ── Validamos y sanitizamos los campos del veredicto ────
    // Por seguridad, aseguramos que los valores estén dentro de rango.
    const sanitized = {
      direction:  ['CALL', 'PUT', 'NEUTRAL'].includes(verdict.direction) ? verdict.direction : 'NEUTRAL',
      confidence: Math.min(100, Math.max(0, parseInt(verdict.confidence) || 50)),
      expiry:     ['1m', '3m', '5m', '15m'].includes(verdict.expiry) ? verdict.expiry : '5m',
      reason:     String(verdict.reason || 'Sin razón proporcionada').slice(0, 300),
      risk:       String(verdict.risk   || 'Gestión de riesgo estándar').slice(0, 200),
      avoid:      String(verdict.avoid  || 'Monitorear precio de cerca').slice(0, 200),
    }

    // Registramos en consola para debugging en Vercel logs
    console.log(`[analyze] ${pair} ${tf} → ${sanitized.direction} ${sanitized.confidence}%`)

    // ── Devolvemos el veredicto sanitizado al frontend ──────
    return res.status(200).json(sanitized)

  } catch (error) {
    // Error de la API de Anthropic (rate limit, API key inválida, etc.)
    console.error('[analyze] Anthropic API error:', error)
    return res.status(500).json({
      error: `Error de Claude API: ${error.message || 'Error desconocido'}`,
    })
  }
}
