import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { initPwa } from './lib/pwa'
import { initTheme } from './lib/theme'
import { initUiLang, loadUiDict } from './i18n'

initUiLang()
initTheme()
initPwa()

// Жаңа нұсқа шыққанда ашық тұрған беттегі ескі файлдар табылмауы мүмкін — бетті бір рет жаңартамыз.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('ainur-reload') || 0)
    if (Date.now() - last < 10_000) return
    sessionStorage.setItem('ainur-reload', String(Date.now()))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

// Аударма сөздігі жүктелгеннен кейін ғана қосымшаны ашамыз: модульдердегі tr() дұрыс тілде шығады.
void loadUiDict()
  .then(() => import('./App.tsx'))
  .then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </StrictMode>,
    )
  })
