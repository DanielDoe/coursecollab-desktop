"use client"

import CodeMirror from "@uiw/react-codemirror"
import { cpp } from "@codemirror/lang-cpp"
import { oneDark } from "@codemirror/theme-one-dark"

type LightCodeViewerProps = {
  value: string
  height?: string
  language?: "cpp"
  className?: string
}

/** Read-only code display — ~200 KB vs Monaco's ~5 MB+. Use Monaco for editable / anti-cheat flows. */
export function LightCodeViewer({
  value,
  height = "280px",
  language = "cpp",
  className,
}: LightCodeViewerProps) {
  const extensions = language === "cpp" ? [cpp()] : []

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={oneDark}
      extensions={extensions}
      editable={false}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
      }}
      className={className}
    />
  )
}
