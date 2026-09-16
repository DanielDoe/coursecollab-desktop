"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  QrCode,
  Download,
  Maximize2,
  RefreshCw,
  Clock,
  Pencil,
  Trash2,
  Copy,
  Hash,
  Users,
  Calendar,
  MapPin,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  formatCentralDateTime,
  convertCentralDateTimeToUtcISO,
  centralDateISO,
  centralTime24,
  ensureUtcDate,
} from "@/lib/timezone";
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";
import { uniqueSessionCodes } from "@/lib/unique-session-codes";
import {
  AttendanceMeetingPicker,
  type AttendanceMeetingOption,
} from "@/components/attendance/attendance-meeting-picker";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { FacultyAttendancePanel, FacultyAttendanceLoading } from "@/components/attendance/faculty-attendance-ui";
import { PORTAL_CTA, PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/attendance/attendance-surface-classes";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { cn } from "@/lib/utils";

function paintAttendanceQr(
  canvas: HTMLCanvasElement,
  payload: string,
  size: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, size, size);
  QRCode.toCanvas(
    canvas,
    payload,
    {
      width: size,
      margin: 3,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "H",
    },
    (error) => {
      if (error) console.error("QR code generation error:", error);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    },
  );
}

const chrome = facultyEmbedChrome("attendance");

interface QRGeneratorProps {
  instructorId: string;
}

export function QRGenerator({ instructorId }: QRGeneratorProps) {
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const instHeaders = (): Record<string, string> => ({
    ...buildInstructorApiHeaders(),
    Authorization: localStorage.getItem("instructorSession") || "",
    "x-instructor-id": localStorage.getItem("instructorId") || instructorId,
  });
  const [sessions, setSessions] = useState<AttendanceMeetingOption[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");
  const [showEditor, setShowEditor] = useState(false);
  const [editorMode, setEditorMode] = useState<"edit" | "duplicate">("edit");
  const [editorSubmitting, setEditorSubmitting] = useState(false);
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [editorForm, setEditorForm] = useState({
    classTitle: "",
    section: "",
    startDate: "",
    startTime: "",
    endTime: "",
    locationLat: "",
    locationLong: "",
    radiusMeters: "100",
    qrExpiryMinutes: "30",
  });
  const [processing, setProcessing] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrFullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchSessions();
    fetchAvailableSessions();
  }, [instructorId, courseScopeVersion]);

  useEffect(() => {
    if (sessionData?.qr_code && qrCanvasRef.current) {
      paintAttendanceQr(qrCanvasRef.current, sessionData.qr_code, 650);
    }
  }, [sessionData?.qr_code]);

  useEffect(() => {
    if (sessionData?.qr_code && qrFullscreenCanvasRef.current) {
      paintAttendanceQr(qrFullscreenCanvasRef.current, sessionData.qr_code, 800);
    }
  }, [sessionData?.qr_code, showFullscreen]);

  const fetchAvailableSessions = async () => {
    try {
      setLoadingSessions(true);
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorApiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(uniqueSessionCodes(data.sessions || []));
      }
    } catch (error) {
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (sessionData) {
      const interval = setInterval(() => {
        const now = new Date();
        // Check QR expiration time, not session end time
        // Ensure UTC interpretation of database timestamps
        const qrExpiresAt = sessionData.qr_expires_at || sessionData.end_time
          ? ensureUtcDate(sessionData.qr_expires_at || sessionData.end_time)
          : new Date();
        const diff = qrExpiresAt.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeRemaining("Expired");
          clearInterval(interval);
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeRemaining(`${hours}h ${minutes}m`);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [sessionData]);

  const fetchSessions = async (focusSessionId?: string) => {
    try {
      setLoading(true);

      const response = await fetch(`/api/attendance/sessions?instructorId=${instructorId}`, {
        headers: instHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        const activeSessions = (data.sessions || [])
          .filter(Boolean)
        .filter((s: any) => s && s.is_active);
        setSessions(activeSessions);

        const target =
          (focusSessionId
            ? activeSessions.find(
                (s: any) => s && s.id?.toString() === focusSessionId
              )
            : activeSessions[0]) ?? null;

        setSelectedSession(target?.id?.toString() ?? "");
        setSessionData(target);
        if (target) {
          prepareEditorForm(target);
        }
      } else {
        setSessions([]);
        setSelectedSession("");
        setSessionData(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load sessions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId);
    const session =
      sessions.find((s) => s && s.id?.toString() === sessionId) ?? null;
    setSessionData(session);

    if (session) {
      prepareEditorForm(session);
    }
  };

  const downloadQR = async () => {
    if (!sessionData?.qr_code) return;

    try {
      // Create a high-resolution canvas for download
      const canvas = document.createElement("canvas");
      const size = 1000; // High resolution for download
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      // White background
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, size, size);

      // Generate QR code
      await QRCode.toCanvas(canvas, sessionData.qr_code, {
        width: size,
        margin: 3,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
        errorCorrectionLevel: "H",
      });

      // Download
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `attendance-qr-${sessionData.class_title || "session"}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();

      toast({
        title: "Downloaded",
        description: "QR code saved successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download QR code",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!sessionData) return;
    const confirmDelete = window.confirm(
      "Delete this session? This removes the QR code and attendance records tied to it."
    );
    if (!confirmDelete) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/attendance/sessions?sessionId=${sessionData.id}`, {
        method: "DELETE",
        headers: instHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete session");
      }

      toast({
        title: "Session Deleted",
        description: `${sessionData.class_title} has been removed.`,
      });

      await fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete session",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const prepareEditorForm = (session: any) => {
    if (!session) return;
    // Ensure UTC interpretation for time calculations
    const expiryMinutes = Math.max(
      0,
      Math.round(
        (ensureUtcDate(session.qr_expires_at).getTime() - ensureUtcDate(session.end_time).getTime()) /
          60000
      )
    );

    setEditorForm({
      classTitle: session.class_title || "",
      section: session.section || (availableSessions.length > 0 ? availableSessions[0].code : ""),
      startDate: centralDateISO(session.start_time),
      startTime: centralTime24(session.start_time),
      endTime: centralTime24(session.end_time),
      locationLat: session.location_lat ? session.location_lat.toString() : "",
      locationLong: session.location_long ? session.location_long.toString() : "",
      radiusMeters: session.radius_meters ? session.radius_meters.toString() : "100",
      qrExpiryMinutes: expiryMinutes.toString(),
    });
  };

  const handleEdit = () => {
    if (!sessionData) return;
    setEditorMode("edit");
    prepareEditorForm(sessionData);
    setShowEditor(true);
  };

  const handleDuplicate = () => {
    if (!sessionData) return;
    setEditorMode("duplicate");
    prepareEditorForm(sessionData);
    setShowEditor(true);
  };

  const handleEditorChange = (field: string, value: string) => {
    setEditorForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleEditorSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editorForm.startDate || !editorForm.startTime || !editorForm.endTime) {
      toast({
        title: "Missing information",
        description: "Please provide a start date, start time, and end time.",
        variant: "destructive",
      });
      return;
    }

    const startIso = convertCentralDateTimeToUtcISO(
      editorForm.startDate,
      editorForm.startTime
    );
    const endIso = convertCentralDateTimeToUtcISO(
      editorForm.startDate,
      editorForm.endTime
    );

    if (!startIso || !endIso) {
      toast({
        title: "Invalid time",
        description: "Please verify the time values.",
        variant: "destructive",
      });
      return;
    }

    const payloadBase = {
      classTitle: editorForm.classTitle,
      section: editorForm.section,
      startTime: startIso,
      endTime: endIso,
      locationLat:
        editorForm.locationLat.trim() === ""
          ? null
          : parseFloat(editorForm.locationLat),
      locationLong:
        editorForm.locationLong.trim() === ""
          ? null
          : parseFloat(editorForm.locationLong),
      radiusMeters: editorForm.radiusMeters
        ? parseInt(editorForm.radiusMeters, 10)
        : null,
      qrExpiryMinutes: editorForm.qrExpiryMinutes
        ? parseInt(editorForm.qrExpiryMinutes, 10)
        : null,
    };

    try {
      setEditorSubmitting(true);
      if (editorMode === "edit") {
        if (!sessionData) {
          throw new Error("No session selected to edit");
        }
        const response = await fetch("/api/attendance/sessions", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...instHeaders(),
          },
          body: JSON.stringify({
            sessionId: sessionData.id,
            ...payloadBase,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to update session");
        }

        const data = await response.json();
        const updatedSession = data.session;

        if (updatedSession && updatedSession.id) {
          await fetchSessions(updatedSession.id.toString());
          toast({
            title: "Session Updated",
            description: `${updatedSession.class_title} has been updated.`,
          });
        } else {
          await fetchSessions();
          toast({
            title: "Session Updated",
            description: "Attendance session changes have been saved.",
          });
        }
      } else {
        // duplicate
        const response = await fetch("/api/attendance/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...instHeaders(),
          },
          body: JSON.stringify({
            instructorId,
            section: payloadBase.section,
            classTitle: payloadBase.classTitle,
            startTime: payloadBase.startTime,
            endTime: payloadBase.endTime,
            locationLat: payloadBase.locationLat,
            locationLong: payloadBase.locationLong,
            radiusMeters: payloadBase.radiusMeters ?? undefined,
            qrExpiryMinutes: payloadBase.qrExpiryMinutes ?? undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to duplicate session");
        }

        const data = await response.json();
        const newSession = data.session;
        if (newSession && newSession.id) {
          await fetchSessions(newSession.id.toString());
          toast({
            title: "Session Duplicated",
            description: `${newSession.class_title} has been created.`,
          });
        } else {
          await fetchSessions();
          toast({
            title: "Session Duplicated",
            description: "A new attendance session has been created.",
          });
        }
      }

      setShowEditor(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save session",
        variant: "destructive",
      });
    } finally {
      setEditorSubmitting(false);
    }
  };

  if (loading) return <FacultyAttendanceLoading />;

  if (sessions.length === 0) {
    return (
      <FacultyAttendancePanel title="No active sessions">
        <div className="py-8 text-center">
          <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
            <QrCode className="h-5 w-5 !text-white" />
          </div>
          <p className={cn("mb-2 text-lg font-semibold", PORTAL_TEXT)}>No active sessions</p>
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>
            Create an attendance session first to generate a QR code.
          </p>
        </div>
      </FacultyAttendancePanel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <AttendanceMeetingPicker
          meetings={sessions}
          value={selectedSession}
          onValueChange={handleSessionChange}
          allowEmpty={false}
          loading={loading}
          placeholder="Select a class meeting…"
          triggerClassName="h-9 w-full max-w-md"
        />
        <Button onClick={fetchSessions} size="icon" className={cn("h-9 w-9", chrome.solid)}>
          <RefreshCw className="h-4 w-4 !text-white" />
        </Button>
        {timeRemaining ? (
          <span
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold",
              timeRemaining === "Expired" ? chrome.danger : chrome.success,
            )}
          >
            <Clock className="h-3.5 w-3.5 !text-white" />
            <span className="!text-white">{timeRemaining}</span>
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(220px,240px)_minmax(0,1fr)]">
          <FacultyAttendancePanel title="QR code">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-between gap-3">
                <div className="size-[200px] shrink-0 rounded-xl bg-white p-2">
                  <canvas
                    ref={qrCanvasRef}
                    className="block size-full"
                    style={{ imageRendering: "pixelated" }}
                    aria-label="Attendance QR Code"
                  />
                </div>
                <div className="flex w-full flex-col gap-2">
                  <Button
                    onClick={() => setShowFullscreen(true)}
                    className={cn("h-9 w-full shrink-0 px-3", PORTAL_CTA)}
                  >
                    <Maximize2 className="h-4 w-4" />
                    Fullscreen
                  </Button>
                  <Button
                    variant="outline"
                    onClick={downloadQR}
                    className={cn("h-9 w-full shrink-0 px-3", chrome.quiet)}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
                {sessionData?.fallback_code ? (
                  <div className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] px-3 py-2">
                    <div className="min-w-0">
                      <p className={cn("text-[11px]", PORTAL_TEXT_MUTED)}>Fallback code</p>
                      <p className={cn("font-mono text-lg font-semibold tracking-wider", PORTAL_TEXT)}>
                        {sessionData.fallback_code}
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        navigator.clipboard.writeText(sessionData.fallback_code);
                        toast({ title: "Copied", description: "Fallback code copied" });
                      }}
                      size="sm"
                      variant="outline"
                      className={cn("h-8", chrome.quiet)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
          </FacultyAttendancePanel>

          <FacultyAttendancePanel title={sessionData?.class_title || "Session"}>
            <div className="-mx-3 -mb-3 flex min-h-0 flex-1 flex-col border-t border-[var(--border)] sm:-mx-4 sm:-mb-4">
              <div className="divide-y divide-[var(--border)]">
                {[
                  { label: "Section", value: sessionData?.section || "—", icon: Hash },
                  { label: "Attended", value: String(sessionData?.total_attended || 0), icon: Users },
                  {
                    label: "Start",
                    value: sessionData?.start_time ? formatCentralDateTime(sessionData.start_time) : "—",
                    icon: Calendar,
                  },
                  {
                    label: "End",
                    value: sessionData?.end_time ? formatCentralDateTime(sessionData.end_time) : "—",
                    icon: Clock,
                  },
                  ...(sessionData?.location_lat && sessionData?.location_long
                    ? [{
                        label: "Location",
                        value: `${sessionData.radius_meters}m radius`,
                        icon: MapPin,
                      }]
                    : []),
                ].map((fact, index) => {
                  const stripe = portalListStripe(index, chrome.theme.family)
                  const Icon = fact.icon
                  return (
                    <div key={fact.label} className="flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--cc-accent-soft)]/45">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                        <Icon className={cn("h-4 w-4", stripe.iconText)} />
                      </span>
                      <div className="min-w-0">
                        <p className={cn("text-[11px] font-medium", PORTAL_TEXT_MUTED)}>{fact.label}</p>
                        <p className={cn("truncate text-sm font-semibold", PORTAL_TEXT)}>{fact.value}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-[var(--border)] p-3">
                <Button
                  type="button"
                  className={cn("h-8", chrome.quiet)}
                  onClick={handleEdit}
                  disabled={!sessionData || processing}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  type="button"
                  className={cn("h-8", chrome.quiet)}
                  onClick={handleDuplicate}
                  disabled={!sessionData || processing}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <Button
                  type="button"
                  className={cn("h-8", chrome.danger)}
                  onClick={handleDelete}
                  disabled={!sessionData || processing}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </FacultyAttendancePanel>
      </div>

      {/* Fullscreen QR Dialog */}
      <Dialog open={showFullscreen} onOpenChange={setShowFullscreen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 text-center px-2">
              {sessionData?.class_title || "Attendance QR Code"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center p-4 sm:p-6 md:p-8">
            <div className="p-2 sm:p-4 bg-white dark:bg-white rounded-xl sm:rounded-2xl shadow-lg mb-4 sm:mb-6 w-full">
              <div className="w-full max-w-[800px] aspect-square flex items-center justify-center bg-white mx-auto">
                <canvas
                  ref={qrFullscreenCanvasRef}
                  className="block size-full"
                  style={{ imageRendering: "pixelated" }}
                  aria-label="Attendance QR Code - Fullscreen"
                />
              </div>
            </div>
            <p className="text-base sm:text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
              Scan to Mark Attendance
            </p>
            {timeRemaining && (
              <Badge className="mb-4 sm:mb-6 text-sm sm:text-lg px-3 sm:px-4 py-1">
                Time Remaining: {timeRemaining}
              </Badge>
            )}

            {/* Fallback Code in Fullscreen */}
            {sessionData?.fallback_code && (
              <div className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                <div className="p-0">
                  <div className="mb-2 flex items-center gap-2">
                    <Hash className={cn("h-4 w-4 shrink-0 sm:h-5 sm:w-5", chrome.p.iconText)} />
                    <p className={cn("text-xs font-medium sm:text-sm", PORTAL_TEXT_MUTED)}>
                      Fallback Attendance Code
                    </p>
                  </div>
                  <p className={cn("mb-3 break-all font-mono text-3xl font-bold tracking-wider sm:mb-4 sm:break-normal sm:text-4xl", PORTAL_TEXT)}>
                    {sessionData.fallback_code}
                  </p>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(sessionData.fallback_code);
                      toast({
                        title: "Copied!",
                        description: "Fallback code copied to clipboard",
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Code
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit / Duplicate Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editorMode === "edit" ? "Edit Attendance Session" : "Duplicate Attendance Session"}
            </DialogTitle>
            <DialogDescription>
              {editorMode === "edit"
                ? "Adjust the schedule, location, or QR expiration for this session."
                : "Create a new session using the details below. Update any fields before saving."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditorSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="edit-classTitle">Class Title</Label>
                <Input
                  id="edit-classTitle"
                  value={editorForm.classTitle}
                  onChange={(e) => handleEditorChange("classTitle", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-section">Section</Label>
                <Select
                  value={editorForm.section}
                  onValueChange={(value) => handleEditorChange("section", value)}
                  disabled={loadingSessions}
                >
                  <SelectTrigger id="edit-section">
                    <SelectValue placeholder={loadingSessions ? "Loading sessions…" : "Select section"} />
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

              <div className="space-y-2">
                <Label htmlFor="edit-date">Date</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={editorForm.startDate}
                  onChange={(e) => handleEditorChange("startDate", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-startTime">Start Time</Label>
                <Input
                  id="edit-startTime"
                  type="time"
                  value={editorForm.startTime}
                  onChange={(e) => handleEditorChange("startTime", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-endTime">End Time</Label>
                <Input
                  id="edit-endTime"
                  type="time"
                  value={editorForm.endTime}
                  onChange={(e) => handleEditorChange("endTime", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-radius">Allowed Radius (meters)</Label>
                <Input
                  id="edit-radius"
                  type="number"
                  min="0"
                  value={editorForm.radiusMeters}
                  onChange={(e) => handleEditorChange("radiusMeters", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-expiry">QR Expiry (minutes after end time)</Label>
                <Input
                  id="edit-expiry"
                  type="number"
                  min="0"
                  value={editorForm.qrExpiryMinutes}
                  onChange={(e) => handleEditorChange("qrExpiryMinutes", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-lat">Latitude (optional)</Label>
                <Input
                  id="edit-lat"
                  type="number"
                  step="0.000001"
                  value={editorForm.locationLat}
                  onChange={(e) => handleEditorChange("locationLat", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-lng">Longitude (optional)</Label>
                <Input
                  id="edit-lng"
                  type="number"
                  step="0.000001"
                  value={editorForm.locationLong}
                  onChange={(e) => handleEditorChange("locationLong", e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditor(false)}
                disabled={editorSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editorSubmitting}>
                {editorSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Saving...
                  </div>
                ) : editorMode === "edit" ? (
                  "Save Changes"
                ) : (
                  "Create Session"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

