"use client"

import CodeMirror from "@uiw/react-codemirror"
import { cpp } from "@codemirror/lang-cpp"
import { oneDark } from "@codemirror/theme-one-dark"
import { cn } from "@/lib/utils"

type LightCodeViewerProps = {
  value: string
  height?: string
  language?: "cpp" | string | null
  theme?: "dark" | "light"
  className?: string
  editable?: boolean
  onChange?: (value: string) => void
}

function languageExtensions(language?: string | null) {
  const normalized = String(language ?? "cpp").toLowerCase()
  if (normalized === "cpp" || normalized === "c++" || normalized === "c") return [cpp()]
  return [cpp()]
}

/** Lightweight CodeMirror viewer. Faculty live classroom can enable editing to push fixes. */
export function LightCodeViewer({
  value,
  height = "280px",
  language = "cpp",
  theme = "dark",
  className,
  editable = false,
  onChange,
}: LightCodeViewerProps) {
  return (
    <CodeMirror
      value={value}
      height={height}
      theme={theme === "light" ? "light" : oneDark}
      extensions={languageExtensions(language)}
      editable={editable}
      onChange={editable ? onChange : undefined}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: editable,
        highlightActiveLineGutter: editable,
      }}
      className={cn(className)}
    />
  )
}
