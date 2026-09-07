"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Users, TrendingUp, Award, AlertTriangle, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { buildInstructorAuthorizedApiHeaders } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import {
  TC_CHART,
  TC_META,
  TC_PANEL,
  TC_PANEL_INNER,
  TC_SPINNER,
  TC_TITLE,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
  tcChrome,
  tcIconBadge,
} from "@/lib/trade-center/trade-center-instructor-ui";

export function InstructorTradeCenterOverview({ instructorId }: { instructorId?: number }) {
  const fp = tcChrome().p;
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { courseScopeVersion } = useInstructorDashboardV2();

  useEffect(() => {
    fetchAnalytics();
  }, [courseScopeVersion]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/trade-center/analytics", {
        headers: buildInstructorAuthorizedApiHeaders(),
      });
      const data = await response.json();
      if (response.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className={cn("h-8 w-8", TC_SPINNER)} />
      </div>
    );
  }

  // Format trades over time for chart (last 6 weeks)
  const tradesOverTimeData =
    stats?.tradesOverTime?.map((row: any) => ({
      label: row.week_start
        ? new Date(row.week_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "—",
      points: Number(row.total_points || 0),
      trades: Number(row.trade_count || 0),
      donations: Number(row.donation_count || 0),
    })) || [];

  // Transaction type breakdown for pie chart
  const transactionPieData =
    stats?.transactions?.map((tx: any, i: number) => ({
      name: tx.transaction_type === "TRADE" ? "Trades" : "Donations",
      value: Number(tx.count || 0),
      fill: tx.transaction_type === "TRADE" ? TC_CHART.primary : TC_CHART.secondary,
    })) || [];

  // Session analytics for bar chart
  const sessionChartData =
    stats?.sessionBreakdown?.map((s: any) => ({
      session: s.session || "ALL",
      avgEc: Number(s.avg_ec || 0),
      students: Number(s.student_count || 0),
      avgPoints: Number(s.avg_points || 0),
    })) || [];

  const topTraders = stats?.topTraders || [];
  const hasCharts =
    tradesOverTimeData.some((d: any) => d.points > 0) ||
    transactionPieData.some((d: any) => d.value > 0) ||
    sessionChartData.length > 0;

  const formatWeekStartLabel = (iso?: string) =>
    iso
      ? new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "America/Chicago",
        })
      : "";

  const reportingWeekDiffers =
    Boolean(stats?.weekStartDate && stats?.calendarWeekStart) &&
    stats.weekStartDate !== stats.calendarWeekStart;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={cn(TC_META, "max-w-3xl space-y-1.5 leading-relaxed")}>
        <p>
          Weekly KPIs and rankings use the week starting{" "}
          <span className={cn("font-medium", PORTAL_TEXT)}>
            {formatWeekStartLabel(stats?.weekStartDate)}
          </span>
          .
        </p>
        {reportingWeekDiffers ? (
          <p className={PORTAL_TEXT_MUTED}>
            There is no trade-center activity recorded yet for the current week (
            <span className={cn("font-medium", PORTAL_TEXT)}>
              {formatWeekStartLabel(stats?.calendarWeekStart)}
            </span>
            ). These figures reflect the most recent week that has data. New points appear after students earn
            practice, playground, or reading credit this week.
          </p>
        ) : null}
      </div>
      <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("p-4 rounded-xl border", fp.softBg, fp.border)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className={cn("h-5 w-5", fp.iconText)} />
                <span className={cn("text-sm font-medium", PORTAL_TEXT_MUTED)}>Active Students</span>
              </div>
              <p className={cn("text-2xl sm:text-3xl font-bold", fp.iconText)}>
                {stats?.stats?.total_students || 0}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={cn("p-4 rounded-xl border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/15")}
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className={cn("h-5 w-5", fp.iconText)} />
                <span className={cn("text-sm font-medium", PORTAL_TEXT_MUTED)}>Avg EC per Student</span>
              </div>
              <p className={cn("text-2xl sm:text-3xl font-bold", fp.iconText)}>
                {Number(stats?.stats?.avg_ec_per_student || 0).toFixed(1)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl border border-[var(--cc-sem-warning-border)] bg-[var(--cc-sem-warning-soft)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-[var(--cc-sem-warning-text)]" />
                <span className={cn("text-sm font-medium", PORTAL_TEXT_MUTED)}>At EC Cap</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--cc-sem-warning-text)]">
                {stats?.stats?.students_at_cap || 0}
              </p>
            </motion.div>
          </div>
      </div>

      {/* Charts row */}
      {hasCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Points traded over time */}
          <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
            <h3 className={cn(TC_TITLE, "mb-4")}>
              Points Traded (Last 6 Weeks)
            </h3>
            {tradesOverTimeData.length > 0 ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradesOverTimeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tradeBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={TC_CHART.primary} stopOpacity={0.9} />
                        <stop offset="100%" stopColor={TC_CHART.primary} stopOpacity={0.4} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{p.label}</p>
                            <p className={cn("text-sm font-semibold", fp.iconText)}>
                              {p.points} pts traded
                            </p>
                            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                              {p.trades} trades · {p.donations} donations
                            </p>
                          </div>
                        );
                      }}
                      cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
                    />
                    <Bar dataKey="points" name="Points" fill="url(#tradeBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center rounded-xl border border-dashed border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/20">
                <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>No trade activity yet</p>
              </div>
            )}
          </div>

          {/* Transaction type breakdown */}
          <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
            <h3 className={cn(TC_TITLE, "mb-4")}>
              Transaction Breakdown (This Week)
            </h3>
            {transactionPieData.some((d: any) => d.value > 0) ? (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={transactionPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {transactionPieData.map((_: any, i: number) => (
                        <Cell key={i} fill={transactionPieData[i]?.fill || TC_CHART.primary} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0];
                        return (
                          <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
                            <p className="text-sm font-semibold">{p.name}: {p.value} transactions</p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[220px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                <p className="text-sm text-slate-500 dark:text-slate-400">No transactions this week</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session analytics + Top traders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Session analytics */}
        <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
          <h3 className={cn(TC_TITLE, "mb-4")}>Session Analytics</h3>
          {sessionChartData.length > 0 ? (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sessionChartData} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(148 163 184 / 0.2)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "rgb(100 116 139)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="session"
                    type="category"
                    width={48}
                    tick={{ fill: "rgb(100 116 139)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return (
                        <div className="rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 py-3 shadow-xl">
                          <p className="text-xs font-medium text-slate-500 mb-1">{p.session}</p>
                          <p className={cn("text-sm font-semibold", fp.iconText)}>{Number(p.avgEc).toFixed(1)} EC avg</p>
                          <p className="text-xs text-slate-500">{p.students} students</p>
                        </div>
                      );
                    }}
                    cursor={{ fill: "rgb(148 163 184 / 0.08)" }}
                  />
                  <Bar dataKey="avgEc" name="Avg EC" fill={TC_CHART.primary} radius={[0, 6, 6, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">No session data</p>
            </div>
          )}
        </div>

        {/* Top traders */}
        <div className={cn(TC_PANEL, TC_PANEL_INNER)}>
          <h3 className={cn(TC_TITLE, "mb-4 flex items-center gap-2")}>
            <Trophy className={cn("h-4 w-4", fp.iconText)} />
            Top Traders
          </h3>
          {topTraders.length > 0 ? (
            <div className="space-y-2">
              {topTraders.slice(0, 8).map((student: any, index: number) => (
                <motion.div
                  key={student.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border transition-colors",
                    index < 3
                      ? cn(fp.softBg, fp.border)
                      : "border-[var(--sidebar-border)] bg-[var(--sidebar-accent)]/15",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                        index < 3 ? tcIconBadge("sm") : "bg-[var(--sidebar-accent)]/60 text-[var(--cc-text-muted)]",
                      )}
                    >
                      {index < 3 ? <Trophy className="h-4 w-4" /> : index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("font-medium truncate", PORTAL_TEXT)}>{student.full_name}</p>
                      <p className={cn("text-xs truncate", PORTAL_TEXT_MUTED)}>
                        {student.student_number} · {student.section}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <p className={cn("font-bold", fp.iconText)}>{student.engagement_credits || 0} EC</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      {student.total_trades_count || 0} trades
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
              <p className="text-sm text-slate-500 dark:text-slate-400">No trader data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Low engagement alert */}
      {stats?.lowEngagement && stats.lowEngagement.length > 0 && (
        <div className={cn(TC_PANEL, "border-[var(--cc-sem-warning-border)]")}>
          <div className={cn(TC_PANEL_INNER, "bg-[var(--cc-sem-warning-soft)]/30")}>
            <h3 className={cn(TC_TITLE, "flex items-center gap-2 text-[var(--cc-sem-warning-text)] mb-1")}>
              <AlertTriangle className="h-5 w-5" />
              Low Engagement Alert
            </h3>
            <p className={cn("text-sm mb-4", PORTAL_TEXT_MUTED)}>Students with 0 EC for 3+ weeks</p>
            <div className="space-y-2">
              {stats.lowEngagement.slice(0, 5).map((student: any) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-[var(--cc-sem-warning-border)] bg-[var(--sidebar-accent)]/20"
                >
                  <div>
                    <p className={cn("font-medium", PORTAL_TEXT)}>{student.full_name}</p>
                    <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
                      {student.student_number} • {student.section}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-lg border-[var(--cc-sem-warning-border)] text-[var(--cc-sem-warning-text)]"
                  >
                    {student.weeks_with_zero_ec || 0} weeks
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
