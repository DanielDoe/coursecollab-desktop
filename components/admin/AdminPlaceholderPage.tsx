"use client"

import { Construction } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type AdminPlaceholderPageProps = {
  title: string
  description?: string
}

export function AdminPlaceholderPage({ title, description }: AdminPlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <Construction className="h-5 w-5" />
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {description ??
              "This admin module is planned for institution-level oversight. Teaching workflows remain in the instructor portal."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the sidebar to reach live modules such as Users, Courses, Finance, and System Monitor.
        </CardContent>
      </Card>
    </div>
  )
}
