"use client"

import type React from "react"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock, Crown } from "lucide-react"
import type { MembershipTier } from "@/lib/membership"
import { DEV_MODE_UNRESTRICTED_ACCESS } from "@/lib/membership-constants"

interface FeatureGateProps {
  feature: string
  requiredTier: MembershipTier
  children?: React.ReactNode
}

export function FeatureGate({ feature, requiredTier, children }: FeatureGateProps) {
  const router = useRouter()

  if (DEV_MODE_UNRESTRICTED_ACCESS && children) {
    return <>{children}</>
  }

  return (
    <Card className="border-2 border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Premium Feature</CardTitle>
        </div>
        <CardDescription>Upgrade to unlock {feature}</CardDescription>
      </CardHeader>
      <CardContent>
        {children || (
          <p className="text-sm text-muted-foreground">
            This feature requires <strong>{requiredTier}</strong> membership or higher.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={() => router.push("/student/dashboard-v2/membership")} className="w-full">
          <Crown className="mr-2 h-4 w-4" />
          Upgrade to {requiredTier}
        </Button>
      </CardFooter>
    </Card>
  )
}
