"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";

interface InstructorGradesAnalyticsProps {
  instructorId: number;
  session?: string;
  dataRefreshKey?: number;
}

export function InstructorGradesAnalytics({ instructorId, session = "ALL", dataRefreshKey = 0 }: InstructorGradesAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    studentApiFetch(`/api/grades/analytics?instructorId=${instructorId}&session=${session}`, {
      headers: buildInstructorApiHeaders(),
    })
      .then((r) => r.json())
      .then((data) => setAnalytics(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instructorId, session, dataRefreshKey]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  const attendanceCorrelation = analytics?.attendanceCorrelation || [];
  const performanceTrends = analytics?.performanceTrends || [];
  const gradeDistribution = analytics?.gradeDistribution || [];
  const hasData = attendanceCorrelation.length > 0 || performanceTrends.length > 0 || gradeDistribution.length > 0;

  if (!hasData) {
    return (
      <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Analytics Dashboard
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            No analytics data yet. Calculate grades first to see performance trends and attendance correlations.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-16 text-center text-slate-500 dark:text-slate-400">
          Go to Overview or Manage and run &quot;Calculate All Grades&quot; to populate data.
        </CardContent>
      </Card>
    );
  }

  const attendanceData = attendanceCorrelation.map((r: any) => ({
    name: r.attendance_band,
    avgPerformance: parseFloat(r.avg_performance) || 0,
    students: parseInt(r.student_count, 10) || 0,
  }));

  const trendsData = [...performanceTrends].reverse().map((r: any) => ({
    date: r.date,
    avgTotal: parseFloat(r.avg_total) || 0,
    students: parseInt(r.student_count, 10) || 0,
  }));

  const distributionData = gradeDistribution.map((g: any) => ({
    name: g.grade_band,
    count: parseInt(g.count, 10) || 0,
  }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <h2 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100">Analytics</h2>

      {/* Attendance vs Performance */}
      {attendanceData.length > 0 && (
        <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              Attendance vs Performance
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Average total score by attendance band
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="w-full h-[220px] sm:h-[280px] min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="avgPerformance" fill="hsl(221, 83%, 53%)" name="Avg Score (%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Trends */}
      {trendsData.length > 0 && (
        <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              Performance Trends
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Class average over time (last 30 days)
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="w-full h-[220px] sm:h-[280px] min-h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="avgTotal"
                  stroke="hsl(142, 76%, 36%)"
                  strokeWidth={2}
                  name="Avg Score (%)"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grade Distribution Bar */}
      {distributionData.length > 0 && (
        <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
              <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              Grade Distribution
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Student count by letter grade
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 sm:px-6">
            <div className="w-full h-[200px] sm:h-[240px] min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" width={30} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="hsl(38, 92%, 50%)" name="Students" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
