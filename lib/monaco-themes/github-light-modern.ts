// lib/monaco-themes/github-light-modern.ts
export const githubLightModern = {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6a737d" },
    { token: "keyword", foreground: "d73a49", fontStyle: "bold" },
    { token: "string", foreground: "032f62" },
    { token: "number", foreground: "005cc5" },
    { token: "type", foreground: "6f42c1" },
  ],
  colors: {
    "editor.background": "#fafbfc",
    "editorLineNumber.foreground": "#d1d5da",
    "editorLineNumber.activeForeground": "#24292e",
    "editorCursor.foreground": "#0366d6",
    "editor.selectionBackground": "#c8e1ff",
    "editor.inactiveSelectionBackground": "#fafbfc",
  },
}
