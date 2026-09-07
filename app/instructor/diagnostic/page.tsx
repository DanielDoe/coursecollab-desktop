"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"

export default function DiagnosticPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    const diagnostics: any = {}

    // Test each API endpoint
    const endpoints = [
      { name: "Quizzes", url: "/api/instructor/quizzes?assessment_type=quiz" },
      { name: "Students", url: "/api/instructor/students" },
      { name: "Sessions", url: "/api/instructor/sessions" },
      { name: "Groups", url: "/api/instructor/groups" },
      { name: "Projects", url: "/api/instructor/projects" },
      { name: "Lectures", url: "/api/instructor/lectures" },
      { name: "Results", url: "/api/instructor/results" },
      { name: "Notifications", url: "/api/instructor/notifications" },
      { name: "Announcements", url: "/api/instructor/announcements" },
      { name: "Question Bank", url: "/api/question-bank" }
    ]

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url)
        const data = await response.json()
        
        diagnostics[endpoint.name] = {
          status: response.ok ? "success" : "error",
          statusCode: response.status,
          data: data,
          dataCount: (Object.values(data)[0] as unknown[] | undefined)?.length || 0
        }
      } catch (error: any) {
        diagnostics[endpoint.name] = {
          status: "error",
          statusCode: 0,
          error: error.message,
          dataCount: 0
        }
      }
    }

    setResults(diagnostics)
    setLoading(false)
  }

  useEffect(() => {
    runDiagnostics()
  }, [])

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Instructor Module Diagnostics</h1>
          <p className="text-gray-600 mt-2">Testing all instructor API endpoints</p>
        </div>
        <Button onClick={runDiagnostics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Run Diagnostics
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(results).map(([name, result]: [string, any]) => (
          <Card key={name} className={`border-l-4 ${
            result.status === "success" ? "border-l-green-500" : "border-l-red-500"
          }`}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{name}</span>
                {result.status === "success" ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Status:</span>{" "}
                  <span className={result.status === "success" ? "text-green-600" : "text-red-600"}>
                    {result.statusCode}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Items Found:</span>{" "}
                  <span className="font-mono">{result.dataCount}</span>
                </div>
                {result.error && (
                  <div className="text-red-600">
                    <span className="font-semibold">Error:</span> {result.error}
                  </div>
                )}
                {result.data && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600 hover:underline">
                      View Response
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading && (
        <div className="mt-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Running diagnostics...</p>
        </div>
      )}
    </div>
  )
}
