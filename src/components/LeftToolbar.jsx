// ─────────────────────────────────────────────────────────────
// LeftToolbar.jsx — Barra lateral izquierda de herramientas de dibujo
// Igual al panel izquierdo de TradingView:
//   - Cursor / Crosshair
//   - Líneas: Tendencia, Horizontal, Vertical, Canal
//   - Fibonacci: Retroceso, Extensión
//   - Formas: Rectángulo, Elipse
//   - Texto / Anotación
//   - Medición de precio/tiempo
//   - Limpiar todos los dibujos
// La herramienta activa se guarda en el store global (drawingTool)
// y ChartPanel la lee para activar el modo de dibujo correspondiente.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react'
import {
  MousePointer2, Crosshair, TrendingUp, Minus, AlignCenter,
  GitFork, Percent, BarChart3, Square, Circle,
  Type, Ruler, Trash2, ChevronRight, Layers, ZoomIn,
  ArrowUpRight, SeparatorHorizontal,
} from 'lucide-react'
import useStore from '../store/useStore'

// ── Configuración de todas las herramientas ──────────────────
// Agrupadas igual que TradingView: cursor, líneas, fibonacci, formas, utiles
const TOOL_GROUPS = [
  // Grupo 1: Herramientas de cursor
  [
    { id: 'cursor',      icon: MousePointer2,      label: 'Cursor',                 shortcut: 'V' },
    { id: 'crosshair',   icon: Crosshair,           label: 'Punto de medición',      shortcut: 'M' },
  ],
  // Grupo 2: Herramientas de línea
  [
    { id: 'trendline',   icon: TrendingUp,           label: 'Línea de tendencia',     shortcut: 'Alt+T' },
    { id: 'hline',       icon: Minus,               label: 'Línea horizontal',       shortcut: 'Alt+H' },
    { id: 'vline',       icon: AlignCenter,         label: 'Línea vertical',         shortcut: 'Alt+V' },
    { id: 'ray',         icon: ArrowUpRight,        label: 'Rayo de precio',         shortcut: null   },
    { id: 'channel',     icon: GitFork,             label: 'Canal de precio',        shortcut: null   },
  ],
  // Grupo 3: Fibonacci
  [
    { id: 'fibonacci',   icon: Percent,             label: 'Retroceso Fibonacci',    shortcut: 'Alt+F' },
    { id: 'fibext',      icon: Layers,              label: 'Extensión Fibonacci',    shortcut: null   },
  ],
  // Grupo 4: Formas
  [
    { id: 'rectangle',   icon: Square,              label: 'Rectángulo',             shortcut: 'Alt+R' },
    { id: 'ellipse',     icon: Circle,              label: 'Elipse',                 shortcut: null   },
  ],
  // Grupo 5: Texto y medición
  [
    { id: 'text',        icon: Type,                label: 'Texto / Anotación',      shortcut: 'Alt+N' },
    { id: 'measure',     icon: Ruler,               label: 'Medir distancia',        shortcut: null   },
    { id: 'zoom',        icon: ZoomIn,              label: 'Zoom de selección',      shortcut: null   },
  ],
  // Grupo 6: Limpiar
  [
    { id: 'trash',       icon: Trash2,              label: 'Borrar todos los dibujos', shortcut: null },
  ],
]

// ── Botón individual de herramienta ─────────────────────────
// Muestra el icono, tooltip al hover, y estado activo/inactivo.
function ToolButton({ tool, isActive, onClick }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const IconComp = tool.icon

  return (
    <div className="relative">
      <button
        onClick={() => onClick(tool.id)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          w-9 h-9 flex items-center justify-center rounded-md transition-all duration-100
          ${isActive
            ? 'bg-accent/20 text-accent border border-accent/40'
            : 'text-muted hover:text-text-primary hover:bg-surface'
          }
          ${tool.id === 'trash' ? 'hover:text-put hover:bg-put/10' : ''}
        `}
        title={tool.label}
      >
        <IconComp size={15} strokeWidth={1.8} />
      </button>

      {/* Tooltip con nombre y shortcut */}
      {showTooltip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50
                        bg-surface border border-border rounded-md px-2.5 py-1.5
                        shadow-xl whitespace-nowrap pointer-events-none">
          <div className="text-[11px] font-medium text-text-primary">{tool.label}</div>
          {tool.shortcut && (
            <div className="text-[9px] text-muted mt-0.5">{tool.shortcut}</div>
          )}
          {/* Triángulo apuntando a la izquierda */}
          <div className="absolute right-full top-1/2 -translate-y-1/2
                          border-4 border-transparent border-r-border" />
        </div>
      )}
    </div>
  )
}

// ── Componente principal LeftToolbar ─────────────────────────
export default function LeftToolbar() {
  const { drawingTool, setDrawingTool } = useStore()

  // Manejamos clic en herramienta
  // 'trash' es una acción (no un estado persistente), vuelve a cursor al activar
  const handleToolClick = (toolId) => {
    if (toolId === 'trash') {
      // Disparamos evento global para que ChartPanel limpie los dibujos
      window.dispatchEvent(new CustomEvent('chart:clearDrawings'))
      setDrawingTool('cursor')
    } else {
      // Activamos la herramienta (toggle: si ya está activa, vuelve a cursor)
      setDrawingTool(drawingTool === toolId ? 'cursor' : toolId)
    }
  }

  return (
    // ── Barra lateral izquierda ────────────────────────────
    // 44px de ancho, igual que TradingView.
    // Fondo ligeramente diferente al bg principal para distinguirse.
    <aside
      className="w-11 bg-surface border-r border-border flex flex-col items-center
                 py-2 gap-0.5 flex-shrink-0 overflow-hidden select-none"
      style={{ zIndex: 10 }}
    >
      {/* Renderizamos cada grupo de herramientas separado por un divisor */}
      {TOOL_GROUPS.map((group, groupIdx) => (
        <div key={groupIdx} className="flex flex-col items-center w-full px-1 gap-0.5">
          {/* Divisor entre grupos (excepto el primero) */}
          {groupIdx > 0 && (
            <div className="w-6 h-px bg-border my-1 mx-auto" />
          )}

          {/* Botones del grupo */}
          {group.map(tool => (
            <ToolButton
              key={tool.id}
              tool={tool}
              isActive={drawingTool === tool.id}
              onClick={handleToolClick}
            />
          ))}
        </div>
      ))}
    </aside>
  )
}
