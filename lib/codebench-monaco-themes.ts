type MonacoEditor = {
  editor: {
    defineTheme: (name: string, data: object) => void
  }
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
  }
}
