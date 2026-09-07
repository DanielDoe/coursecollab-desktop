"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gem, BarChart3, Settings, Users, Gift, ArrowLeft, RefreshCw, History, RotateCw } from "lucide-react";
import { motion } from "framer-motion";
import { getInstructorData } from "@/lib/auth";
import { InstructorTradeCenterOverview } from "@/components/instructor-trade-center-overview";
import { InstructorTradeCenterConfig } from "@/components/instructor-trade-center-config";
import { InstructorTradeCenterAnalytics } from "@/components/instructor-trade-center-analytics";
import { InstructorTradeCenterDonations } from "@/components/instructor-trade-center-donations";
import { InstructorTradeCenterActivitySettings } from "@/components/instructor-trade-center-activity-settings";
import { InstructorTradeCenterRolloverTrades } from "@/components/instructor-trade-center-rollover-trades";
import { InstructorTradeCenterTradeLog } from "@/components/instructor-trade-center-trade-log";

type MenuTab = "overview" | "config" | "analytics" | "donations" | "trade-log" | "rollover-trades" | "activity-settings";

export default function InstructorTradeCenterPage() {
  const router = useRouter();
  const [instructorId, setInstructorId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<MenuTab>("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const instructor = getInstructorData();
    if (!instructor || !instructor.id) {
      router.push("/instructor/login");
      return;
    }

    setInstructorId(parseInt(instructor.id.toString(), 10));
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading Trade Center...</p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
    window.location.reload();
  };

  const menuItems = [
    {
      id: "overview" as MenuTab,
      label: "Overview",
      icon: BarChart3,
      description: "Trade Center dashboard",
    },
    {
      id: "config" as MenuTab,
      label: "Conversion Rules",
      icon: Settings,
      description: "Configure conversion multipliers",
    },
    {
      id: "analytics" as MenuTab,
      label: "Student Analytics",
      icon: Users,
      description: "Student engagement analytics",
    },
    {
      id: "donations" as MenuTab,
      label: "Donations",
      icon: Gift,
      description: "Manage donations",
    },
    {
      id: "trade-log" as MenuTab,
      label: "Trade log",
      icon: History,
      description: "All student trades & requests",
    },
    {
      id: "rollover-trades" as MenuTab,
      label: "Rollover Trades",
      icon: RotateCw,
      description: "Students who traded points for extensions",
    },
    {
      id: "activity-settings" as MenuTab,
      label: "Activity Settings",
      icon: Settings,
      description: "Configure activity sources",
    },
  ];

  return (
    <>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 via-pink-600 to-indigo-600 shadow-lg">
              <Gem className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 bg-clip-text text-transparent">
                Trade Center Management
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Configure and monitor student engagement trades
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button
              onClick={() => router.push("/instructor/dashboard")}
              variant="outline"
              className="gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/80"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Main Content with Sidebar */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* Sidebar Navigation */}
        <Card className="h-fit sticky top-4 border-slate-200/60 shadow-sm bg-white/80 backdrop-blur-sm rounded-2xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-slate-800">Trade Center Menu</CardTitle>
            <CardDescription className="text-slate-600">Select a module</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <Button
                  key={item.id}
                  variant={isActive ? "default" : "ghost"}
                  className={`w-full justify-start gap-2 h-12 rounded-xl ${
                    isActive
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-700"
                  }`}
                  onClick={() => setActiveMenu(item.id)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="space-y-6">
          {activeMenu === "overview" && (
            <InstructorTradeCenterOverview key={`overview-${refreshKey}`} />
          )}
          {activeMenu === "config" && (
            <InstructorTradeCenterConfig key={`config-${refreshKey}`} />
          )}
          {activeMenu === "analytics" && (
            <InstructorTradeCenterAnalytics key={`analytics-${refreshKey}`} />
          )}
          {activeMenu === "donations" && (
            <InstructorTradeCenterDonations key={`donations-${refreshKey}`} />
          )}
          {activeMenu === "trade-log" && (
            <InstructorTradeCenterTradeLog key={`trade-log-${refreshKey}`} instructorId={instructorId ?? undefined} />
          )}
          {activeMenu === "rollover-trades" && (
            <InstructorTradeCenterRolloverTrades key={`rollover-${refreshKey}`} />
          )}
          {activeMenu === "activity-settings" && (
            <InstructorTradeCenterActivitySettings key={`activity-${refreshKey}`} />
          )}
        </div>
      </div>
    </>
  );
}



