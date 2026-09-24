"use client"

import { FacultyCodebenchStudioAnalytics } from "@/components/instructor/analytics/FacultyCodebenchStudioAnalytics"
import { InstructorCodebenchStudentActivityPanel } from "@/components/instructor/codebench/InstructorCodebenchStudentActivityPanel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AnalyticsTab = "cora" | "students"

export function InstructorCodebenchStudentAnalytics({
  initialTab = "students",
}: {
  initialTab?: AnalyticsTab
}) {
  return (
    <Tabs defaultValue={initialTab} className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <TabsList className="grid w-full max-w-md shrink-0 grid-cols-2">
        <TabsTrigger value="cora">Cora Analytics</TabsTrigger>
        <TabsTrigger value="students">Students</TabsTrigger>
      </TabsList>
      <TabsContent value="cora" className="mt-0 min-h-0 min-w-0">
        <FacultyCodebenchStudioAnalytics />
      </TabsContent>
      <TabsContent value="students" className="mt-0 flex min-h-0 min-w-0 flex-1 flex-col">
        <InstructorCodebenchStudentActivityPanel />
      </TabsContent>
    </Tabs>
  )
}
