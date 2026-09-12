import { useEffect, useRef } from 'react'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { cn } from '@/lib/utils'
import '@xterm/xterm/css/xterm.css'

type TerminalProps = {
  isDark: boolean
  acceptInput: boolean
  onInput: (data: string) => void
  onReady: (api: { write: (text: string) => void; clear: () => void; fit: () => { cols: number; rows: number } }) => void
}

/** Fixed terminal surfaces — do not inherit --card (can stay dark in mixed theme trees). */
const LIGHT_TERMINAL_THEME: ITheme = {
  background: '#ffffff',
  foreground: '#0f172a',
  cursor: '#582c83',
  cursorAccent: '#ffffff',
  selectionBackground: '#582c8328',
  black: '#0f172a',
  brightBlack: '#64748b',
  red: '#dc2626',
  brightRed: '#b91c1c',
  green: '#15803d',
  brightGreen: '#166534',
  yellow: '#ca8a04',
  blue: '#582c83',
  brightBlue: '#6d28d9',
  cyan: '#0369a1',
  white: '#f8fafc',
  brightWhite: '#ffffff',
}

const DARK_TERMINAL_THEME: ITheme = {
  background: '#0c0f16',
  foreground: '#e2e8f0',
  cursor: '#eaaa00',
  cursorAccent: '#0c0f16',
  selectionBackground: '#582c8355',
  black: '#18181b',
  brightBlack: '#94a3b8',
  red: '#f87171',
  brightRed: '#fca5a5',
  green: '#4ade80',
  brightGreen: '#86efac',
  yellow: '#facc15',
  blue: '#a78bfa',
  cyan: '#38bdf8',
}

function buildXtermTheme(isDark: boolean): ITheme {
  return isDark ? DARK_TERMINAL_THEME : LIGHT_TERMINAL_THEME
}

function syncTerminalDomBackground(host: HTMLElement, isDark: boolean) {
  const bg = isDark ? DARK_TERMINAL_THEME.background! : LIGHT_TERMINAL_THEME.background!
  host.style.backgroundColor = bg
  host.querySelectorAll<HTMLElement>('.xterm-scrollable-element, .xterm-viewport, .xterm-screen').forEach((el) => {
    el.style.backgroundColor = bg
  })
}

export function ProgramTerminal({ isDark, acceptInput, onInput, onReady }: TerminalProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const acceptRef = useRef(acceptInput)
  const onInputRef = useRef(onInput)
  const onReadyRef = useRef(onReady)
  acceptRef.current = acceptInput
  onInputRef.current = onInput
  onReadyRef.current = onReady

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const term = new XTerm({
      convertEol: true,
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', Menlo, monospace",
      scrollback: 2000,
      theme: buildXtermTheme(isDark),
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(host)
    fit.fit()
    syncTerminalDomBackground(host, isDark)
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

    onReadyRef.current({
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
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const term = termRef.current
    if (!host || !term) return

    const theme = buildXtermTheme(isDark)
    term.options.theme = theme
    syncTerminalDomBackground(host, isDark)
    term.refresh(0, term.rows - 1)
  }, [isDark])

  return (
    <div
      ref={hostRef}
      className={cn(
        'codebench-terminal h-full min-h-0 w-full overflow-hidden',
        isDark ? 'codebench-terminal--dark bg-[#0c0f16]' : 'codebench-terminal--light bg-white',
      )}
    />
  )
}
