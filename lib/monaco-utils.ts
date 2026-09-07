// Lazy load monaco-editor only on client side to avoid SSR errors
let monaco: typeof import("monaco-editor") | null = null

async function getMonaco() {
  if (typeof window === "undefined") {
    throw new Error("Monaco Editor can only be used on the client side")
  }
  if (!monaco) {
    monaco = await import("monaco-editor")
  }
  return monaco
}

/**
 * Highlight a specific line in Monaco Editor
 */
export async function highlightLine(editor: any, lineNumber: number, className: string = "highlighted-line") {
  const monacoEditor = await getMonaco()
  // Remove existing decorations
  const model = editor.getModel()
  if (!model) return

  // Create decoration for the line
  const decorations = editor.deltaDecorations(
    [],
    [
      {
        range: new monacoEditor.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: className,
          glyphMarginClassName: "highlighted-line-glyph",
          glyphMarginHoverMessage: { value: `Line ${lineNumber}` },
        },
      },
    ]
  )

  // Scroll to line
  editor.revealLineInCenter(lineNumber)

  return decorations
}

/**
 * Add error markers to specific lines
 */
export async function addErrorMarkers(
  editor: any,
  markers: { lineNumber: number; message: string; severity: "error" | "warning" | "info" }[]
) {
  const monacoEditor = await getMonaco()
  const model = editor.getModel()
  if (!model) return

  const monacoMarkers: any[] = markers.map((marker) => ({
    startLineNumber: marker.lineNumber,
    startColumn: 1,
    endLineNumber: marker.lineNumber,
    endColumn: model.getLineLength(marker.lineNumber) + 1,
    message: marker.message,
    severity:
      marker.severity === "error"
        ? monacoEditor.MarkerSeverity.Error
        : marker.severity === "warning"
        ? monacoEditor.MarkerSeverity.Warning
        : monacoEditor.MarkerSeverity.Info,
  }))

  monacoEditor.editor.setModelMarkers(model, "codebench", monacoMarkers)
}

/**
 * Clear all decorations and markers
 */
export async function clearHighlights(editor: any) {
  const monacoEditor = await getMonaco()
  const model = editor.getModel()
  if (!model) return

  editor.deltaDecorations([], [])
  monacoEditor.editor.setModelMarkers(model, "codebench", [])
}

/**
 * Add custom CSS for line highlighting
 */
export function addHighlightStyles() {
  if (typeof document === "undefined") return

  const styleId = "monaco-highlight-styles"
  if (document.getElementById(styleId)) return

  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
    .monaco-editor .highlighted-line {
      background: linear-gradient(90deg, rgba(139, 92, 246, 0.28), rgba(139, 92, 246, 0.08)) !important;
      border-left: 3px solid rgb(167, 139, 250) !important;
      animation: codebench-line-pulse 1.2s ease-in-out infinite;
    }
    .monaco-editor .highlighted-line-glyph {
      background-color: rgb(167, 139, 250) !important;
      animation: codebench-glyph-pulse 1.2s ease-in-out infinite;
    }
    @keyframes codebench-line-pulse {
      0%, 100% { box-shadow: inset 0 0 0 0 rgba(167, 139, 250, 0); }
      50% { box-shadow: inset 0 0 24px 0 rgba(167, 139, 250, 0.15); }
    }
    @keyframes codebench-glyph-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }
    .execution-line-active {
      animation: execution-context-pulse 1.4s ease-in-out infinite;
    }
    @keyframes execution-context-pulse {
      0%, 100% { box-shadow: inset 0 0 0 rgba(139, 92, 246, 0); }
      50% { box-shadow: inset 0 0 20px rgba(139, 92, 246, 0.12); }
    }
    .monaco-editor .error-line {
      background-color: rgba(239, 68, 68, 0.2) !important;
      border-left: 3px solid rgba(239, 68, 68, 0.8) !important;
    }
    .monaco-editor .error-line-glyph {
      background-color: rgba(239, 68, 68, 0.8) !important;
    }
    .monaco-editor .warning-line {
      background-color: rgba(251, 191, 36, 0.2) !important;
      border-left: 3px solid rgba(251, 191, 36, 0.8) !important;
    }
    .monaco-editor .warning-line-glyph {
      background-color: rgba(251, 191, 36, 0.8) !important;
    }
  `
  document.head.appendChild(style)
}
