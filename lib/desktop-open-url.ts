import { isDesktopAppShell } from '@/lib/desktop-auth-policy'

export type DesktopNavigate = (to: string) => void

function isHttpOrMailUrl(url: URL): boolean {
  return (
    url.protocol === 'http:' ||
    url.protocol === 'https:' ||
    url.protocol === 'mailto:' ||
    url.protocol === 'tel:'
  )
}

export async function openDesktopUrl(rawUrl: string, navigate?: DesktopNavigate): Promise<void> {
  if (typeof window === 'undefined') return

  if (!isDesktopAppShell()) {
    window.open(rawUrl, '_blank', 'noopener,noreferrer')
    return
  }

  let url: URL
  try {
    url = new URL(rawUrl, window.location.href)
  } catch {
    return
  }

  if (url.origin === window.location.origin) {
    const path = `${url.pathname}${url.search}${url.hash}`
    if (navigate) {
      navigate(path)
    } else {
      window.history.pushState(null, '', path)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }
    return
  }

  if (url.protocol === 'blob:' || url.protocol === 'data:') {
    window.location.assign(url.href)
    return
  }

  if (isHttpOrMailUrl(url)) {
    await window.courseCollabDesktop?.openExternal?.(url.href)
  }
}
