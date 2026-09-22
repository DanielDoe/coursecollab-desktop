export type LiveMonacoPosition = {
  lineNumber: number
  column: number
}

type LiveMonacoRange = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export type LiveMonacoEditor = {
  getValue?: () => string
  setValue?: (value: string) => void
  getPosition?: () => LiveMonacoPosition | null | undefined
  setPosition?: (position: LiveMonacoPosition) => void
  revealPosition?: (position: LiveMonacoPosition) => void
  revealPositionInCenterIfOutsideViewport?: (position: LiveMonacoPosition) => void
  getSelections?: () => LiveMonacoRange[] | null
  getScrollTop?: () => number
  setScrollTop?: (scrollTop: number) => void
  hasTextFocus?: () => boolean
  executeEdits?: (
    source: string,
    edits: Array<{ range: LiveMonacoRange; text: string; forceMoveMarkers?: boolean }>,
    endCursorState?: unknown,
  ) => boolean
  getModel?: () => {
    getLineCount?: () => number
    getLineMaxColumn?: (line: number) => number
    getFullModelRange?: () => LiveMonacoRange
  } | null
} | null | undefined

export function readLiveEditorValue(editor: LiveMonacoEditor, fallback = ""): string {
  try {
    const value = editor?.getValue?.()
    if (typeof value === "string") return value
  } catch {
    /* editor unmounting */
  }
  return fallback
}

export function clampLiveEditorPosition(
  editor: LiveMonacoEditor,
  position: LiveMonacoPosition | null | undefined,
): LiveMonacoPosition | null {
  if (!position) return null
  const lineNumber = Math.max(1, Math.trunc(position.lineNumber) || 1)
  const column = Math.max(1, Math.trunc(position.column) || 1)
  try {
    const model = editor?.getModel?.()
    const lineCount = Math.max(1, model?.getLineCount?.() ?? 1)
    const nextLine = Math.min(lineNumber, lineCount)
    const maxColumn = model?.getLineMaxColumn?.(nextLine) ?? column
    return {
      lineNumber: nextLine,
      column: Math.min(column, Math.max(1, maxColumn)),
    }
  } catch {
    return { lineNumber, column }
  }
}

function selectionFromPosition(position: LiveMonacoPosition): LiveMonacoRange {
  return {
    startLineNumber: position.lineNumber,
    startColumn: position.column,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
    selectionStartLineNumber: position.lineNumber,
    selectionStartColumn: position.column,
    positionLineNumber: position.lineNumber,
    positionColumn: position.column,
  } as LiveMonacoRange
}

function writeLiveEditorText(
  editor: LiveMonacoEditor,
  nextCode: string,
  previousPosition: LiveMonacoPosition | null,
): boolean {
  const model = editor?.getModel?.()
  const range = model?.getFullModelRange?.()
  if (range && editor?.executeEdits) {
    const selections = editor.getSelections?.()
    const endCursorState =
      selections && selections.length > 0
        ? selections
        : previousPosition
          ? [selectionFromPosition(previousPosition)]
          : undefined
    // endCursorState is applied after the edit. Omitting it lets Monaco park
    // the caret at the end of the replaced buffer.
    editor.executeEdits(
      "live-classroom",
      [{ range, text: nextCode, forceMoveMarkers: false }],
      endCursorState,
    )
    return true
  }
  // Do not fall back to setValue — it throws the caret to the end of the file
  // and fights the student while they type. Retry when the model is ready.
  return false
}

/**
 * Replace Monaco text without sending the caret to the start/end of the file.
 * Prefer executeEdits(forceMoveMarkers: false) — setValue and monaco-react
 * `value` sync both throw the caret to the end of the buffer.
 */
export function applyLiveEditorText(
  editor: LiveMonacoEditor,
  nextCode: string,
  setCode: (code: string) => void,
): boolean {
  const current = readLiveEditorValue(editor, "")
  if (current === nextCode) {
    setCode(nextCode)
    return false
  }

  let previousPosition: LiveMonacoPosition | null = null
  let scrollTop = 0
  try {
    previousPosition = editor?.getPosition?.() ?? null
    scrollTop = editor?.getScrollTop?.() ?? 0
  } catch {
    previousPosition = null
  }

  try {
    const wrote = writeLiveEditorText(editor, nextCode, previousPosition)
    if (wrote) {
      const nextPosition = clampLiveEditorPosition(editor, previousPosition)
      if (nextPosition && editor?.setPosition) {
        editor.setPosition(nextPosition)
      }
      editor?.setScrollTop?.(scrollTop)
    }
  } catch {
    /* Monaco may not be mounted yet. */
  }

  setCode(nextCode)
  return true
}

/** Monaco fires onChange(undefined) while remounting; that must not wipe the buffer. */
export function monacoCodeFromChange(value: string | undefined): string | null {
  return typeof value === "string" ? value : null
}
