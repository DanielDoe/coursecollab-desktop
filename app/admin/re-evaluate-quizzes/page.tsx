"use client"

import { useState } from "react"
import { AdminHeader } from "@/components/admin-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"

export default function ReEvaluateQuizzesPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleReEvaluate = async () => {
    if (!confirm("This will re-evaluate ALL quiz attempts. This may take several minutes. Continue?")) {
      return
    }

    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch("/api/admin/re-evaluate-quizzes", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
      } else {
        setError(data.error || "Failed to re-evaluate quizzes")
      }
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950">
      <AdminHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Re-Evaluate All Quiz Attempts</CardTitle>
            <CardDescription>
              This tool will re-evaluate all completed quiz attempts using the current grading logic and update scores
              in the database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-yellow-900 dark:text-yellow-100">Warning</p>
                  <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1 list-disc list-inside">
                    <li>This will update all quiz attempt scores in the database</li>
                    <li>The process may take several minutes depending on the number of attempts</li>
                    <li>Students will see updated scores immediately after completion</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button onClick={handleReEvaluate} disabled={isRunning} size="lg" className="w-full">
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Re-evaluating... Please wait
                </>
              ) : (
                "Start Re-Evaluation"
              )}
            </Button>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-900 dark:text-red-100">Error</p>
                    <p className="text-sm text-red-800 dark:text-red-200 mt-1">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {result && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="font-semibold text-green-900 dark:text-green-100">Success!</p>
                    <div className="text-sm text-green-800 dark:text-green-200 space-y-1">
                      <p>Total attempts processed: {result.totalAttempts}</p>
                      <p>Successfully re-evaluated: {result.successCount}</p>
                      {result.errorCount > 0 && <p>Errors: {result.errorCount}</p>}
                      <p className="mt-2 font-medium">{result.message}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
