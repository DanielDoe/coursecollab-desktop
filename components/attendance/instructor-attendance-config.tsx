"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  convertCentralDateTimeToUtcISO,
  formatCentralDate,
  centralDateISO,
} from "@/lib/timezone";
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { uniqueSessionCodes } from "@/lib/unique-session-codes";
import { FacultyAttendancePanel } from "@/components/attendance/faculty-attendance-ui";
import {
  ATTENDANCE_INPUT,
  PORTAL_CTA,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/attendance/attendance-surface-classes";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { cn } from "@/lib/utils";

const chrome = facultyEmbedChrome("attendance");

interface InstructorAttendanceConfigProps {
  instructorId: string;
}

export function InstructorAttendanceConfig({ instructorId }: InstructorAttendanceConfigProps) {
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const instHeaders = (): Record<string, string> => ({
    ...buildInstructorApiHeaders(),
    Authorization: localStorage.getItem("instructorSession") || "",
    "x-instructor-id": localStorage.getItem("instructorId") || instructorId,
  });

  const [formData, setFormData] = useState({
    classTitle: "",
    section: "",
    startDate: centralDateISO(new Date()), // Default to today's date
    startTime: "",
    endTime: "",
    requireLocation: false,
    locationLat: "",
    locationLong: "",
    radiusMeters: "100",
    qrExpiryMinutes: "30",
  });
  const [submitting, setSubmitting] = useState(false);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  useEffect(() => {
    fetchRecentSessions();
    fetchAvailableSessions();
  }, [instructorId, courseScopeVersion]);

  const fetchAvailableSessions = async () => {
    try {
      setLoadingSessions(true);
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorApiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        const sessions = uniqueSessionCodes(data.sessions || []);
        setAvailableSessions(sessions);
        if (sessions.length > 0 && !sessions.some((s) => s.code === formData.section)) {
          setFormData((prev) => ({ ...prev, section: sessions[0].code }));
        }
      }
    } catch (error) {
    } finally {
      setLoadingSessions(false);
    }
  };

  const fetchRecentSessions = async () => {
    try {
      const response = await fetch(`/api/attendance/sessions?instructorId=${instructorId}`, {
        headers: instHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setRecentSessions(data.sessions.slice(0, 5));
      }
    } catch (error) {
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Convert to UTC using Central Time as the source timezone
      const startIso = convertCentralDateTimeToUtcISO(formData.startDate, formData.startTime);
      const endIso = convertCentralDateTimeToUtcISO(formData.startDate, formData.endTime);

      if (!startIso || !endIso) {
        console.error("[Attendance Config] Invalid time conversion:", {
          startIso,
          endIso,
          startDate: formData.startDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
        });
        throw new Error("Invalid start or end time");
      }

      const requestBody = {
        instructorId,
        section: formData.section,
        classTitle: formData.classTitle,
        startTime: startIso,
        endTime: endIso,
        requireLocation: formData.requireLocation,
        locationLat: formData.locationLat ? parseFloat(formData.locationLat) : null,
        locationLong: formData.locationLong ? parseFloat(formData.locationLong) : null,
        radiusMeters: parseInt(formData.radiusMeters),
        qrExpiryMinutes: parseInt(formData.qrExpiryMinutes),
      };

      console.log("[Attendance Config] Sending request to create session:", {
        url: "/api/attendance/sessions",
        method: "POST",
        body: requestBody,
        instructorId,
        hasAuth: !!localStorage.getItem("instructorSession"),
      });

      const response = await fetch("/api/attendance/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...instHeaders(),
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Attendance Config] Response status:", response.status);
      console.log("[Attendance Config] Response ok:", response.ok);

      if (response.ok) {
        const data = await response.json();
        console.log("[Attendance Config] Session created successfully:", data);
        toast({
          title: "✅ Session Created!",
          description: `QR code generated for ${formData.classTitle}`,
        });

        // Reset form
        const defaultSection = availableSessions.length > 0 ? availableSessions[0].code : "";
        setFormData({
          classTitle: "",
          section: defaultSection,
          startDate: centralDateISO(new Date()), // Reset to today's date
          startTime: "",
          endTime: "",
          requireLocation: false,
          locationLat: "",
          locationLong: "",
          radiusMeters: "100",
          qrExpiryMinutes: "30",
        });

        fetchRecentSessions();
      } else {
        const errorData = await response.json();
        console.error("[Attendance Config] API Error Response:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || errorData.message || "Failed to create session");
      }
    } catch (error: any) {
      console.error("[Attendance Config] Error creating session:", {
        error: error,
        message: error?.message,
        stack: error?.stack,
      });
      toast({
        title: "Error",
        description: error.message || "Failed to create attendance session",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            locationLat: position.coords.latitude.toFixed(6),
            locationLong: position.coords.longitude.toFixed(6),
          });
          toast({
            title: "Location Captured",
            description: "Current location set for verification",
          });
        },
        (error) => {
          toast({
            title: "Location Error",
            description: "Unable to get current location",
            variant: "destructive",
          });
        }
      );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FacultyAttendancePanel title="New session">
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="classTitle">Title</Label>
                    <Input
                      id="classTitle"
                      value={formData.classTitle}
                      onChange={(e) =>
                        setFormData({ ...formData, classTitle: e.target.value })
                      }
                      placeholder="e.g., ELEG 1304 — Lecture 5"
                      required
                      className={ATTENDANCE_INPUT}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="section">Section</Label>
                    <Select
                      value={formData.section}
                      onValueChange={(value) =>
                        setFormData({ ...formData, section: value })
                      }
                      disabled={loadingSessions}
                    >
                      <SelectTrigger className={ATTENDANCE_INPUT}>
                        <SelectValue placeholder={loadingSessions ? "Loading…" : "Section"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSessions.map((session) => (
                          <SelectItem key={session.code} value={session.code}>
                            {session.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                      required
                      className={ATTENDANCE_INPUT}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="startTime">Start</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) =>
                        setFormData({ ...formData, startTime: e.target.value })
                      }
                      required
                      className={ATTENDANCE_INPUT}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endTime">End</Label>
                    <Input
                      id="endTime"
                      type="time"
                      value={formData.endTime}
                      onChange={(e) =>
                        setFormData({ ...formData, endTime: e.target.value })
                      }
                      required
                      className={ATTENDANCE_INPUT}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="requireLocation"
                      checked={formData.requireLocation}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, requireLocation: checked })
                      }
                      className={chrome.switchChecked}
                    />
                    <Label htmlFor="requireLocation" className={cn("cursor-pointer text-sm", PORTAL_TEXT)}>
                      Require location
                    </Label>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    size="sm"
                    disabled={!formData.requireLocation}
                    className={cn(
                      "h-8",
                      chrome.quiet,
                      "disabled:opacity-100 disabled:!text-[var(--cc-text-muted)] disabled:hover:bg-[var(--muted)]",
                    )}
                  >
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                    Use my location
                  </Button>
                </div>

                  {formData.requireLocation && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="locationLat">Latitude</Label>
                          <Input
                            id="locationLat"
                            type="number"
                            step="0.000001"
                            value={formData.locationLat}
                            onChange={(e) =>
                              setFormData({ ...formData, locationLat: e.target.value })
                            }
                            placeholder="40.7128"
                            required={formData.requireLocation}
                            className={ATTENDANCE_INPUT}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="locationLong">Longitude</Label>
                          <Input
                            id="locationLong"
                            type="number"
                            step="0.000001"
                            value={formData.locationLong}
                            onChange={(e) =>
                              setFormData({ ...formData, locationLong: e.target.value })
                            }
                            placeholder="-74.0060"
                            required={formData.requireLocation}
                            className={ATTENDANCE_INPUT}
                          />
                        </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="radiusMeters">Radius (m)</Label>
                        <Input
                          id="radiusMeters"
                          type="number"
                          value={formData.radiusMeters}
                          onChange={(e) =>
                            setFormData({ ...formData, radiusMeters: e.target.value })
                          }
                          required={formData.requireLocation}
                          min="10"
                          className={ATTENDANCE_INPUT}
                        />
                      </div>
                    </div>
                  )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="qrExpiryMinutes">QR expiry (min after end)</Label>
                    <Input
                      id="qrExpiryMinutes"
                      type="number"
                      value={formData.qrExpiryMinutes}
                      onChange={(e) =>
                        setFormData({ ...formData, qrExpiryMinutes: e.target.value })
                      }
                      className={ATTENDANCE_INPUT}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={cn("h-9", PORTAL_CTA)}
                  >
                    {submitting ? "Creating…" : (
                      <>
                        <Plus className="mr-1.5 h-4 w-4" />
                        Create session
                      </>
                    )}
                  </Button>
                </div>
              </form>
          </FacultyAttendancePanel>
        </div>

        <div>
          <FacultyAttendancePanel title="Recent sessions">
              {recentSessions.length === 0 ? (
                <p className={cn("py-8 text-center text-sm", PORTAL_TEXT_MUTED)}>
                  No sessions yet
                </p>
              ) : (
                <div className="-mx-3 -mb-3 divide-y divide-[var(--border)] overflow-hidden sm:-mx-4 sm:-mb-4">
                  {recentSessions.map((session, index) => {
                    const stripe = portalListStripe(index, chrome.theme.family)
                    return (
                    <div
                      key={session.id}
                      className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-5"
                    >
                      <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                        <Calendar className={cn("h-4 w-4", stripe.iconText)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>
                          {session.class_title}
                        </p>
                        <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                          {formatCentralDate(session.start_time)}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {session.section}
                          </span>
                          <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                            {session.total_attended || 0} attended
                          </span>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
          </FacultyAttendancePanel>
        </div>
    </div>
  );
}

