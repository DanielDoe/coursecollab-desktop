"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, AlertTriangle, Sparkles, Users, TrendingUp, Award } from "lucide-react";
import { Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";

interface InstructorGradesOverviewProps {
  instructorId: number;
  session?: string;
  /** Increment from parent to refetch without changing section. */
  dataRefreshKey?: number;
}

const COLORS = ["hsl(142, 76%, 36%)", "hsl(221, 83%, 53%)", "hsl(38, 92%, 50%)", "hsl(0, 84%, 60%)", "hsl(0, 0%, 50%)"];

export function InstructorGradesOverview({ instructorId, session = "ALL", dataRefreshKey = 0 }: InstructorGradesOverviewProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams({ instructorId: String(instructorId), session });
      const response = await studentApiFetch(`/api/grades/analytics?${params}`, {
        headers: buildInstructorApiHeaders(),
      });
      const data = await response.json();

      if (response.ok) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchAnalytics();
  }, [instructorId, session, dataRefreshKey]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  const classAverages = analytics?.classAverages || [];
  const gradeDistribution = analytics?.gradeDistribution || [];
  const topEngagement = analytics?.topEngagement || [];
  const atRiskStudents = analytics?.atRiskStudents || [];
  const attendanceCorrelation = analytics?.attendanceCorrelation || [];
  const hasData = classAverages.length > 0 || gradeDistribution.length > 0;

  // Compute KPI values
  const totalStudents = classAverages.reduce((s: number, a: any) => s + (parseInt(a.student_count, 10) || 0), 0);
  const classAvg =
    totalStudents > 0
      ? classAverages.reduce(
          (s: number, a: any) => s + (parseFloat(a.avg_total) || 0) * (parseInt(a.student_count, 10) || 0),
          0
        ) / totalStudents
      : 0;
  const atRiskCount = atRiskStudents.length;
  const distTotal = gradeDistribution.reduce((s: number, g: any) => s + (parseInt(g.count, 10) || 0), 0);
  const passCount = gradeDistribution
    .filter((g: any) => ["A", "B", "C", "D"].includes(g.grade_band))
    .reduce((s: number, g: any) => s + (parseInt(g.count, 10) || 0), 0);
  const passRate = distTotal > 0 ? (passCount / distTotal) * 100 : 0;

  if (!hasData) {
    return (
      <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <BarChart3 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            Grade Overview
          </CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            No grade data yet. Grades are calculated when students view their dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="rounded-full p-4 bg-slate-100 dark:bg-slate-800/50">
            <BarChart3 className="h-12 w-12 text-slate-500 dark:text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-center max-w-md">
            Once students have grades, you&apos;ll see class averages, distribution, and at-risk students here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const gradeDistributionData = gradeDistribution.map((g: any) => ({
    name: g.grade_band,
    value: parseInt(g.count, 10),
  }));

  const attendanceData = attendanceCorrelation.map((r: any) => ({
    name: r.attendance_band,
    avgScore: parseFloat(r.avg_performance) || 0,
    students: parseInt(r.student_count, 10) || 0,
  }));

  const kpiCards = [
    {
      label: "Class Average",
      value: `${Number(classAvg).toFixed(1)}%`,
      sub: `${totalStudents} students`,
      icon: TrendingUp,
      iconBg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      iconColor: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Total Students",
      value: totalStudents,
      sub: "graded",
      icon: Users,
      iconBg: "bg-blue-500/15 dark:bg-blue-500/20",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "At Risk",
      value: atRiskCount,
      sub: "< 60% & < 70% attendance",
      icon: AlertTriangle,
      iconBg: "bg-amber-500/15 dark:bg-amber-500/20",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "Pass Rate",
      value: `${Number(passRate).toFixed(1)}%`,
      sub: "A–D grades",
      icon: Award,
      iconBg: "bg-violet-500/15 dark:bg-violet-500/20",
      iconColor: "text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* KPI Cards - 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={kpi.label}
              className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] overflow-hidden"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {kpi.label}
                    </p>
                    <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      {kpi.value}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{kpi.sub}</p>
                  </div>
                  <div
                    className={`shrink-0 rounded-lg p-2 ${kpi.iconBg}`}
                  >
                    <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${kpi.iconColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Grade Distribution */}
        <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] min-w-0 overflow-hidden">
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
            <div className="w-full h-[220px] sm:h-[260px] min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={gradeDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {gradeDistributionData.map((entry: unknown, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Attendance vs Performance */}
        {attendanceData.length > 0 && (
          <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] min-w-0 overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <TrendingUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                Attendance vs Performance
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Avg score by attendance band
              </CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <div className="w-full h-[220px] sm:h-[260px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-white/10" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="avgScore" fill="hsl(221, 83%, 53%)" name="Avg Score (%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Engaged & At Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Engaged Student */}
        {topEngagement.length > 0 && (
          <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03] min-w-0">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <CardTitle className="text-slate-800 dark:text-slate-100">Top Engaged Student</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{topEngagement[0].full_name}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {Number(topEngagement[0].total_credits ?? 0).toFixed(1)} ECs
                  </p>
                </div>
                <Badge variant="secondary">{topEngagement[0].section}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* At Risk Students */}
        {atRiskStudents.length > 0 && (
          <Card className="border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 min-w-0">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <CardTitle className="text-red-900 dark:text-red-100">
                  {atRiskCount} Students Below 60%
                </CardTitle>
              </div>
              <CardDescription className="text-red-800/80 dark:text-red-200/80">Review needed</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {atRiskCount} student{atRiskCount > 1 ? "s" : ""} with attendance &lt; 70% and total &lt; 60%
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
