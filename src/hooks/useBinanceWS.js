// ─────────────────────────────────────────────────────────────
// useBinanceWS.js — Hook de WebSocket para datos de Binance
// Binance proporciona datos de mercado GRATUITOS sin necesidad
// de API key. Solo se usa para pares CRYPTO (BTC/USD, ETH/USD).
// Los pares FOREX usan datos mock hasta que OANDA esté conectado.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef, useCallback } from 'react'
import useStore from '../store/useStore'
import { BINANCE_SYMBOLS, TF_TO_BINANCE } from '../utils/mockForex'

// URL base del WebSocket de Binance
const BINANCE_WS = 'wss://stream.binance.com:9443/ws'

export default function useBinanceWS() {
  const { activePair, activeTF, appendCandle, setCurrentPrice } = useStore()
  const wsRef = useRef(null) // Referencia al WebSocket activo

  // Convierte 'BTC/USD' → 'btcusdt' (formato Binance)
  const getBinanceSymbol = (pair) => BINANCE_SYMBOLS[pair] || null

  // Función que abre la conexión WebSocket y escucha las velas
  const connect = useCallback((pair, tf) => {
    const symbol = getBinanceSymbol(pair)

    // Si el par no es crypto (ej. EUR/USD), no conectamos a Binance
    if (!symbol) return

    // Cerramos cualquier conexión previa antes de abrir una nueva
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Stream de velas en tiempo real: kline_1m, kline_5m, etc.
    const interval = TF_TO_BINANCE[tf] || '1m'
    const url = `${BINANCE_WS}/${symbol}@kline_${interval}`

    console.log(`[Binance WS] Conectando a ${url}`)
    const ws = new WebSocket(url)

    ws.onopen = () => {
      console.log(`[Binance WS] Conectado: ${pair} ${tf}`)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const k = data.k // Objeto 'kline' con los datos de la vela

        if (!k) return

        // Construimos la vela en formato compatible con TradingView LW Charts
        const candle = {
          time:   Math.floor(k.t / 1000),   // Timestamp en segundos
          open:   parseFloat(k.o),
          high:   parseFloat(k.h),
          low:    parseFloat(k.l),
          close:  parseFloat(k.c),
          volume: parseFloat(k.v),
        }

        // Clave del store: 'BTC/USD_5m'
        const key = `${pair}_${tf}`
        appendCandle(key, candle)

        // Actualizamos el precio mostrado en el header
        setCurrentPrice(parseFloat(k.c))

      } catch (err) {
        console.error('[Binance WS] Error al parsear mensaje:', err)
      }
    }

    ws.onerror = (err) => {
      console.error('[Binance WS] Error de conexión:', err)
    }

    ws.onclose = () => {
      console.log('[Binance WS] Conexión cerrada')
    }

    wsRef.current = ws
  }, [appendCandle, setCurrentPrice])

  // Reconectamos cuando cambia el par activo o el timeframe
  useEffect(() => {
    connect(activePair, activeTF)

    // Cleanup: cerramos el WebSocket cuando el componente se desmonta
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [activePair, activeTF, connect])

  return { isConnected: wsRef.current?.readyState === WebSocket.OPEN }
}
