// ─────────────────────────────────────────────────────────────
// api/calendar.js — Proxy del Calendario Económico
//
// Actúa como intermediario para obtener eventos del calendario
// de Forex Factory, evitando problemas de CORS desde el frontend.
//
// Forex Factory no tiene una API oficial pública, por lo que
// hacemos scraping del feed JSON no oficial que actualiza diariamente.
//
// Si el scraping falla (por cambios en la estructura de FF),
// devolvemos el array vacío para que el frontend muestre el mock.
//
// Para producción, considera suscribirte a una API oficial como:
//   - Nasdaq Data Link: https://data.nasdaq.com/
//   - Trading Economics: https://tradingeconomics.com/api/
//   - Investing.com (requiere acuerdo)
// ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // Solo aceptamos GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido. Usa GET.' })
  }

  try {
    // ── Intentamos obtener datos de Forex Factory ───────────
    // Usamos el feed JSON no oficial de Forex Factory.
    // Si cambian su estructura, este bloque fallará y usaremos el fallback.
    const today = new Date()
    const year  = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day   = String(today.getDate()).padStart(2, '0')

    // Forex Factory tiene un feed de calendar en formato JSON para web app
    const ffUrl = `https://www.forexfactory.com/calendar?day=${month}${day}.${year}`

    // Hacemos la petición con User-Agent de navegador para evitar bloqueos
    const response = await fetch(ffUrl, {
      headers: {
        'User-Agent':  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept':      'application/json, text/html',
        'Referer':     'https://www.forexfactory.com/',
      },
    })

    // Si la respuesta es HTML (no JSON), no podemos parsearla directamente
    // En ese caso, devolvemos eventos vacíos para que el frontend use el mock
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.includes('json')) {
      console.log('[calendar] Forex Factory no devolvió JSON, usando fallback vacío')
      return res.status(200).json({ events: [], source: 'fallback' })
    }

    const data = await response.json()

    // ── Mapeamos los eventos al formato que espera el frontend ─
    // Cada evento tiene: time, currency, name, impact, actual, forecast
    const events = (data.calendar || data.events || [])
      .filter(e => ['high', 'medium'].includes(e.impact?.toLowerCase()))
      .map(e => ({
        time:     e.time     || e.date   || '—',
        currency: e.currency || e.symbol || '—',
        name:     e.title    || e.name   || 'Evento',
        impact:   e.impact?.toLowerCase() || 'medium',
        actual:   e.actual   || null,
        forecast: e.forecast || null,
        previous: e.previous || null,
      }))
      .slice(0, 20) // Limitamos a 20 eventos para no sobrecargar la UI

    console.log(`[calendar] ${events.length} eventos cargados para hoy`)

    // Configuramos caché: actualizamos cada 15 minutos
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate')
    return res.status(200).json({ events, source: 'forexfactory' })

  } catch (error) {
    // En caso de cualquier error (red, parsing, etc.), devolvemos array vacío
    // El frontend mostrará datos mock de demostración
    console.error('[calendar] Error fetching calendar:', error.message)
    return res.status(200).json({ events: [], source: 'error', error: error.message })
  }
}
