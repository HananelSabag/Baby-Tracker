import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// When the service worker updates and takes control (skipWaiting + claim),
// reload once to load the new JS/CSS bundle from the updated cache.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Dismiss the inlined boot splash (see index.html) once React has mounted.
// A short minimum on-screen time keeps it from flashing on warm loads — the
// splash should read as a deliberate opening, not a glitch.
//
// Deliberately NOT gated on requestAnimationFrame: rAF is paused in a hidden or
// non-compositing tab, which left this full-screen overlay stuck on top of the
// app. setTimeout fires regardless of visibility. index.html also carries a
// CSS-only failsafe in case this module never runs at all.
const SPLASH_MIN_MS = 450
const splash = document.getElementById('bt-splash')
if (splash) {
  setTimeout(() => {
    splash.dataset.hiding = 'true'
    splash.addEventListener('transitionend', () => splash.remove(), { once: true })
    // The transition won't fire under reduce-motion or in a hidden tab.
    setTimeout(() => splash.remove(), 600)
  }, SPLASH_MIN_MS)
}
