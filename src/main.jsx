// ─────────────────────────────────────────────────────────────
// main.jsx — Punto de entrada de la aplicación React
// Este archivo solo inicializa React y monta el componente App
// ─────────────────────────────────────────────────────────────
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Montamos la app en el elemento <div id="root"> del index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
