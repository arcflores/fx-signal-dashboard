// ─────────────────────────────────────────────────────────────
// vite.config.js — Configuración del bundler Vite
// Vite es el compilador que convierte el código React en archivos
// HTML/JS/CSS que el navegador puede leer directamente.
// ─────────────────────────────────────────────────────────────
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Puerto local de desarrollo
  server: {
    port: 3000,
  },

  // Carpeta de salida para el build de producción
  build: {
    outDir: 'dist',
  },
})
