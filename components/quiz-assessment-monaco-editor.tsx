"use client"

import dynamic from "next/dynamic"
import { memo, useEffect, useRef } from "react"
import type { editor } from "monaco-editor"
import {
  applyCodebenchMonacoTheme,
  codebenchEditorOptions,
  registerCodebenchMonacoThemes,
} from "@/lib/codebench-monaco-themes"
import { useCodebenchMonacoTheme } from "@/hooks/use-codebench-monaco-theme"
import { cn } from "@/lib/utils"
import { forceMonacoModelTokenization } from "@/lib/monaco-utils"

function syncMonacoLanguageAndTokens(
  monaco: typeof import("monaco-editor"),
  model: editor.ITextModel,
  language: string,
) {
  monaco.editor.setModelLanguage(model, language)
  forceMonacoModelTokenization(model)
}

const MonacoBase = dynamic(() => import("@monaco-editor/react"), { ssr: false })
const MonacoEditor = memo(MonacoBase)

type QuizAssessmentMonacoEditorProps = {
  height: string | number
  language: string
  value: string
  onChange?: (value: string) => void
  onMount?: (editor: editor.IStandaloneCodeEditor, monaco: typeof import("monaco-editor")) => void
  options?: editor.IStandaloneEditorConstructionOptions
  className?: string
}

export function QuizAssessmentMonacoEditor({
  height,
  language,
  value,
  onChange,
  onMount,
  options,
  className,
}: QuizAssessmentMonacoEditorProps) {
  const { editorTheme } = useCodebenchMonacoTheme()
  const monacoRef = useRef<typeof import("monaco-editor") | null>(null)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    applyCodebenchMonacoTheme(monacoRef.current, editorTheme)
  }, [editorTheme])

  useEffect(() => {
    const editorInstance = editorRef.current
    const monaco = monacoRef.current
    if (!editorInstance || !monaco) return
    const model = editorInstance.getModel()
    if (!model) return
    if (model.getValue() !== value) {
      model.setValue(value)
    }
    syncMonacoLanguageAndTokens(monaco, model, language)
  }, [value, language])

  return (
    <div data-quiz-code-editor className={cn("min-h-0", className)}>
      <MonacoEditor
        height={height}
        language={language}
        theme={editorTheme}
        value={value}
        beforeMount={(monaco) => {
          registerCodebenchMonacoThemes(monaco)
        }}
        onMount={(editorInstance, monaco) => {
          editorRef.current = editorInstance
          monacoRef.current = monaco
          applyCodebenchMonacoTheme(monaco, editorTheme)
          const model = editorInstance.getModel()
          if (model) {
            syncMonacoLanguageAndTokens(monaco, model, language)
          }
          onMount?.(editorInstance, monaco)
        }}
        onChange={(next) => onChange?.(next ?? "")}
        options={{
          ...codebenchEditorOptions(),
          ...options,
        }}
      />
    </div>
  )
}
