"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, FileText, Copy, Download, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface DocGeneratorPanelProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (code: string, options: { includeComments: boolean; includeReadme: boolean; includeUml: boolean }) => void
}

export function DocGeneratorPanel({ isOpen, onClose, onGenerate }: DocGeneratorPanelProps) {
  const [code, setCode] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [includeComments, setIncludeComments] = useState(true)
  const [includeReadme, setIncludeReadme] = useState(true)
  const [includeUml, setIncludeUml] = useState(false)
  const [generatedDocs, setGeneratedDocs] = useState<{
    comments: string
    readme: string
    uml: string
  } | null>(null)
  const [activeTab, setActiveTab] = useState("comments")

  const handleGenerate = async () => {
    if (!code.trim()) return

    setIsGenerating(true)
    setGeneratedDocs(null)

    // Simulate generation
    setTimeout(() => {
      setGeneratedDocs({
        comments: `// Example generated comments\n${code.split('\n').map((line, idx) => `// Line ${idx + 1}: ${line.trim() || 'Empty line'}`).join('\n')}`,
        readme: `# Code Documentation\n\n## Overview\nThis code demonstrates...\n\n## Functions\n- \`main()\`: Entry point\n\n## Usage\n\`\`\`cpp\n${code}\n\`\`\``,
        uml: `classDiagram\n    class Main {\n        +main()\n    }`
      })
      setIsGenerating(false)
    }, 2000)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleUseDocs = () => {
    if (generatedDocs) {
      onGenerate(code, { includeComments, includeReadme, includeUml })
      onClose()
      setCode("")
      setGeneratedDocs(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden flex flex-col w-[calc(100%-2rem)] sm:w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl dark:text-slate-200">
            <FileText className="w-4 w-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 shrink-0" />
            <span className="sm:hidden">Doc Generator</span>
            <span className="hidden sm:inline">Documentation Generator</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Left: Code Input & Options */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Your C++ Code</Label>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="#include <iostream>&#10;using namespace std;&#10;&#10;int main() {&#10;  // Your code here&#10;  return 0;&#10;}"
                className="font-mono text-sm min-h-[300px] resize-none"
              />
            </div>

            {/* Options */}
            <div className="space-y-3 p-4 border border-slate-200 rounded-lg">
              <Label className="text-sm font-medium">Documentation Options</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeComments}
                    onChange={(e) => setIncludeComments(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Inline Comments</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeReadme}
                    onChange={(e) => setIncludeReadme(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">README.md</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeUml}
                    onChange={(e) => setIncludeUml(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">UML Diagram</span>
                </label>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!code.trim() || isGenerating}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Documentation
                </>
              )}
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col gap-4 min-w-0 border-l border-slate-200 pl-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Preview</h4>
              {generatedDocs && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const text = activeTab === "comments" ? generatedDocs.comments :
                                   activeTab === "readme" ? generatedDocs.readme :
                                   generatedDocs.uml
                      handleCopy(text)
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {!generatedDocs ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Generated documentation will appear here</p>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="comments" disabled={!includeComments}>
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="readme" disabled={!includeReadme}>
                      README
                    </TabsTrigger>
                    <TabsTrigger value="uml" disabled={!includeUml}>
                      UML
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="comments" className="flex-1 overflow-y-auto mt-4">
                    <pre className="p-4 bg-slate-900 text-green-400 rounded-lg font-mono text-xs overflow-x-auto">
                      {generatedDocs.comments}
                    </pre>
                  </TabsContent>
                  <TabsContent value="readme" className="flex-1 overflow-y-auto mt-4">
                    <div className="p-4 bg-slate-50 rounded-lg prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap">{generatedDocs.readme}</pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="uml" className="flex-1 overflow-y-auto mt-4">
                    <pre className="p-4 bg-slate-900 text-cyan-400 rounded-lg font-mono text-xs overflow-x-auto">
                      {generatedDocs.uml}
                    </pre>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {generatedDocs && (
              <Button
                onClick={handleUseDocs}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                Use Documentation in Chat
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
