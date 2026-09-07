"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, CheckCircle, Info, Sparkles, Presentation, X, AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion, AnimatePresence } from "framer-motion";
import { 
  SESSION_SCHEDULES, 
  getAvailableDatesForSession, 
  generateSessionTimeSlots,
  formatTimeDisplay,
} from "@/lib/presentation-schedule-config";
import {
  addCalendarDaysYmd,
  centralNoonOnYmd,
  coerceLectureDays,
  formatLocalDateYmd,
  resolvePresentationTimeWindowsForDate,
  toYmdFromDb,
  weekdayNameFromYmd,
} from "@/lib/presentation-window-time";
import { CENTRAL_TIMEZONE } from "@/lib/timezone";

interface ProjectPresentationSchedulerProps {
  projectId: number;
  groupId: number;
  projectTitle: string;
  groupName: string;
  studentSession: string;
  onScheduled?: () => void;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  projectTitle?: string;
  groupName?: string;
}

type SequentialMap = Record<
  string,
  {
    unlocked: boolean;
    slotsBooked: number;
    slotsTotal: number;
    isFull: boolean;
    expiredWithoutFullBooking?: boolean;
  }
>;

/**
 * - inactive: no DB presentation config (404 only) — server does not enforce order; all days open in UI.
 * - pending: loading / error / empty payload — fail closed: only the first ordered day open (never unlock all).
 * - active: server day map — exactly one “wave” of days unlocked at a time (next opens when prior day is full).
 */
type SequentialGuard =
  | { status: "inactive" }
  | { status: "pending" }
  | { status: "active"; byDate: SequentialMap };

function isSequentialLockedForYmd(ymd: string, guard: SequentialGuard, firstPresentationYmd: string | null): boolean {
  if (guard.status === "inactive") {
    return false;
  }
  if (guard.status === "pending") {
    if (!firstPresentationYmd) return true;
    return ymd !== firstPresentationYmd;
  }
  const seq = guard.byDate[ymd];
  if (seq) return !seq.unlocked;
  if (!firstPresentationYmd) return true;
  if (ymd === firstPresentationYmd) return false;
  return true;
}

export function ProjectPresentationScheduler({
  projectId,
  groupId,
  projectTitle,
  groupName,
  studentSession,
  onScheduled,
}: ProjectPresentationSchedulerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [existingPresentation, setExistingPresentation] = useState<any>(null);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<any>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [sequentialGuard, setSequentialGuard] = useState<SequentialGuard>({ status: "pending" });
  /** First calendar day in server `orderedDates` (Apr 20 before Apr 22, etc.) — authoritative for pending/fallback. */
  const [sequentialFirstYmdFromApi, setSequentialFirstYmdFromApi] = useState<string | null>(null);
  const [sequentialRefreshKey, setSequentialRefreshKey] = useState(0);

  const sessionSchedule = SESSION_SCHEDULES[studentSession];

  /** First unlockable day: prefer API `orderedDates[0]`, else earliest client calendar date. */
  const effectiveFirstPresentationYmd = useMemo(() => {
    if (sequentialFirstYmdFromApi && /^\d{4}-\d{2}-\d{2}$/.test(sequentialFirstYmdFromApi)) {
      return sequentialFirstYmdFromApi;
    }
    if (availableDates.length === 0) return null;
    return formatLocalDateYmd(availableDates[0]);
  }, [sequentialFirstYmdFromApi, availableDates]);

  useEffect(() => {
    fetchSessionConfig();
    checkExistingPresentation();
  }, [projectId, studentSession]);

  useEffect(() => {
    let cancelled = false;
    setSequentialFirstYmdFromApi(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/projects/presentations/sequential-status?session=${encodeURIComponent(studentSession)}`
        );
        const data = await res.json();
        if (cancelled) return;

        if (res.status === 404) {
          setSequentialGuard({ status: "inactive" });
          return;
        }

        if (!res.ok || !Array.isArray(data.days)) {
          setSequentialGuard({ status: "pending" });
          return;
        }

        const orderedRaw = Array.isArray(data.orderedDates) ? data.orderedDates : [];
        const orderedDates = orderedRaw
          .map((x: unknown) => String(x ?? "").slice(0, 10))
          .filter((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s));
        const firstFromOrdered = orderedDates[0] ?? null;
        const firstUnlockedFromDays = (() => {
          const u = data.days.find((d: { unlocked?: boolean }) => d.unlocked);
          if (u && typeof u.date === "string") {
            const s = u.date.slice(0, 10);
            return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
          }
          return null;
        })();
        const firstFromDaysLegacy =
          data.days[0] && typeof data.days[0].date === "string"
            ? data.days[0].date.slice(0, 10)
            : null;
        const apiFirst =
          firstUnlockedFromDays ??
          firstFromOrdered ??
          (firstFromDaysLegacy && /^\d{4}-\d{2}-\d{2}$/.test(firstFromDaysLegacy)
            ? firstFromDaysLegacy
            : null);
        if (!cancelled && apiFirst) setSequentialFirstYmdFromApi(apiFirst);

        if (data.days.length === 0) {
          setSequentialGuard({ status: "pending" });
          return;
        }

        const byDate: SequentialMap = {};
        for (const d of data.days) {
          const key = typeof d.date === "string" ? d.date.slice(0, 10) : "";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
          byDate[key] = {
            unlocked: !!d.unlocked,
            slotsBooked: Number(d.slotsBooked) || 0,
            slotsTotal: Number(d.slotsTotal) || 0,
            isFull: !!d.isFull,
            expiredWithoutFullBooking: !!d.expiredWithoutFullBooking,
          };
        }

        if (Object.keys(byDate).length === 0) {
          setSequentialGuard({ status: "pending" });
          return;
        }

        setSequentialGuard({ status: "active", byDate });
      } catch {
        if (!cancelled) setSequentialGuard({ status: "pending" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studentSession, sequentialRefreshKey]);

  const fetchSessionConfig = async () => {
    try {
      const response = await fetch(`/api/projects/presentation-config?session=${studentSession}`);
      const data = await response.json();
      
      if (response.ok && data.config) {
        setSessionConfig(data.config);
        
        const dates: Date[] = [];
        let ymd = toYmdFromDb(data.config.presentation_start_date);
        const endYmd = toYmdFromDb(data.config.presentation_end_date);

        if (!ymd || !endYmd) {
          console.warn("[DATE DEBUG] Invalid presentation date range from API, using fallback");
          setAvailableDates(getAvailableDatesForSession(studentSession));
          return;
        }

        const dayMap: Record<string, number> = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };

        const validDays = coerceLectureDays(data.config.lecture_days)
          .map((day) => dayMap[day])
          .filter((n) => typeof n === "number");

        while (ymd <= endYmd) {
          if (ymd.endsWith("-11-26")) {
            ymd = addCalendarDaysYmd(ymd, 1);
            continue;
          }

          const dayName = weekdayNameFromYmd(ymd);
          const dayNum = dayName ? dayMap[dayName] : undefined;
          if (typeof dayNum === "number" && validDays.includes(dayNum)) {
            dates.push(centralNoonOnYmd(ymd));
          }
          ymd = addCalendarDaysYmd(ymd, 1);
        }
        
        // Filter out invalid dates and sort
        const validDates = dates.filter(d => !isNaN(d.getTime())).sort((a, b) => a.getTime() - b.getTime());
        console.log('[DATE DEBUG] Generated dates for', studentSession, ':', validDates.map(d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
        console.log('[DATE DEBUG] Number of dates generated:', validDates.length);
        
        // Safety check: if no dates generated, use fallback
        if (validDates.length === 0) {
          console.log('[DATE DEBUG] No dates generated from config, using fallback');
          const fallbackDates = getAvailableDatesForSession(studentSession);
          console.log('[DATE DEBUG] Fallback dates:', fallbackDates.map(d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
          setAvailableDates(fallbackDates);
        } else {
          setAvailableDates(validDates);
        }
      } else {
        // Fallback to hardcoded config - include ALL dates for record keeping
        console.log('[DATE DEBUG] No config from API, using fallback for', studentSession);
        const fallbackDates = getAvailableDatesForSession(studentSession);
        console.log('[DATE DEBUG] Fallback dates:', fallbackDates.map(d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
        console.log('[DATE DEBUG] Number of fallback dates:', fallbackDates.length);
        setAvailableDates(fallbackDates);
      }
    } catch (error) {
      console.error("Error fetching session config:", error);
      // Fallback to hardcoded config - include ALL dates for record keeping
      console.log('[DATE DEBUG] Error occurred, using fallback for', studentSession);
      const fallbackDates = getAvailableDatesForSession(studentSession);
      console.log('[DATE DEBUG] Fallback dates:', fallbackDates.map(d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })));
      console.log('[DATE DEBUG] Number of fallback dates:', fallbackDates.length);
      setAvailableDates(fallbackDates);
    }
  };

  const checkExistingPresentation = async () => {
    try {
      console.log("📋 Checking existing presentation for:", { projectId, session: studentSession });
      // IMPORTANT: Filter by BOTH projectId AND session to avoid cross-session conflicts
      const response = await fetch(`/api/projects/presentations?projectId=${projectId}&session=${studentSession}`);
      const data = await response.json();
      
      console.log("✅ Presentations found:", {
        count: data.presentations?.length,
        presentations: data.presentations?.map((p: any) => ({
          id: p.id,
          session: p.session,
          status: p.status,
          projectId: p.project_id,
        })),
      });
      
      if (data.presentations && data.presentations.length > 0) {
        // Find the first non-cancelled presentation for THIS SESSION
        const active = data.presentations.find((p: any) => p.status !== 'cancelled');
        console.log("🎯 Setting existing presentation:", active || "none found");
        setExistingPresentation(active || null);
      } else {
        console.log("📭 No presentations found for this session");
        setExistingPresentation(null);
      }
    } catch (error) {
      console.error("Error checking existing presentation:", error);
    }
  };

  // Helper function to calculate end time from start time and duration
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
  };

  const fetchAvailableSlots = async (date: Date) => {
    try {
      setCheckingSlots(true);
      const dateStr = formatLocalDateYmd(date);
      if (!dateStr) {
        setAvailableSlots([]);
        setCheckingSlots(false);
        return;
      }

      const slotDur =
        sessionConfig?.slot_duration != null ? Number(sessionConfig.slot_duration) : 20;
      const windowsFromConfig = sessionConfig
        ? resolvePresentationTimeWindowsForDate(sessionConfig, dateStr)
        : [];

      if (sessionConfig && windowsFromConfig.length === 0) {
        setAvailableSlots([]);
        setCheckingSlots(false);
        return;
      }

      // Defaults for legacy sessions without DB config; server recomputes windows when config exists
      const firstWindow = windowsFromConfig[0];
      const config =
        sessionConfig && firstWindow
          ? {
              start_time: firstWindow.start_time,
              end_time: firstWindow.end_time,
              slot_duration: slotDur,
            }
          : {
              start_time: sessionSchedule?.startHour
                ? `${sessionSchedule.startHour.toString().padStart(2, "0")}:${sessionSchedule.startMinute.toString().padStart(2, "0")}:00`
                : "09:00:00",
              end_time: sessionSchedule?.endHour
                ? `${sessionSchedule.endHour.toString().padStart(2, "0")}:${sessionSchedule.endMinute.toString().padStart(2, "0")}:00`
                : "10:20:00",
              slot_duration: 20,
            };
      const response = await fetch(
        `/api/projects/presentations/available-slots?date=${dateStr}&startTime=${config.start_time}&endTime=${config.end_time}&slotDuration=${config.slot_duration}&session=${studentSession}`
      );
      const data = await response.json();
      
      if (response.ok) {
        if (data.sequentialLock && data.message) {
          setAvailableSlots([]);
          toast({
            title: "Earlier days not full yet",
            description: data.message,
            variant: "destructive",
          });
          return;
        }

        const slots = data.slots || [];

        if (slots.length === 0 && !sessionConfig) {
          const fallbackSlots = generateSessionTimeSlots(studentSession).map((time) => ({
            startTime: time,
            endTime: calculateEndTime(time, 20),
            available: true,
          }));
          setAvailableSlots(fallbackSlots);
        } else {
          setAvailableSlots(slots);
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch available time slots",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching slots:", error);
      toast({
        title: "Error",
        description: "Failed to fetch available time slots",
        variant: "destructive",
      });
    } finally {
      setCheckingSlots(false);
    }
  };

  const handleDateSelect = (date: Date) => {
    const ymd = formatLocalDateYmd(date);
    const todayYmd = formatLocalDateYmd(new Date());
    if (ymd < todayYmd) {
      toast({
        title: "Date has passed",
        description: "Choose today or a future presentation day (US Central).",
        variant: "destructive",
      });
      return;
    }
    if (isSequentialLockedForYmd(ymd, sequentialGuard, effectiveFirstPresentationYmd)) {
      toast({
        title: "This date is locked",
        description:
          "Book the current open day first, or wait until an earlier day is full or that calendar day has ended.",
        variant: "destructive",
      });
      return;
    }
    setSelectedDate(date);
    setSelectedTime("");
    fetchAvailableSlots(date);
  };

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime) {
      toast({
        title: "Missing Information",
        description: "Please select a date and time slot",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const selectedSlot = availableSlots.find((slot) => slot.startTime === selectedTime);
      if (!selectedSlot) {
        throw new Error("Selected slot not found");
      }

      const studentSessionRaw = localStorage.getItem("studentSession");
      const studentSessionData = studentSessionRaw ? JSON.parse(studentSessionRaw) : null;
      const studentId = studentSessionData?.databaseId ?? null;

      const dateStr = formatLocalDateYmd(selectedDate);

      const response = await fetch("/api/projects/presentations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          groupId,
          scheduledDate: dateStr,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          location: sessionConfig?.location || sessionSchedule?.location || "New Electrical Engineering Bldg 119",
          notes,
          createdBy: studentId,
          session: studentSession, // Include session to prevent cross-session overwrites
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "✅ Presentation Scheduled!",
          description: `${formatTimeDisplay(selectedSlot.startTime)} on ${selectedDate.toLocaleDateString("en-US", { timeZone: CENTRAL_TIMEZONE, month: "short", day: "numeric", year: "numeric" })}`,
        });
        setExistingPresentation(data.presentation);
        setSequentialRefreshKey((k) => k + 1);
        if (onScheduled) onScheduled();
      } else {
        toast({
          title: "Scheduling Failed",
          description: data.error || "Failed to schedule presentation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error scheduling presentation:", error);
      toast({
        title: "Error",
        description: "An error occurred while scheduling",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!existingPresentation) return;

    try {
      setLoading(true);
      const studentSessionRaw = localStorage.getItem("studentSession");
      const studentSessionData = studentSessionRaw ? JSON.parse(studentSessionRaw) : null;
      const studentId = studentSessionData?.databaseId ?? null;
      const studentSection = studentSessionData?.section ?? null;

      console.log("\n╔════════════════════════════════════════════════╗");
      console.log("║ [CANCEL PRESENTATION] START                    ║");
      console.log("╚════════════════════════════════════════════════╝");
      console.log("📋 Component State BEFORE Cancel:");
      console.log("   projectId:", projectId);
      console.log("   studentSession:", studentSession);
      console.log("   existingPresentation:", {
        id: existingPresentation.id,
        project_id: existingPresentation.project_id,
        session: existingPresentation.session,
        status: existingPresentation.status,
        project_title: existingPresentation.project_title,
      });
      
      console.log("\n👤 Student Info:");
      console.log("   studentId:", studentId);
      console.log("   studentSection:", studentSection);

      console.log("\n📤 Sending DELETE request:");
      console.log("   URL: /api/projects/presentations?presentationId=" + existingPresentation.id);
      console.log("   Headers:", {
        "x-student-id": studentId,
        "x-student-section": studentSection,
      });

      const response = await fetch(
        `/api/projects/presentations?presentationId=${existingPresentation.id}`,
        {
          method: "DELETE",
          headers: {
            ...(studentId ? { "x-student-id": String(studentId) } : {}),
            ...(studentSection ? { "x-student-section": studentSection } : {}),
          },
        }
      );

      console.log("\n📥 Response Received:");
      console.log("   Status:", response.status);
      console.log("   OK:", response.ok);

      const data = await response.json();
      console.log("   Data:", data);

      if (response.ok) {
        console.log("\n✅ [CANCEL] SUCCESS - Presentation cancelled");
        console.log("   Deleted presentation ID:", data.presentation?.id);
        console.log("   Deleted session:", data.presentation?.session);
        console.log("   Delete type:", data.deleteType);
        
        toast({
          title: "Presentation Cancelled",
          description: "Your presentation schedule has been cancelled",
        });
        
        console.log("\n🔄 Clearing component state:");
        setExistingPresentation(null);
        setSelectedDate(null);
        setSelectedTime("");
        setNotes("");
        
        setSequentialRefreshKey((k) => k + 1);
        if (onScheduled) onScheduled();
        
        console.log("╔════════════════════════════════════════════════╗");
        console.log("║ [CANCEL PRESENTATION] SUCCESS ✅               ║");
        console.log("╚════════════════════════════════════════════════╝\n");
      } else {
        console.error("\n❌ [CANCEL] FAILED - Response not ok");
        console.error("   Status:", response.status);
        console.error("   Error message:", data?.error);
        console.log("╔════════════════════════════════════════════════╗");
        console.log("║ [CANCEL PRESENTATION] FAILED ❌                ║");
        console.log("╚════════════════════════════════════════════════╝\n");
        throw new Error(data?.error || "Failed to cancel");
      }
    } catch (error) {
      console.error("\n❌ [CANCEL] EXCEPTION:", error);
      console.log("╔════════════════════════════════════════════════╗");
      console.log("║ [CANCEL PRESENTATION] ERROR ❌                 ║");
      console.log("╚════════════════════════════════════════════════╝\n");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel presentation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If presentation already exists, show confirmation card
  // (Allow rescheduling from cancelled status)
  if (existingPresentation && existingPresentation.status !== "cancelled") {
    const ymd = toYmdFromDb(existingPresentation.scheduled_date);
    const presentationDate = ymd.length === 10 ? centralNoonOnYmd(ymd) : new Date(NaN);

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-2 border-green-200 dark:border-green-800 bg-emerald-50 dark:bg-emerald-950 shadow-lg shadow-green-200/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-green-500 shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-green-900 dark:text-green-100">
                    Presentation Confirmed!
                  </CardTitle>
                  <CardDescription className="text-green-700 dark:text-green-300">
                    Your slot has been reserved
                  </CardDescription>
                </div>
              </div>
              <Badge className="bg-green-600 text-white">Scheduled</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white/80 dark:bg-slate-900/50 rounded-xl p-4 border border-green-200">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">
                      Date
                    </p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                      {Number.isNaN(presentationDate.getTime())
                        ? ymd || "—"
                        : presentationDate.toLocaleDateString("en-US", {
                            timeZone: CENTRAL_TIMEZONE,
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/50 rounded-xl p-4 border border-green-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">
                      Time
                    </p>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-1">
                      {formatTimeDisplay(existingPresentation.start_time)} -{" "}
                      {formatTimeDisplay(existingPresentation.end_time)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      20 minutes total • US Central (Chicago)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {existingPresentation.location && (
              <div className="bg-white/80 dark:bg-slate-900/50 rounded-xl p-4 border border-green-200">
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800 dark:text-green-300 uppercase tracking-wide">
                      Location
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                      {existingPresentation.location}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                <strong>Format:</strong> 15 minutes presentation + 5 minutes Q&A. Please arrive 5 minutes early to set up.
              </AlertDescription>
            </Alert>

            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="w-full border-red-200 text-red-600 hover:bg-red-50"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Presentation
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950 shadow-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-indigo-500 shadow-lg shadow-indigo-500/30">
              <Presentation className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl text-indigo-800 dark:text-indigo-100">
                Schedule Your Presentation
              </CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400">
                Reserve a 20-minute slot during lecture time (US Central: Chicago, CST/CDT)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Session Info Banner */}
          {(sessionConfig || sessionSchedule) && (
            <Alert className="bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <AlertDescription>
                <div className="space-y-1">
                  {sequentialGuard.status !== "inactive" && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 font-medium border border-amber-200/60 dark:border-amber-800/40 rounded-md px-2 py-1.5 bg-amber-50/80 dark:bg-amber-950/40">
                      Booking order: each day opens in sequence. The next day unlocks when the previous day is fully booked
                      or when that calendar day ends (US Central), whichever comes first. Past dates cannot be selected.
                    </p>
                  )}
                  <p className="font-semibold text-indigo-900 dark:text-indigo-100">
                    {studentSession} - {sessionConfig ? `${formatTimeDisplay(sessionConfig.start_time)} – ${formatTimeDisplay(sessionConfig.end_time)}` : sessionSchedule.lectureTime}
                  </p>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    {sessionConfig
                      ? coerceLectureDays(sessionConfig.lecture_days).join(", ")
                      : sessionSchedule.days.join(", ")}{" "}
                    • {sessionConfig?.location || sessionSchedule.location}
                  </p>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2">
                    {sessionConfig
                      ? (() => {
                          const startYmd = toYmdFromDb(sessionConfig.presentation_start_date);
                          const endYmd = toYmdFromDb(sessionConfig.presentation_end_date);
                          const startDate = centralNoonOnYmd(startYmd);
                          const endDate = centralNoonOnYmd(endYmd);
                          if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
                            return `Presentation Week: ${startYmd} – ${endYmd}`;
                          }
                          return `Presentation Week: ${startDate.toLocaleDateString("en-US", {
                            timeZone: CENTRAL_TIMEZONE,
                            month: "short",
                            day: "numeric",
                          })} - ${endDate.toLocaleDateString("en-US", {
                            timeZone: CENTRAL_TIMEZONE,
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}`;
                        })()
                      : "Presentation week dates follow your course schedule."}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Date Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                Step 1: Select Date
              </h3>
            </div>
            {availableDates.length === 0 ? (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900 dark:text-amber-100">
                  <p className="font-semibold mb-1">No Available Dates</p>
                  <p className="text-sm">
                    No presentation dates are configured for this session. Please contact your instructor.
                  </p>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {availableDates.map((date, index) => {
                  const ymd = formatLocalDateYmd(date);
                  const isSelected =
                    selectedDate != null && formatLocalDateYmd(selectedDate) === ymd;
                  const dayName = date.toLocaleDateString("en-US", {
                    weekday: "short",
                    timeZone: CENTRAL_TIMEZONE,
                  });
                  const monthDay = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: CENTRAL_TIMEZONE,
                  });
                  const lockedSequential = isSequentialLockedForYmd(
                    ymd,
                    sequentialGuard,
                    effectiveFirstPresentationYmd
                  );

                  const todayYmd = formatLocalDateYmd(new Date());
                  const isToday = ymd === todayYmd;
                  const isPast = ymd < todayYmd;
                  const disabled = lockedSequential || isPast;

                  return (
                    <motion.button
                      key={index}
                      type="button"
                      whileHover={disabled ? {} : { scale: 1.05 }}
                      whileTap={disabled ? {} : { scale: 0.95 }}
                      onClick={() => !disabled && handleDateSelect(date)}
                      disabled={disabled}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        disabled
                          ? "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 cursor-not-allowed opacity-70"
                          : isSelected
                          ? "border-indigo-600 bg-indigo-100 dark:bg-indigo-900 shadow-lg"
                          : isPast
                          ? "border-slate-300 bg-slate-100 dark:bg-slate-800/50 hover:border-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50 opacity-75"
                          : "border-slate-200 bg-white dark:bg-slate-800 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      <div className="text-center">
                        <div className={`text-xs font-semibold uppercase tracking-wide ${
                          isSelected ? "text-indigo-700 dark:text-indigo-300" : disabled ? "text-slate-400" : isPast ? "text-slate-400" : "text-slate-500"
                        }`}>
                          {dayName}
                        </div>
                        <div className={`text-lg font-bold mt-1 ${
                          isSelected ? "text-indigo-900 dark:text-indigo-100" : disabled ? "text-slate-500" : isPast ? "text-slate-500" : "text-slate-800 dark:text-slate-200"
                        }`}>
                          {monthDay}
                        </div>
                        {lockedSequential && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1 font-medium flex items-center justify-center gap-0.5">
                            <Lock className="h-3 w-3 shrink-0" />
                            Locked
                          </div>
                        )}
                        {isToday && !lockedSequential && (
                          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 font-medium">
                            Today
                          </div>
                        )}
                        {isPast && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                            Closed
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Time Slot Selection */}
          <AnimatePresence>
            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Step 2: Select Time Slot
                  </h3>
                </div>

                {checkingSlots ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                    <p className="text-sm text-slate-600 mt-2">Loading available slots...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600 mb-2">
                      Showing {availableSlots.length} time slots (20 minutes each, US Central time):
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {availableSlots.map((slot, index) => {
                        const isSelected = selectedTime === slot.startTime;
                        return (
                          <motion.button
                            key={index}
                            whileHover={slot.available ? { scale: 1.05 } : {}}
                            whileTap={slot.available ? { scale: 0.95 } : {}}
                            onClick={() => slot.available && setSelectedTime(slot.startTime)}
                            disabled={!slot.available}
                            className={`p-4 rounded-xl border-2 transition-all ${
                              isSelected
                                ? "border-purple-600 bg-purple-100 dark:bg-purple-900 shadow-lg"
                                : slot.available
                                ? "border-slate-200 bg-white dark:bg-slate-800 hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-slate-700"
                                : "border-slate-200 bg-slate-100 dark:bg-slate-900 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <div className="text-center">
                              <div className={`font-bold text-sm ${
                                isSelected ? "text-purple-900 dark:text-purple-100" : 
                                slot.available ? "text-slate-800 dark:text-slate-200" : 
                                "text-slate-400"
                              }`}>
                                {formatTimeDisplay(slot.startTime)}
                              </div>
                              <div className={`text-xs mt-0.5 ${
                                isSelected ? "text-purple-700 dark:text-purple-300" : 
                                slot.available ? "text-slate-600 dark:text-slate-400" : 
                                "text-slate-400"
                              }`}>
                                - {formatTimeDisplay(slot.endTime)}
                              </div>
                              <div className={`text-xs mt-1 font-medium ${
                                isSelected ? "text-purple-700 dark:text-purple-300" : 
                                slot.available ? "text-slate-500 dark:text-slate-500" : 
                                "text-slate-400"
                              }`}>
                                20 min
                              </div>
                              {!slot.available && (
                                <div className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">
                                  Booked
                                </div>
                              )}
                              {slot.available && (
                                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                                  Available
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {availableSlots.filter((s) => s.available).length === 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          All time slots are booked for this date. Please select another date.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Additional Notes */}
          <AnimatePresence>
            {selectedTime && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-pink-600" />
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Step 3: Add Notes (Optional)
                  </h3>
                </div>
                
                <Textarea
                  placeholder="Any special requirements, equipment needs, or notes for the instructor..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="border-slate-200 focus:border-pink-400"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Presentation Details Info */}
          <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <Info className="h-4 w-4 text-amber-700" />
            <AlertDescription className="text-amber-900 dark:text-amber-100">
              <p className="font-semibold mb-1">Presentation Format (20 minutes):</p>
              <ul className="text-sm space-y-1 ml-4">
                <li>• <strong>15 minutes:</strong> Project demo and presentation</li>
                <li>• <strong>5 minutes:</strong> Questions and answers</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Schedule Button */}
          <Button
            onClick={handleSchedule}
            disabled={loading || !selectedDate || !selectedTime}
            className="w-full h-12 text-base bg-[var(--cc-accent)] hover:opacity-90 shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                Scheduling...
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Confirm Presentation Schedule
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
