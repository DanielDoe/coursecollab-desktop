import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installDesktopRefreshFetchBridge } from '@/lib/desktop-refresh-token'
import { installSessionExpiryFetchGuard } from '@/lib/session-expiry-logout'
import App from './App'

if (typeof window !== 'undefined') {
  window.__COURSE_COLLAB_DESKTOP__ = true
  document.documentElement.dataset.desktopApp = 'true'
  document.body.classList.add('cc-desktop-app')
  installDesktopRefreshFetchBridge()
  installSessionExpiryFetchGuard()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
