import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// --- NGROK AYARI ---
// Bu ayar, tüm uygulamanın Ngrok'un uyarı sayfasını atlamasını sağlar.
axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';
// -------------------

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)