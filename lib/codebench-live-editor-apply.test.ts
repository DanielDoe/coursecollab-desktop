/**
 * Run: npx tsx --test lib/codebench-live-editor-apply.test.ts
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
  applyLiveEditorText,
  clampLiveEditorPosition,
  monacoCodeFromChange,
  readLiveEditorValue,
} from "./codebench-live-editor-apply"

function fakeEditor(initial: string, position = { lineNumber: 2, column: 4 }) {
  let value = initial
  let caret = { ...position }
  const lines = () => value.split("\n")
  const fullRange = () => ({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: Math.max(1, lines().length),
    endColumn: (lines().at(-1)?.length ?? 0) + 1,
  })
  return {
    getValue: () => value,
    setValue: (next: string) => {
      value = next
      caret = { lineNumber: 1, column: 1 }
    },
    executeEdits: (
      _source: string,
      edits: Array<{ range: unknown; text: string; forceMoveMarkers?: boolean }>,
    ) => {
      value = edits[0]?.text ?? value
      if (edits[0]?.forceMoveMarkers) {
        const nextLines = value.split("\n")
        caret = {
          lineNumber: Math.max(1, nextLines.length),
          column: (nextLines.at(-1)?.length ?? 0) + 1,
        }
      }
      return true
    },
    getPosition: () => caret,
    setPosition: (next: { lineNumber: number; column: number }) => {
      caret = { ...next }
    },
    revealPosition: (next: { lineNumber: number; column: number }) => {
      caret = { ...next }
    },
    getModel: () => ({
      getLineCount: () => Math.max(1, lines().length),
      getLineMaxColumn: (line: number) => (lines()[line - 1]?.length ?? 0) + 1,
      getFullModelRange: fullRange,
    }),
    caret: () => caret,
  }
}

describe("readLiveEditorValue", () => {
  it("prefers Monaco over the React fallback", () => {
    assert.equal(readLiveEditorValue({ getValue: () => "from-editor" }, "from-react"), "from-editor")
    assert.equal(readLiveEditorValue(null, "from-react"), "from-react")
  })
})

describe("clampLiveEditorPosition", () => {
  it("keeps the caret on an existing line instead of jumping to the file end", () => {
    const editor = fakeEditor("one\ntwo\nthree", { lineNumber: 2, column: 3 })
    const clamped = clampLiveEditorPosition(editor, { lineNumber: 2, column: 99 })
    assert.deepEqual(clamped, { lineNumber: 2, column: 4 })
  })
})

describe("applyLiveEditorText", () => {
  it("restores the previous caret after replacing the buffer", () => {
    const editor = fakeEditor("int main() {\n  return 0;\n}\n", { lineNumber: 2, column: 4 })
    let reactCode = editor.getValue()
    const applied = applyLiveEditorText(editor, "int main() {\n  return 1;\n}\n", (next) => {
      reactCode = next
    })
    assert.equal(applied, true)
    assert.equal(reactCode, "int main() {\n  return 1;\n}\n")
    assert.deepEqual(editor.caret(), { lineNumber: 2, column: 4 })
  })

  it("does not call setValue when the model is not ready", () => {
    let setValueCalls = 0
    let caret = { lineNumber: 3, column: 2 }
    const editor = {
      getValue: () => "typed",
      setValue: () => {
        setValueCalls += 1
        caret = { lineNumber: 99, column: 99 }
      },
      getPosition: () => caret,
      setPosition: (next: { lineNumber: number; column: number }) => {
        caret = { ...next }
      },
      getModel: () => null,
    }
    applyLiveEditorText(editor, "incoming", () => {})
    assert.equal(setValueCalls, 0)
    assert.deepEqual(caret, { lineNumber: 3, column: 2 })
  })

  it("does not rewrite when the buffer is unchanged", () => {
    const editor = fakeEditor("same", { lineNumber: 1, column: 2 })
    let writes = 0
    const applied = applyLiveEditorText(editor, "same", () => {
      writes += 1
    })
    assert.equal(applied, false)
    assert.equal(writes, 1)
    assert.deepEqual(editor.caret(), { lineNumber: 1, column: 2 })
  })
})

describe("monacoCodeFromChange", () => {
  it("ignores remount undefined so the buffer is not wiped", () => {
    assert.equal(monacoCodeFromChange(undefined), null)
    assert.equal(monacoCodeFromChange("int x = 1;"), "int x = 1;")
    assert.equal(monacoCodeFromChange(""), "")
  })
})
