"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Target } from "lucide-react";

interface AttendanceLeaderboardProps {
  session: string;
}

export function AttendanceLeaderboard({ session }: AttendanceLeaderboardProps) {
  // This would fetch from an API endpoint
  // For now, returning a placeholder component
  return (
    <Card className="rounded-xl sm:rounded-2xl overflow-hidden">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600 shrink-0" />
          <CardTitle className="text-base sm:text-lg md:text-xl break-words">Leaderboard</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm break-words mt-0.5 sm:mt-1">
          <span className="sm:hidden">Top performers</span>
          <span className="hidden sm:inline">Top performers and attendance leaders</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 break-words">
          Leaderboard data coming soon. This will show top performers, consistent attendance, and most engaged students.
        </p>
      </CardContent>
    </Card>
  );
}


