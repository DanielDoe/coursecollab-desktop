'use client'

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isDesktopAppShell } from '@/lib/desktop-auth-policy'
import { openDesktopUrl } from '@/lib/desktop-open-url'

/**
 * Keeps all navigation in the single Electron window: no popups, no target=_blank tabs.
 */
export function DesktopNavigationGuard() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isDesktopAppShell()) return

    const nativeOpen = window.open.bind(window)
    window.open = ((url?: string | URL, _target?: string, _features?: string) => {
      if (url == null || url === '' || url === 'about:blank') {
        return null
      }
      void openDesktopUrl(String(url), navigate)
      return null
    }) as typeof window.open

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = (event.target as Element | null)?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor?.href) return
      if (anchor.hasAttribute('download')) return

      const target = anchor.getAttribute('target')
      const opensNewContext = target != null && target !== '' && target !== '_self'
      if (!opensNewContext) return

      event.preventDefault()
      event.stopPropagation()
      void openDesktopUrl(anchor.href, navigate)
    }

    document.addEventListener('click', onClickCapture, true)

    return () => {
      window.open = nativeOpen
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [navigate])

  return null
}
