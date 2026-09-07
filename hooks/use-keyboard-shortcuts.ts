import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger shortcuts when typing in input/textarea (unless it's ctrl+enter)
      const target = event.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
      
      if (isInput && !(event.ctrlKey || event.metaKey) && event.key !== 'Enter') {
        return
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrlKey === undefined || shortcut.ctrlKey === (event.ctrlKey || event.metaKey)
        const shiftMatch = shortcut.shiftKey === undefined || shortcut.shiftKey === event.shiftKey
        const altMatch = shortcut.altKey === undefined || shortcut.altKey === event.altKey
        const metaMatch = shortcut.metaKey === undefined || shortcut.metaKey === event.metaKey

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          ctrlMatch &&
          shiftMatch &&
          altMatch &&
          metaMatch
        ) {
          event.preventDefault()
          shortcut.action()
          break
        }
      }
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown, enabled])
}

export const CHAT_SHORTCUTS = {
  SEND_MESSAGE: { key: 'Enter', ctrlKey: true, description: 'Send message' },
  NEW_CHAT: { key: 'n', ctrlKey: true, description: 'New chat' },
  QUICK_ACTIONS: { key: 'k', ctrlKey: true, description: 'Quick actions' },
  SEARCH_HISTORY: { key: 'f', ctrlKey: true, description: 'Search history' },
  TOGGLE_VOICE: { key: 'v', ctrlKey: true, shiftKey: true, description: 'Toggle voice input' },
  COPY_LAST: { key: 'c', ctrlKey: true, shiftKey: true, description: 'Copy last response' },
  CLEAR_INPUT: { key: 'Escape', description: 'Clear input' }
}

