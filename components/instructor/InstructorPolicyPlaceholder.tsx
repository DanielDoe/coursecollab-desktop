"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type InstructorPolicyPlaceholderProps = {
  title: string
  description: string
  relatedHref?: string
  relatedLabel?: string
}

export function InstructorPolicyPlaceholder({
  title,
  description,
  relatedHref,
  relatedLabel,
}: InstructorPolicyPlaceholderProps) {
  return (
    <Card className="border-slate-200/80 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-4">
        <p>
          Configure these policies for your course without admin approval. Additional controls will appear here as
          they are wired to your course data.
        </p>
        {relatedHref && relatedLabel && (
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={relatedHref}>{relatedLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
