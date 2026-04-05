/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta de colores del terminal de trading
        bg:       '#0B0E11',   // Fondo principal oscuro
        surface:  '#111827',   // Superficie de cards
        border:   '#1E2732',   // Bordes sutiles
        muted:    '#475569',   // Texto secundario
        call:     '#26A69A',   // Verde → señal CALL
        put:      '#EF5350',   // Rojo  → señal PUT
        neutral:  '#64748B',   // Gris  → señal NEUTRAL
        accent:   '#3B82F6',   // Azul  → Claude AI
        warn:     '#F59E0B',   // Amarillo → advertencia / EMA
        // Colores de texto (usados como text-text-primary / text-text-secondary)
        text: {
          primary:   '#D1D4DC',  // Texto principal — blanco suave
          secondary: '#787B86',  // Texto secundario — gris medio
        },
      },
    },
  },
  plugins: [],
}
