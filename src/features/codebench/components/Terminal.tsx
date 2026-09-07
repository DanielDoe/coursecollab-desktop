import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

type TerminalProps = {
  isDark: boolean
  acceptInput: boolean
  onInput: (data: string) => void
  onReady: (api: { write: (text: string) => void; clear: () => void; fit: () => { cols: number; rows: number } }) => void
}

function cssVar(el: HTMLElement, name: string, fallback: string) {
  const value = getComputedStyle(el).getPropertyValue(name).trim()
  return value || fallback
}

function withAlpha(color: string, hexAlpha: string) {
  if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
    const hex = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color
    return `${hex}${hexAlpha}`
  }
  return color
}

export function ProgramTerminal({ isDark, acceptInput, onInput, onReady }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const acceptRef = useRef(acceptInput)
  const onInputRef = useRef(onInput)
  acceptRef.current = acceptInput
  onInputRef.current = onInput

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const card = cssVar(host, '--card', isDark ? '#0f0f0f' : '#ffffff')
    const text = cssVar(host, '--cc-text', isDark ? '#f5f5f5' : '#0f172a')
    const muted = cssVar(host, '--cc-text-muted', isDark ? '#a3a3a3' : '#64748b')
    const accent = cssVar(host, '--cc-accent', '#582c83')
    const success = cssVar(host, '--cc-success', isDark ? '#4ade80' : '#15803d')

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', Menlo, monospace",
      scrollback: 2000,
      theme: {
        background: card,
        foreground: text,
        cursor: accent,
        cursorAccent: card,
        selectionBackground: withAlpha(accent, isDark ? '88' : '30'),
        black: isDark ? '#18181b' : '#0f172a',
        brightBlack: muted,
        green: success,
        brightGreen: success,
        blue: accent,
        cyan: cssVar(host, '--cc-info', '#0369a1'),
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    termRef.current = term
    fitRef.current = fit

    const dataSub = term.onData((data) => {
      if (!acceptRef.current) return
      onInputRef.current(data)
    })

    const measure = () => {
      fit.fit()
      return { cols: term.cols, rows: term.rows }
    }

    onReady({
      write: (text) => term.write(text),
      clear: () => term.clear(),
      fit: measure,
    })

    const observer = new ResizeObserver(() => {
      fit.fit()
    })
    observer.observe(host)

    return () => {
      observer.disconnect()
      dataSub.dispose()
      term.dispose()
      termRef.current = null
      fitRef.current = null
    }
  }, [isDark, onReady])

  return <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden bg-[var(--card)]" />
}
