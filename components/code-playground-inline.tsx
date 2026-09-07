"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Play, Loader2, CheckCircle, XCircle, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface CodePlaygroundInlineProps {
  initialCode: string
  language?: string
}

export function CodePlaygroundInline({ initialCode, language = "cpp" }: CodePlaygroundInlineProps) {
  const { toast } = useToast()
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [isRunning, setIsRunning] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const runCode = async () => {
    setIsRunning(true)
    setOutput("")
    setError("")

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language,
          input: ""
        })
      })

      const data = await response.json()

      if (response.ok) {
        if (data.output) {
          setOutput(data.output)
          toast({
            title: "Success!",
            description: "Code executed successfully"
          })
        }
        if (data.error) {
          setError(data.error)
        }
      } else {
        setError(data.error || "Compilation failed")
      }
    } catch (err) {
      setError("Failed to connect to compiler service")
      toast({
        title: "Error",
        description: "Failed to execute code",
        variant: "destructive"
      })
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="my-4"
    >
      <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-600" />
              Interactive Code Playground
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Code Editor */}
          <div>
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`font-mono text-sm bg-slate-900 text-green-400 border-slate-700 ${
                isExpanded ? 'min-h-[400px]' : 'min-h-[200px]'
              }`}
              placeholder="// Write or modify your C++ code here..."
            />
          </div>

          {/* Run Button */}
          <div className="flex justify-end">
            <Button
              onClick={runCode}
              disabled={isRunning}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 gap-2"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Code
                </>
              )}
            </Button>
          </div>

          {/* Output */}
          {(output || error) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={`p-4 rounded-lg border-2 ${
                error 
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-300 dark:border-red-800' 
                  : 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {error ? (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-800 dark:text-red-200">Error</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-semibold text-green-800 dark:text-green-200">Output</span>
                    </>
                  )}
                </div>
                <pre className={`text-sm font-mono whitespace-pre-wrap ${
                  error ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300'
                }`}>
                  {error || output}
                </pre>
              </div>
            </motion.div>
          )}

          <p className="text-xs text-slate-500 text-center">
            ⚡ Test code snippets instantly • Powered by online compiler
          </p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

