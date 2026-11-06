type MonacoEditor = {
  editor: {
    defineTheme: (name: string, data: object) => void
    setTheme: (name: string) => void
  }
}

export type CodebenchMonacoThemeName = "codebench-dark" | "codebench-light"

export function applyCodebenchMonacoTheme(
  monaco: MonacoEditor | null | undefined,
  theme: CodebenchMonacoThemeName,
) {
  if (!monaco) return
  monaco.editor.setTheme(theme)
}

/** CourseCollab purple + gold Monaco themes for CodeBench. */
export function registerCodebenchMonacoThemes(monaco: MonacoEditor) {
  monaco.editor.defineTheme("codebench-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "64748b", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd", fontStyle: "bold" },
      { token: "string", foreground: "fcd34d" },
      { token: "number", foreground: "7dd3fc" },
      { token: "type", foreground: "a5b4fc" },
      { token: "function", foreground: "e9d5ff" },
      { token: "variable", foreground: "e2e8f0" },
    ],
    colors: {
      "editor.background": "#0c0f16",
      "editor.foreground": "#e2e8f0",
      "editorLineNumber.foreground": "#475569",
      "editorLineNumber.activeForeground": "#eaaa00",
      "editorGutter.background": "#080b10",
      "editor.selectionBackground": "#582c8355",
      "editor.lineHighlightBackground": "#582c8318",
      "editorCursor.foreground": "#eaaa00",
      "editorWidget.background": "#131825",
      "editorWidget.border": "#582c8340",
      "scrollbarSlider.background": "#582c8333",
      "scrollbarSlider.hoverBackground": "#582c8355",
    },
  })

  monaco.editor.defineTheme("codebench-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "94a3b8", fontStyle: "italic" },
      { token: "keyword", foreground: "582c83", fontStyle: "bold" },
      { token: "string", foreground: "b45309" },
      { token: "number", foreground: "0369a1" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#0f172a",
      "editorLineNumber.foreground": "#94a3b8",
      "editorLineNumber.activeForeground": "#582c83",
      "editorGutter.background": "#f8fafc",
      "editorCursor.foreground": "#582c83",
      "editor.selectionBackground": "#582c8328",
      "editor.lineHighlightBackground": "#582c830c",
    },
  })
}

export function codebenchEditorOptions() {
  return {
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
    fontLigatures: true,
    lineNumbers: "on" as const,
    wordWrap: "on" as const,
    bracketPairColorization: { enabled: true },
    cursorBlinking: "smooth" as const,
    cursorSmoothCaretAnimation: "on" as const,
    smoothScrolling: true,
    padding: { top: 14, bottom: 14 },
    glyphMargin: false,
    folding: true,
    lineDecorationsWidth: 8,
    lineNumbersMinChars: 3,
    scrollBeyondLastLine: false,
    renderLineHighlight: "all" as const,
    overviewRulerBorder: false,
    hideCursorInOverviewRuler: true,
    // Monaco's default autoIndent "full" rewrites the line and shifts the caret.
    formatOnType: false,
    formatOnPaste: false,
    autoIndent: "keep" as const,
  }
}

type MonacoUndoRedoEditor = {
  getDomNode?: () => HTMLElement | null
  trigger: (source: string, handlerId: string, payload: null) => void
  onDidDispose?: (listener: () => void) => { dispose: () => void }
}

/** Shortcuts the desktop Edit menu and Monaco's hidden textarea both swallow. */
export type MonacoEditAction = "undo" | "redo" | "cut" | "copy" | "paste" | "selectAll" | "find" | "comment"

const MONACO_EDIT_COMMAND: Record<MonacoEditAction, string> = {
  undo: "undo",
  redo: "redo",
  cut: "editor.action.clipboardCutAction",
  copy: "editor.action.clipboardCopyAction",
  paste: "editor.action.clipboardPasteAction",
  selectAll: "editor.action.selectAll",
  find: "actions.find",
  comment: "editor.action.commentLine",
}

function monacoEditActionFromKey(event: KeyboardEvent): MonacoEditAction | null {
  if (event.altKey) return null
  const key = event.key.toLowerCase()
  const command = event.metaKey || event.ctrlKey
  if (!command) return null
  if (key === "a" && !event.shiftKey) return "selectAll"
  if (key === "c" && !event.shiftKey) return "copy"
  if (key === "x" && !event.shiftKey) return "cut"
  if (key === "v" && !event.shiftKey) return "paste"
  if (key === "f" && !event.shiftKey) return "find"
  if (key === "/" && !event.shiftKey) return "comment"
  if (key === "z" && !event.shiftKey) return "undo"
  if (key === "z" && event.shiftKey) return "redo"
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) return "redo"
  return null
}

function editorHasFocus(node: HTMLElement): boolean {
  const active = document.activeElement
  return active != null && (node === active || node.contains(active))
}

/**
 * Accessibility mode focuses a hidden textarea, so Cmd/Ctrl+A, Z, C, X, and V
 * hit that textarea instead of the document. The desktop Edit menu also
 * consumes those accelerators. Capture them and run Monaco's commands.
 */
export function bindMonacoUndoRedo(editor: MonacoUndoRedoEditor): () => void {
  const node = editor.getDomNode?.()
  if (!node) return () => {}

  const run = (action: MonacoEditAction) => {
    editor.trigger("keyboard", MONACO_EDIT_COMMAND[action], null)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const action = monacoEditActionFromKey(event)
    if (!action) return
    event.preventDefault()
    event.stopPropagation()
    run(action)
  }

  node.addEventListener("keydown", onKeyDown, true)

  const host = window as Window & {
    __ccMonacoHistory?: (action: "undo" | "redo") => boolean
    __ccMonacoEdit?: (action: MonacoEditAction) => boolean
  }
  const previousHistory = host.__ccMonacoHistory
  const previousEdit = host.__ccMonacoEdit
  const history = (action: "undo" | "redo") => {
    if (!editorHasFocus(node)) return previousHistory?.(action) ?? false
    run(action)
    return true
  }
  const edit = (action: MonacoEditAction) => {
    if (!editorHasFocus(node)) return previousEdit?.(action) ?? false
    run(action)
    return true
  }
  host.__ccMonacoHistory = history
  host.__ccMonacoEdit = edit

  const detach = () => {
    node.removeEventListener("keydown", onKeyDown, true)
    if (host.__ccMonacoHistory === history) host.__ccMonacoHistory = previousHistory
    if (host.__ccMonacoEdit === edit) host.__ccMonacoEdit = previousEdit
  }
  const subscription = editor.onDidDispose?.(detach)
  return () => {
    detach()
    subscription?.dispose()
  }
}
