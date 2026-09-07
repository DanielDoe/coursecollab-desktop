import { useEffect } from 'react'

type ScriptProps = {
  src?: string
  strategy?: 'afterInteractive' | 'beforeInteractive' | 'lazyOnload' | 'worker'
  id?: string
  onLoad?: () => void
  onReady?: () => void
  onError?: () => void
  dangerouslySetInnerHTML?: { __html: string }
}

export default function Script({
  src,
  id,
  onLoad,
  onReady,
  onError,
  dangerouslySetInnerHTML,
}: ScriptProps) {
  useEffect(() => {
    if (dangerouslySetInnerHTML && id) {
      const existing = document.getElementById(id)
      if (existing) return
      const script = document.createElement('script')
      script.id = id
      script.text = dangerouslySetInnerHTML.__html
      document.body.appendChild(script)
    }

    if (!src) return

    const script = document.createElement('script')
    if (id) script.id = id
    script.src = src
    script.async = true
    script.onload = () => {
      onLoad?.()
      onReady?.()
    }
    script.onerror = () => onError?.()
    document.body.appendChild(script)

    return () => {
      script.remove()
    }
  }, [src, id, onLoad, onReady, onError, dangerouslySetInnerHTML])

  return null
}
