"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Save, RefreshCw, Plus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { getProjectModuleSessionCodes, PROJECT_MODULE_SESSIONS } from "@/lib/project-module-sessions";
import type { DayScheduleEntry } from "@/lib/presentation-window-time";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes";
import { getInstructorScopeHeaders } from "@/lib/instructor-client-scope-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";

function formatDayScheduleWindows(
  entry: DayScheduleEntry | undefined,
  fallbackStart: string,
  fallbackEnd: string,
  formatTime: (t: string) => string
): string {
  if (!entry) {
    return `${formatTime(fallbackStart)}–${formatTime(fallbackEnd)}`;
  }
  const windows = Array.isArray(entry) ? entry : [entry];
  return windows.map((w) => `${formatTime(w.start_time)}–${formatTime(w.end_time)}`).join(", ");
}

interface PresentationConfig {
  id: number;
  session: string;
  presentation_start_date: string;
  presentation_end_date: string;
  lecture_days: string[];
  start_time: string;
  end_time: string;
  slot_duration: number;
  location: string;
  is_active: boolean;
  schedule_by_day?: Record<string, DayScheduleEntry> | null;
}

export function InstructorPresentationConfig({ embedInDashboard }: { embedInDashboard?: boolean } = {}) {
  const chrome = facultyEmbedChrome("projects");
  const fp = chrome.p;
  const cardBase = chrome.card;
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const [configs, setConfigs] = useState<PresentationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [dayFilter, setDayFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Form state for editing
  const [formData, setFormData] = useState({
    session: "",
    presentationStartDate: "",
    presentationEndDate: "",
    lectureDays: [] as string[],
    startTime: "",
    endTime: "",
    slotDuration: 20,
    location: "New Electrical Engineering Bldg 119",
  });

  const allSessions = getProjectModuleSessionCodes();
  const allDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  useEffect(() => {
    fetchConfigs();
  }, [courseScopeVersion]);

  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/projects/presentation-config", {
        headers: getInstructorScopeHeaders(),
      });
      const data = await response.json();
      
      if (response.ok) {
        setConfigs(data.configs || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch configurations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching configs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch configurations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config: PresentationConfig) => {
    setEditingSession(config.session);
    setFormData({
      session: config.session,
      presentationStartDate: config.presentation_start_date,
      presentationEndDate: config.presentation_end_date,
      lectureDays: config.lecture_days,
      startTime: config.start_time.substring(0, 5), // HH:MM
      endTime: config.end_time.substring(0, 5), // HH:MM
      slotDuration: config.slot_duration,
      location: config.location,
    });
  };

  const handleNewConfig = () => {
    const unusedSessions = allSessions.filter(
      (s) => !configs.some((c) => c.session === s)
    );
    
    if (unusedSessions.length === 0) {
      toast({
        title: "All Sessions Configured",
        description: "All available sessions already have configurations",
      });
      return;
    }

    setEditingSession("new");
    setFormData({
      session: unusedSessions[0],
      presentationStartDate: "2026-04-20",
      presentationEndDate: "2026-04-29",
      lectureDays: [],
      startTime: "12:00",
      endTime: "13:00",
      slotDuration: 20,
      location: "New Electrical Engineering Bldg 119",
    });
  };

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      lectureDays: prev.lectureDays.includes(day)
        ? prev.lectureDays.filter((d) => d !== day)
        : [...prev.lectureDays, day],
    }));
  };

  const calculateSlotsCount = () => {
    if (!formData.startTime || !formData.endTime) return 0;
    
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const totalMinutes = endMinutes - startMinutes;
    
    return Math.floor(totalMinutes / formData.slotDuration);
  };

  const handleFixDates = async () => {
    try {
      setSaving(true);
      const response = await fetch("/api/admin/fix-presentation-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "✅ Dates Fixed",
          description: `Updated ${data.updated.length} session configurations with correct dates (Nov 17-25, 2025)`,
        });
        fetchConfigs();
      } else {
        const error = await response.json();
        toast({
          title: "Fix Failed",
          description: error.error || "Failed to fix dates",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while fixing dates",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.session || formData.lectureDays.length === 0 || !formData.startTime || !formData.endTime) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const instructorSession = localStorage.getItem("instructorSession");
      const instructorId = instructorSession ? JSON.parse(instructorSession).databaseId : null;

      const response = await fetch("/api/projects/presentation-config", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getInstructorScopeHeaders() },
        body: JSON.stringify({
          session: formData.session,
          presentationStartDate: formData.presentationStartDate,
          presentationEndDate: formData.presentationEndDate,
          lectureDays: formData.lectureDays,
          startTime: `${formData.startTime}:00`,
          endTime: `${formData.endTime}:00`,
          slotDuration: formData.slotDuration,
          location: formData.location,
          createdBy: instructorId,
        }),
      });

      if (response.ok) {
        toast({
          title: "✅ Configuration Saved",
          description: `Presentation schedule updated for ${formData.session}`,
        });
        setEditingSession(null);
        fetchConfigs();
      } else {
        const error = await response.json();
        toast({
          title: "Save Failed",
          description: error.error || "Failed to save configuration",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while saving",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const filteredConfigs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return configs.filter((config) => {
      if (sessionFilter !== "all" && config.session !== sessionFilter) return false;
      if (dayFilter !== "all" && !config.lecture_days.includes(dayFilter)) return false;
      if (!query) return true;
      const label =
        PROJECT_MODULE_SESSIONS.find((x) => x.code === config.session)?.label ?? config.session;
      const haystack = [label, config.session, config.location, config.lecture_days.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [configs, searchQuery, sessionFilter, dayFilter]);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  const emptyPanelClass = embedInDashboard
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center border-dashed px-4 py-10 text-center")
    : cn(cardBase, "p-10 text-center", viewMode === "grid" && "md:col-span-2");
  const loadingPanelClass = embedInDashboard
    ? cn(cardBase, "flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10")
    : cn(cardBase, "flex items-center justify-center py-16");

  return (
    <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
      <FacultyIntegratedToolbar
        moduleId="projects"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search sessions or locations…"
        filters={
          <>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(sessionFilter !== "all"),
                  "h-9 w-[148px] shadow-none",
                )}
              >
                <SelectValue placeholder="Session" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                {PROJECT_MODULE_SESSIONS.map(({ code, label }) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dayFilter} onValueChange={setDayFilter}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(dayFilter !== "all"),
                  "h-9 w-[140px] shadow-none",
                )}
              >
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All days</SelectItem>
                {allDays.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredConfigs.length} of {configs.length} session{configs.length === 1 ? "" : "s"} configured
          </p>
        }
        trailing={
          <>
            <Button
              onClick={handleFixDates}
              variant="ghost"
              size="sm"
              className={cn("h-9 rounded-lg", chrome.outline)}
              disabled={saving}
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", saving && "animate-spin")} />
              Fix dates
            </Button>
            <Button onClick={handleNewConfig} size="sm" className={cn("h-9 rounded-lg", chrome.cta)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add session
            </Button>
          </>
        }
      />

      {loading ? (
        <div className={loadingPanelClass}>
          <div className={cn("h-8 w-8 animate-spin rounded-full border-2 border-t-transparent", facultyModuleSpinnerClass("projects"))} />
        </div>
      ) : (
      <div
        className={cn(
          embedInDashboard && filteredConfigs.length === 0 && !editingSession
            ? "flex min-h-0 flex-1 flex-col"
            : undefined,
          viewMode === "grid" ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "space-y-3",
        )}
      >
        {filteredConfigs.map((config) => (
          <div key={config.session} className={cn(cardBase, "p-4 sm:p-5")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h4 className={cn("font-semibold flex items-center gap-2", PORTAL_TEXT)}>
                  <Calendar className={cn("h-4 w-4", fp.iconText)} />
                  {PROJECT_MODULE_SESSIONS.find((x) => x.code === config.session)?.label ??
                    `Session ${config.session}`}
                </h4>
                <p className={cn("text-xs mt-1", PORTAL_TEXT_MUTED)}>
                  {config.lecture_days.join(", ")} ·{" "}
                  {config.schedule_by_day &&
                  typeof config.schedule_by_day === "object" &&
                  Object.keys(config.schedule_by_day).length > 0 ? (
                    <span className="block mt-0.5">
                      Per-day:{" "}
                      {config.lecture_days
                        .map((d) => {
                          const entry = config.schedule_by_day?.[d];
                          return `${d} ${formatDayScheduleWindows(
                            entry,
                            config.start_time,
                            config.end_time,
                            formatTime,
                          )}`;
                        })
                        .join(" · ")}
                    </span>
                  ) : (
                    <>
                      {formatTime(config.start_time)} – {formatTime(config.end_time)}
                    </>
                  )}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleEdit(config)} className={cn("h-9 rounded-lg shrink-0", chrome.outline)}>
                Edit
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {([
                {
                  label: "Dates",
                  value: formatDateRange(config.presentation_start_date, config.presentation_end_date),
                },
                { label: "Location", value: config.location, clamp: true },
                { label: "Slot duration", value: `${config.slot_duration} min` },
                {
                  label: "Slots / day",
                  value:
                    config.schedule_by_day &&
                    typeof config.schedule_by_day === "object" &&
                    Object.keys(config.schedule_by_day).length > 0
                      ? "Varies by day"
                      : `${Math.floor(
                          (parseInt(config.end_time.split(":")[0]) * 60 +
                            parseInt(config.end_time.split(":")[1]) -
                            parseInt(config.start_time.split(":")[0]) * 60 -
                            parseInt(config.start_time.split(":")[1])) /
                            config.slot_duration,
                        )} slots`,
                },
              ] as const).map((tile, index) => {
                const stripe = portalListStripe(index, chrome.theme.family)
                return (
                  <div key={tile.label} className={cn("rounded-lg border p-3", stripe.row, stripe.border)}>
                    <p className={cn("text-[11px] font-medium uppercase tracking-wide", PORTAL_TEXT_MUTED)}>
                      {tile.label}
                    </p>
                    <p className={cn("mt-0.5 font-medium", PORTAL_TEXT, "clamp" in tile && tile.clamp && "line-clamp-2")}>
                      {tile.value}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {filteredConfigs.length === 0 && !editingSession ? (
          <div className={emptyPanelClass}>
            <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
              <Calendar className="h-5 w-5 !text-white" />
            </div>
            <p className={cn("font-medium", PORTAL_TEXT)}>
              {configs.length === 0 ? "No presentation schedules yet" : "No matching sessions"}
            </p>
            <p className={cn("text-sm mt-1", PORTAL_TEXT_MUTED)}>
              {configs.length === 0
                ? "Add a session to set dates, times, and location."
                : "Try a different search or clear the session and day filters."}
            </p>
          </div>
        ) : null}
      </div>
      )}

      {editingSession && (
        <div className={cn(cardBase, "p-4 sm:p-5 space-y-5 ring-1 ring-[var(--cc-accent)]/25")}>
          <div>
            <h4 className={cn("font-semibold", PORTAL_TEXT)}>
              {editingSession === "new" ? "New configuration" : `Edit ${editingSession}`}
            </h4>
            <p className={cn("text-xs mt-0.5", PORTAL_TEXT_MUTED)}>When and where presentations will take place</p>
          </div>
          <div className="space-y-5">
            {editingSession === "new" && (
              <div className="space-y-2">
                <Label>Session</Label>
                <Select
                  value={formData.session}
                  onValueChange={(value) => setFormData({ ...formData, session: value })}
                >
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="Select session" />
                  </SelectTrigger>
                  <SelectContent>
                    {allSessions
                      .filter((s) => !configs.some((c) => c.session === s))
                      .map((session) => (
                        <SelectItem key={session} value={session}>
                          {PROJECT_MODULE_SESSIONS.find((x) => x.code === session)?.label ?? session}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={formData.presentationStartDate}
                  onChange={(e) =>
                    setFormData({ ...formData, presentationStartDate: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={formData.presentationEndDate}
                  onChange={(e) =>
                    setFormData({ ...formData, presentationEndDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Lecture days</Label>
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                {allDays.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all",
                      formData.lectureDays.includes(day)
                        ? cn("border-[var(--cc-accent-border)]", fp.softBg)
                        : "border-[var(--border)] hover:bg-[var(--cc-accent-soft)]/45",
                    )}
                    onClick={() => handleDayToggle(day)}
                  >
                    <Checkbox
                      checked={formData.lectureDays.includes(day)}
                      onCheckedChange={() => handleDayToggle(day)}
                    />
                    <label className="text-sm font-medium cursor-pointer">{day.substring(0, 3)}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>

            {/* Slot Duration & Location */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot Duration (minutes)</Label>
                <Input
                  type="number"
                  min="10"
                  max="60"
                  step="5"
                  value={formData.slotDuration}
                  onChange={(e) =>
                    setFormData({ ...formData, slotDuration: parseInt(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Room number or building"
                />
              </div>
            </div>

            <Alert className={cn("rounded-xl border", fp.softBg, "border-[var(--cc-accent-border)]/40")}>
              <Calendar className={cn("h-4 w-4", fp.iconText)} />
              <AlertDescription>
                <p className={cn("font-semibold mb-2", PORTAL_TEXT)}>Preview</p>
                <div className={cn("text-sm space-y-1", PORTAL_TEXT_MUTED)}>
                  <p>Session: <strong className={PORTAL_TEXT}>{formData.session}</strong></p>
                  <p>Days: <strong className={PORTAL_TEXT}>{formData.lectureDays.join(", ") || "None selected"}</strong></p>
                  <p>Time: <strong className={PORTAL_TEXT}>{formData.startTime} – {formData.endTime}</strong></p>
                  <p>Slots per day: <strong className={PORTAL_TEXT}>{calculateSlotsCount()}</strong> ({formData.slotDuration} min each)</p>
                  <p>Location: <strong className={PORTAL_TEXT}>{formData.location}</strong></p>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className={cn("rounded-lg", chrome.cta)}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving…" : "Save configuration"}
              </Button>
              <Button variant="ghost" onClick={() => setEditingSession(null)} className={cn("rounded-lg", chrome.outline)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

