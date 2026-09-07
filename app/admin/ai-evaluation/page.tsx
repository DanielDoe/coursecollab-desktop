"use client"

import { AISettingsPanel } from "@/components/ai-settings-panel"
import { AIAnalyticsDashboard } from "@/components/ai-analytics-dashboard"
import { AdminAIEvaluationConfig } from "@/components/admin-ai-evaluation-config"
import { AdminHeader } from "@/components/admin-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePreventBack } from "@/hooks/use-prevent-back"

export default function AIEvaluationPage() {
  usePreventBack("/admin/login")

  return (
    <div className="min-h-screen bg-secondary">
      <AdminHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">AI Evaluation System</h2>
            <p className="text-muted-foreground">
              Configure AI grading settings, monitor performance, and review AI-graded answers
            </p>
          </div>

          <Tabs defaultValue="configuration" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-3">
              <TabsTrigger value="configuration">Configuration</TabsTrigger>
              <TabsTrigger value="settings">AI Settings</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="configuration">
              <AdminAIEvaluationConfig />
            </TabsContent>

            <TabsContent value="settings">
              <AISettingsPanel />
            </TabsContent>

            <TabsContent value="analytics">
              <AIAnalyticsDashboard />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
