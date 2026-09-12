"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Search,
  Download,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  MapPin,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserPlus,
  ClipboardList,
  CalendarX,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { dbTimeToCDT, formatCentralDate } from "@/lib/timezone";
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import {
  ATTENDANCE_STATUS_OPTIONS,
  attendancePointsForStatus,
  attendanceStatusLabel,
  type AttendanceStatus,
} from "@/lib/attendance-status";
import { uniqueSessionCodes } from "@/lib/unique-session-codes";
import { AttendanceMeetingPicker, type AttendanceMeetingOption } from "@/components/attendance/attendance-meeting-picker";
import { isMeetingCancelled } from "@/lib/attendance-meeting-options";
import { cn } from "@/lib/utils";
import { FacultyAttendanceLoading } from "@/components/attendance/faculty-attendance-ui";
import {
  ATTENDANCE_TILE,
  ATTENDANCE_INPUT,
  ATTENDANCE_TABLE_HEAD,
  ATTENDANCE_TABLE_HEAD_CELL,
  ATTENDANCE_TABLE_ROW,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/attendance/attendance-surface-classes";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";

import { useAppConfirm } from "@/components/providers/app-confirm-provider"
const chrome = facultyEmbedChrome("attendance");

interface AttendanceRecord {
  id: number;
  studentId: number;
  studentName: string;
  studentNumber: string;
  section: string;
  classTitle: string;
  startTime: string;
  timestamp: string;
  status: string;
  geoVerified: boolean | null;
  distanceMeters: number | null;
  pointsEarned: number;
  sessionId?: number;
}

interface AttendanceSessionOption extends AttendanceMeetingOption {}

interface RosterStudentRow {
  studentId: number;
  fullName: string;
  studentNumber: string;
  section: string;
}

function AttendanceTablePagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemLabel = "records",
  className,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  itemLabel?: string;
  className?: string;
}) {
  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-3 border-t border-[var(--border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3",
        className,
      )}
    >
      <div className={cn("text-xs sm:text-sm", PORTAL_TEXT_MUTED)}>
        Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} {itemLabel}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNumber: number;
          if (totalPages <= 5) {
            pageNumber = i + 1;
          } else if (currentPage <= 3) {
            pageNumber = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNumber = totalPages - 4 + i;
          } else {
            pageNumber = currentPage - 2 + i;
          }

          return (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNumber)}
              className={cn(
                "h-8 w-8 p-0",
                currentPage === pageNumber &&
                  "bg-[var(--cc-accent)] !text-white hover:bg-[var(--cc-accent-hover)]",
              )}
            >
              {pageNumber}
            </Button>
          );
        })}

        {totalPages > 5 && currentPage < totalPages - 2 ? (
          <>
            <span className="text-slate-400">...</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(totalPages)}
              className="h-8 w-8 p-0"
            >
              {totalPages}
            </Button>
          </>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Select value={itemsPerPage.toString()} onValueChange={(v) => onItemsPerPageChange(Number(v))}>
          <SelectTrigger className="ml-0 h-8 w-[100px] sm:ml-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="15">15 / page</SelectItem>
            <SelectItem value="20">20 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

interface InstructorAttendanceManagementProps {
  instructorId?: string;
  embedInDashboard?: boolean;
}

function resolveInstructorId(propId?: string): string | null {
  const fromProp = propId?.trim();
  if (fromProp && fromProp !== "undefined") return fromProp;
  if (typeof window === "undefined") return null;
  const fromStorage = localStorage.getItem("instructorId")?.trim();
  if (fromStorage && fromStorage !== "undefined") return fromStorage;
  return null;
}

export function InstructorAttendanceManagement({
  instructorId,
  embedInDashboard,
}: InstructorAttendanceManagementProps) {
  const { toast } = useToast();
  const { confirm } = useAppConfirm();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionOption[]>([]);

  const [manualSessionId, setManualSessionId] = useState<string>("");
  const [rosterSection, setRosterSection] = useState<string>("");
  const [rosterStudents, setRosterStudents] = useState<RosterStudentRow[]>([]);
  const [sessionMarks, setSessionMarks] = useState<
    Record<number, { status: string; pointsEarned: number }>
  >({});
  const [rosterLoading, setRosterLoading] = useState(false);
  const [manualStudentSearch, setManualStudentSearch] = useState("");
  const [markingStudentId, setMarkingStudentId] = useState<number | null>(null);
  const [statusEditRecord, setStatusEditRecord] = useState<AttendanceRecord | null>(null);
  const [statusEditValue, setStatusEditValue] = useState<AttendanceStatus>("present");
  const [statusSaving, setStatusSaving] = useState(false);
  const [showCancelClassDialog, setShowCancelClassDialog] = useState(false);
  const [togglingSessionCancelled, setTogglingSessionCancelled] = useState(false);

  const selectedManualSession = manualSessionId
    ? attendanceSessions.find((s) => String(s.id) === manualSessionId) ?? null
    : null;
  const manualSessionSection = useMemo(() => {
    if (!manualSessionId) return "";
    return selectedManualSession?.section?.trim() ?? "";
  }, [manualSessionId, selectedManualSession?.section]);
  const effectiveRosterSection = manualSessionSection || rosterSection.trim();
  const selectedSessionIsCancelled = selectedManualSession
    ? isMeetingCancelled(selectedManualSession)
    : false;
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const effectiveInstructorId = resolveInstructorId(instructorId);

  const instructorAuthHeaders = (): Record<string, string> => ({
    ...buildInstructorApiHeaders(),
    Authorization: localStorage.getItem("instructorSession") || "",
    "x-instructor-id": effectiveInstructorId || "",
  });

  useEffect(() => {
    if (!effectiveInstructorId) {
      setLoading(false);
      setLoadingSessions(false);
      return;
    }
    fetchRecords();
    fetchAvailableSessions();
    fetchAttendanceSessions();
  }, [effectiveInstructorId, courseScopeVersion]);

  const fetchAttendanceSessions = async () => {
    const instId = effectiveInstructorId;
    if (!instId) return;
    try {
      const response = await fetch(`/api/attendance/sessions?instructorId=${encodeURIComponent(instId)}`, {
        headers: instructorAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAttendanceSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch attendance sessions:", error);
    }
  };

  useEffect(() => {
    if (loadingSessions || availableSessions.length === 0) return;
    if (rosterSection) return;
    const preferred =
      availableSessions.find((s) => s.code.toUpperCase() === "ECE2202") ??
      availableSessions.find((s) => s.code.toUpperCase() !== "BETA") ??
      availableSessions[0];
    if (preferred) setRosterSection(preferred.code);
  }, [availableSessions, loadingSessions, rosterSection]);

  useEffect(() => {
    if (!effectiveRosterSection) {
      setRosterStudents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setRosterLoading(true);
      try {
        const r = await fetch(
          `/api/instructor/attendance-roster?section=${encodeURIComponent(effectiveRosterSection)}`,
          { headers: instructorAuthHeaders() },
        );
        const data = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) {
          setRosterStudents([]);
          toast({
            title: "Roster unavailable",
            description: typeof data.error === "string" ? data.error : "Could not load students for this section.",
            variant: "destructive",
          });
          return;
        }
        setRosterStudents(Array.isArray(data.students) ? data.students : []);
      } catch {
        if (!cancelled) setRosterStudents([]);
      } finally {
        if (!cancelled) setRosterLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveRosterSection, effectiveInstructorId, courseScopeVersion]);

  const refreshSessionMarks = useCallback(async () => {
    if (!manualSessionId) return;
    try {
      const r = await fetch(`/api/attendance/records?sessionId=${manualSessionId}`, {
        headers: instructorAuthHeaders(),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) return;
      const map: Record<number, { status: string; pointsEarned: number }> = {};
      for (const rec of data.records || []) {
        map[Number(rec.studentId)] = {
          status: String(rec.status),
          pointsEarned: Number(rec.pointsEarned) || 0,
        };
      }
      setSessionMarks(map);
    } catch {
      /* keep existing marks */
    }
  }, [manualSessionId, effectiveInstructorId]);

  useEffect(() => {
    if (!manualSessionId) {
      setSessionMarks({});
      return;
    }
    void refreshSessionMarks();
  }, [manualSessionId, refreshSessionMarks, courseScopeVersion]);

  const handleManualMark = async (stu: RosterStudentRow, status: AttendanceStatus) => {
    if (selectedSessionIsCancelled) {
      toast({
        title: "Class cancelled",
        description: "Restore this meeting before marking attendance.",
        variant: "destructive",
      });
      return;
    }
    const sid = parseInt(manualSessionId, 10);
    if (!Number.isFinite(sid)) {
      toast({
        title: "Select a class session",
        description: "Choose which meeting day to record attendance for.",
        variant: "destructive",
      });
      return;
    }
    const instId = effectiveInstructorId;
    if (!instId) {
      toast({
        title: "Not signed in",
        description: "Instructor session is missing. Please log in again.",
        variant: "destructive",
      });
      return;
    }
    setMarkingStudentId(stu.studentId);
    try {
      const res = await fetch("/api/attendance/manual-override", {
        method: "POST",
        headers: {
          ...instructorAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sid,
          studentId: stu.studentId,
          studentName: stu.fullName,
          studentNumber: stu.studentNumber,
          instructorId: instId,
          status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed to mark attendance");
      }
      const label = attendanceStatusLabel(status);
      toast({ title: "Saved", description: `${stu.fullName} — ${label} (${data.points ?? ""} pt)` });
      setSessionMarks((prev) => ({
        ...prev,
        [stu.studentId]: { status, pointsEarned: Number(data.points) || 0 },
      }));
      const sidNum = parseInt(manualSessionId, 10);
      const pointsEarned = Number(data.points) || attendancePointsForStatus(status);
      setRecords((prev) => {
        const existingIdx = prev.findIndex(
          (r) => r.studentId === stu.studentId && r.sessionId === sidNum,
        );
        if (existingIdx < 0) return prev;
        const next = [...prev];
        next[existingIdx] = {
          ...next[existingIdx]!,
          status,
          pointsEarned,
          timestamp: new Date().toISOString(),
        };
        return next;
      });
    } catch (e) {
      toast({
        title: "Could not save attendance",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setMarkingStudentId(null);
    }
  };

  const handleToggleSessionCancelled = async (cancel: boolean) => {
    const sid = parseInt(manualSessionId, 10);
    if (!Number.isFinite(sid)) return;
    setTogglingSessionCancelled(true);
    try {
      const res = await fetch("/api/attendance/sessions", {
        method: "PUT",
        headers: {
          ...instructorAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sid,
          isCancelled: cancel,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not update session");
      }
      toast({
        title: cancel ? "Class cancelled" : "Class restored",
        description: cancel
          ? "This meeting is excluded from attendance totals. QR check-in is closed."
          : "This meeting counts toward attendance again when you take roll or open QR.",
      });
      setShowCancelClassDialog(false);
      await fetchAttendanceSessions();
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setTogglingSessionCancelled(false);
    }
  };

  const openStatusEdit = (record: AttendanceRecord) => {
    setStatusEditRecord(record);
    const s = record.status as AttendanceStatus;
    setStatusEditValue(
      ATTENDANCE_STATUS_OPTIONS.some((o) => o.value === s) ? s : "present",
    );
  };

  const saveStatusEdit = async () => {
    if (!statusEditRecord) return;
    setStatusSaving(true);
    try {
      const res = await fetch("/api/attendance/records", {
        method: "PUT",
        headers: {
          ...instructorAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: statusEditRecord.id,
          status: statusEditValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Update failed");
      }
      toast({ title: "Updated", description: "Attendance status saved." });
      const pointsEarned = attendancePointsForStatus(statusEditValue);
      setRecords((prev) =>
        prev.map((r) =>
          r.id === statusEditRecord.id
            ? { ...r, status: statusEditValue, pointsEarned }
            : r,
        ),
      );
      if (
        manualSessionId &&
        statusEditRecord.sessionId === Number(manualSessionId)
      ) {
        setSessionMarks((prev) => ({
          ...prev,
          [statusEditRecord.studentId]: { status: statusEditValue, pointsEarned },
        }));
      }
      setStatusEditRecord(null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to update",
        variant: "destructive",
      });
    } finally {
      setStatusSaving(false);
    }
  };

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
    filterRecords();
  }, [records, searchQuery, sectionFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sectionFilter, statusFilter]);

  const filteredRosterStudents = useMemo(() => {
    const q = manualStudentSearch.trim().toLowerCase();
    return rosterStudents.filter((stu) => {
      if (!q) return true;
      return (
        stu.fullName.toLowerCase().includes(q) ||
        stu.studentNumber.toLowerCase().includes(q)
      );
    });
  }, [rosterStudents, manualStudentSearch]);

  const fetchRecords = async (opts?: { silent?: boolean }) => {
    const instId = effectiveInstructorId;
    if (!instId) return;
    try {
      if (!opts?.silent) setLoading(true);

      const sessionsRes = await fetch(
        `/api/attendance/sessions?instructorId=${encodeURIComponent(instId)}`,
        { headers: instructorAuthHeaders() },
      );

      if (!sessionsRes.ok) {
        const errBody = await sessionsRes.json().catch(() => ({}));
        console.error("[Attendance Management] Failed to fetch sessions:", sessionsRes.status, errBody);
        toast({
          title: "Could not load sessions",
          description:
            typeof errBody.error === "string"
              ? errBody.error
              : "Refresh the page or restart the dev server if this persists.",
          variant: "destructive",
        });
        return;
      }

      const sessionsData = await sessionsRes.json();
      const allSessions = sessionsData.sessions || [];
      
      console.log('[Attendance Management] Fetched Sessions:', {
        totalSessions: allSessions.length,
        sessions: allSessions.map((s: any) => ({
          id: s.id,
          section: s.section,
          classTitle: s.class_title,
          isActive: s.is_active,
        })),
      });
      
      // Get unique sections from ALL sessions (including inactive)
      const uniqueSections = [...new Set(allSessions.map((s: any) => s.section).filter(Boolean))];

      console.log('[Attendance Management] Unique Sections:', uniqueSections);

      // Fetch records for all sections dynamically
      const recordsPromises = uniqueSections.length > 0 
        ? uniqueSections.map((section) =>
            fetch(`/api/attendance/records?section=${section}`, {
              headers: instructorAuthHeaders(),
            }).then(async (r) => {
              if (!r.ok) {
                console.error(`[Attendance Management] Failed to fetch records for section ${section}:`, r.status);
                return { section, records: [] };
              }
              const data = await r.json();
              return { section, records: data.records || [] };
            })
          )
        : [];

      const recordsDataArray = await Promise.all(recordsPromises);

      const allRecords = recordsDataArray.flatMap((d) => d.records || []);
      
      console.log('[Attendance Management] Fetched Records:', {
        sections: uniqueSections,
        recordsPerSection: recordsDataArray.map((d) => ({
          section: d.section,
          count: d.records?.length || 0,
          sampleRecords: d.records?.slice(0, 2) || [],
        })),
        totalRecords: allRecords.length,
        sampleRecord: allRecords[0],
        allRecordIds: allRecords.map((r: any) => r.id),
      });
      
      setRecords(allRecords);
      setFilteredRecords(allRecords);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load attendance records",
        variant: "destructive",
      });
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  const filterRecords = () => {
    let filtered = records;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (r) =>
          r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.classTitle.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Section filter
    if (sectionFilter !== "all") {
      filtered = filtered.filter((r) => r.section === sectionFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    setFilteredRecords(filtered);
  };

  const handleDeleteRecord = async (recordId: number) => {
    const ok = await confirm({
      title: "Delete this attendance record?",
      description: "This action cannot be undone.",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;

    try {
      const response = await fetch(`/api/attendance/records?recordId=${recordId}`, {
        method: "DELETE",
        headers: instructorAuthHeaders(),
      });

      if (response.ok) {
        toast({
          title: "Deleted",
          description: "Attendance record deleted successfully",
        });
        setRecords((prev) => prev.filter((r) => r.id !== recordId));
        void refreshSessionMarks();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete attendance record",
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    if (sectionFilter === "all") {
      toast({
        title: "Error",
        description: "Please select a specific section to clear records",
        variant: "destructive",
      });
      return;
    }

    setClearing(true);
    try {
      const response = await fetch("/api/attendance/records/clear-all", {
        method: "POST",
        headers: {
          ...instructorAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section: sectionFilter,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "✅ Records Cleared",
          description: data.message,
        });
        setShowClearAllDialog(false);
        void fetchRecords();
        void fetchAttendanceSessions();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clear attendance records",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Student ID",
      "Student Name",
      "Date",
      "Time",
      "Status",
      "Geo Verified",
      "Distance (m)",
      "Points",
    ];

    const rows = filteredRecords.map((r) => [
      r.studentNumber,
      r.studentName,
      r.startTime ? formatCentralDate(r.startTime) : "N/A",
      r.timestamp ? dbTimeToCDT(r.timestamp) : "N/A",
      r.status,
      r.geoVerified ? "Yes" : "No",
      r.distanceMeters || "N/A",
      r.pointsEarned,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-records-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    toast({
      title: "Export Complete",
      description: "Attendance records exported to CSV",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "border-0 bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]";
      case "late":
        return "border-0 bg-[var(--cc-sem-warning)]/10 text-[var(--cc-sem-warning)]";
      case "excused":
        return "border-0 bg-muted text-muted-foreground";
      default:
        return "border-0 bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]";
    }
  };

  const markButtonClass = (status: AttendanceStatus, active: boolean) => {
    if (active) {
      if (status === "present") return cn(chrome.success, "!text-white")
      if (status === "late") return cn(chrome.warning, "!text-white")
      if (status === "absent") return cn(chrome.danger, "!text-white")
      return cn(chrome.quiet, "!text-[var(--cc-text)]")
    }
    return cn(chrome.quiet, "!text-[var(--cc-text)]")
  };

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

  return (
    <div className={embedInDashboard ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "space-y-4"}>
      <Tabs defaultValue="mark" className={embedInDashboard ? "flex min-h-0 flex-1 flex-col" : "w-full"}>
        <TabsList className={cn("grid h-10 w-full max-w-md grid-cols-2 rounded-lg bg-[var(--muted)] p-1", embedInDashboard && "shrink-0")}>
          <TabsTrigger
            value="mark"
            className="gap-1.5 text-xs sm:text-sm !text-[var(--cc-text)] data-[state=inactive]:!bg-transparent data-[state=inactive]:!text-[var(--cc-text)] data-[state=active]:!bg-[var(--cc-accent)] data-[state=active]:!text-white data-[state=active]:border-transparent"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Mark attendance
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="gap-1.5 text-xs sm:text-sm !text-[var(--cc-text)] data-[state=inactive]:!bg-transparent data-[state=inactive]:!text-[var(--cc-text)] data-[state=active]:!bg-[var(--cc-accent)] data-[state=active]:!text-white data-[state=active]:border-transparent"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Attendance log
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="mark"
          className={cn("mt-4 space-y-0", embedInDashboard && "flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden")}
        >
          <Card className={cn(ATTENDANCE_TILE, embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
            <CardContent className={cn("space-y-3 p-3", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 items-center gap-2">
                  <UserPlus className={cn("h-4 w-4 shrink-0", chrome.accentIcon)} />
                  <h3 className={cn("text-sm font-semibold", PORTAL_TEXT)}>
                    Mark roll
                  </h3>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                    <span
                      key={opt.value}
                      className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--cc-text)]"
                      title={`${opt.label} (${opt.points} pt)`}
                    >
                      {opt.shortLabel} {opt.points}
                    </span>
                  ))}
                </div>
              </div>

              <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 sm:p-2.5">
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center min-w-0">
                    <Select
                      value={rosterSection || "__none__"}
                      onValueChange={(v) => setRosterSection(v === "__none__" ? "" : v)}
                      disabled={loadingSessions}
                    >
                      <SelectTrigger
                        className={cn("h-10 w-full sm:w-[8.5rem] shrink-0 text-sm data-[placeholder]:!text-[var(--cc-text-secondary)]", ATTENDANCE_INPUT)}
                      >
                        <SelectValue placeholder="Section" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Section…</SelectItem>
                        {availableSessions.map((session) => (
                          <SelectItem key={session.code} value={session.code}>
                            {session.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="min-w-0 flex-1 sm:max-w-[20rem] lg:max-w-[24rem]">
                      <AttendanceMeetingPicker
                        meetings={attendanceSessions}
                        value={manualSessionId}
                        onValueChange={(id) => {
                          setManualSessionId(id);
                          setManualStudentSearch("");
                        }}
                        filterSection={rosterSection || undefined}
                        triggerClassName="h-10 w-full"
                      />
                    </div>

                    <div className="relative w-full sm:w-[12rem] lg:w-[14rem] shrink-0">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
                      <Input
                        className={cn("h-10 pl-9 text-sm", ATTENDANCE_INPUT)}
                        placeholder="Search student…"
                        value={manualStudentSearch}
                        onChange={(e) => setManualStudentSearch(e.target.value)}
                        disabled={!effectiveRosterSection}
                      />
                    </div>
                  </div>

                  {manualSessionId ? (
                    <div className="flex shrink-0 items-center gap-2 xl:pl-2 xl:border-l xl:border-slate-200/80 dark:xl:border-white/10">
                      {selectedSessionIsCancelled ? (
                        <>
                          <p className="hidden xl:block text-[11px] text-amber-800 dark:text-amber-200 max-w-[11rem] leading-snug">
                            Cancelled — excluded from totals
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            className={cn("h-10 shrink-0 rounded-lg", chrome.success)}
                            disabled={togglingSessionCancelled}
                            onClick={() => handleToggleSessionCancelled(false)}
                          >
                            Restore class
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className={cn("h-10 shrink-0 rounded-lg", chrome.warning)}
                          disabled={togglingSessionCancelled}
                          onClick={() => setShowCancelClassDialog(true)}
                        >
                          <CalendarX className="h-4 w-4 mr-1.5" />
                          Cancel class
                        </Button>
                      )}
                    </div>
                  ) : null}
                </div>

                {manualSessionId && selectedSessionIsCancelled ? (
                  <p className="mt-2 text-xs text-amber-800 dark:text-amber-200 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-lg px-3 py-2 xl:hidden">
                    This class is cancelled — it does not count toward student attendance totals.
                  </p>
                ) : null}
              </div>

          {!effectiveRosterSection ? (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>Select a section to load the roster.</p>
          ) : rosterLoading ? (
            <FacultyAttendanceLoading />
          ) : rosterStudents.length === 0 ? (
            <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>No students in this section.</p>
          ) : (
            <div className={cn(embedInDashboard && "flex min-h-0 flex-1 flex-col gap-2")}>
              <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
                <p className="text-xs font-medium text-[var(--cc-text)]">
                  {filteredRosterStudents.length} students
                  {manualSessionId ? "" : " · pick a class meeting to mark"}
                </p>
              </div>
              <div
                className={cn(
                  "overflow-hidden rounded-lg border border-[var(--border)]",
                  embedInDashboard && "flex min-h-0 flex-1 flex-col",
                )}
              >
                <div
                  className={cn(
                    "overflow-x-auto",
                    embedInDashboard
                      ? "min-h-0 flex-1 overflow-y-auto pr-1 sm:pr-2"
                      : "max-h-[32rem] overflow-y-auto",
                  )}
                >
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className={cn("sticky top-0 z-10", ATTENDANCE_TABLE_HEAD)}>
                      <tr>
                        <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "text-left")}>Student</th>
                        <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "hidden text-left md:table-cell")}>ID</th>
                        <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "text-left")}>Status</th>
                        <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "text-right")}>Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
              {filteredRosterStudents.map((stu) => {
                  const mark = sessionMarks[stu.studentId];
                  return (
                  <tr
                    key={stu.studentId}
                    className="hover:bg-[var(--cc-accent-soft)]/45"
                  >
                    <td className="px-3 py-2.5 align-middle">
                      <p className={cn("leading-snug font-medium", PORTAL_TEXT)}>
                        {stu.fullName}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--cc-text-secondary)] md:hidden">
                        {stu.studentNumber}
                      </p>
                    </td>
                    <td className="hidden px-3 py-2.5 align-middle md:table-cell">
                      <span className="font-mono text-xs text-[var(--cc-text)]">
                        {stu.studentNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      {mark ? (
                        <Badge className={cn("text-[10px] font-semibold", getStatusColor(mark.status))}>
                          {attendanceStatusLabel(mark.status)} · {mark.pointsEarned}
                        </Badge>
                      ) : (
                        <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex flex-wrap justify-end gap-1">
                      {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                        <Button
                          key={opt.value}
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 min-w-[2rem] px-2 text-xs font-semibold disabled:opacity-100 disabled:cursor-not-allowed",
                            markButtonClass(opt.value, mark?.status === opt.value),
                          )}
                          disabled={!manualSessionId || markingStudentId === stu.studentId || selectedSessionIsCancelled}
                          onClick={() => void handleManualMark(stu, opt.value)}
                          title={`${opt.label} (${opt.points})`}
                        >
                          {markingStudentId === stu.studentId ? "…" : opt.shortLabel}
                        </Button>
                      ))}
                      </div>
                    </td>
                  </tr>
                );})}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent
          value="log"
          className={cn("mt-4", embedInDashboard ? "flex min-h-0 flex-1 flex-col gap-4 data-[state=inactive]:hidden" : "space-y-4")}
        >
          <Card className={cn(ATTENDANCE_TILE, embedInDashboard && "shrink-0")}>
            <CardHeader className="pb-2">
              <CardTitle className={cn("flex items-center gap-2 text-sm", PORTAL_TEXT)}>
                <ClipboardList className={cn("h-4 w-4", chrome.accentIcon)} />
                Attendance log
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search student, ID, class…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn("pl-10", ATTENDANCE_INPUT)}
                  />
                </div>

                <Select value={sectionFilter} onValueChange={setSectionFilter} disabled={loadingSessions}>
                  <SelectTrigger className={cn("w-[150px]", ATTENDANCE_INPUT)}>
                    <SelectValue placeholder={loadingSessions ? "Loading…" : "Section"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sections</SelectItem>
                    {availableSessions.map((session) => (
                      <SelectItem key={session.code} value={session.code}>
                        {session.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={cn("w-[150px]", ATTENDANCE_INPUT)}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={filteredRecords.length === 0}
                  className={chrome.quiet}
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                </Button>
                {sectionFilter !== "all" && (
                  <Button
                    onClick={() => setShowClearAllDialog(true)}
                    disabled={filteredRecords.length === 0 || clearing}
                    className={chrome.danger}
                  >
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Clear section</span>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Records table */}
          <Card className={cn(ATTENDANCE_TILE, embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
        <CardContent className={cn("p-0", embedInDashboard && "flex min-h-0 flex-1 flex-col")}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <FacultyAttendanceLoading />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
                <Users className="h-5 w-5 !text-white" />
              </div>
              <p className={cn("font-medium", PORTAL_TEXT)}>
                No attendance records found
              </p>
              <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>
                Marks from the Mark attendance tab and QR scans will show up here.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={cn("sticky top-0 z-10", ATTENDANCE_TABLE_HEAD)}>
                    <tr>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>Student</th>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>ID</th>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>Date</th>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>Status</th>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>Verification</th>
                      <th className={cn(ATTENDANCE_TABLE_HEAD_CELL, "px-6 text-left")}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {paginatedRecords.map((record) => (
                      <tr
                        key={record.id}
                        className={ATTENDANCE_TABLE_ROW}
                      >
                        <td className={cn("px-6 py-4 text-sm", PORTAL_TEXT)}>
                          {record.studentName}
                        </td>
                        <td className={cn("px-6 py-4 font-mono text-sm", PORTAL_TEXT_MUTED)}>
                          {record.studentNumber}
                        </td>
                        <td className={cn("px-6 py-4 text-sm", PORTAL_TEXT_MUTED)}>
                          {record.startTime ? formatCentralDate(record.startTime) : "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <Badge className={`${getStatusColor(record.status)} text-xs`}>
                            {record.status === "present" ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {attendanceStatusLabel(record.status)}
                            {record.pointsEarned != null ? ` · ${record.pointsEarned}` : ""}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          {record.geoVerified === true ? (
                            <Badge variant="outline" className="gap-1 border-[var(--cc-sem-success)]/30 text-xs text-[var(--cc-sem-success)]">
                              <MapPin className="h-3 w-3" />
                              Verified
                              {record.distanceMeters !== null && (
                                <span className="ml-1">({record.distanceMeters}m)</span>
                              )}
                            </Badge>
                          ) : record.geoVerified === false ? (
                            <Badge variant="outline" className="gap-1 border-[var(--cc-sem-danger)]/30 text-xs text-[var(--cc-sem-danger)]">
                              <MapPin className="h-3 w-3" />
                              Failed
                              {record.distanceMeters !== null && (
                                <span className="ml-1">({record.distanceMeters}m)</span>
                              )}
                            </Badge>
                          ) : (
                            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openStatusEdit(record)}
                              className="text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]"
                              title="Edit status"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRecord(record.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              title="Delete record"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <AttendanceTablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredRecords.length}
                startIndex={startIndex}
                endIndex={endIndex}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!statusEditRecord} onOpenChange={(open) => !open && setStatusEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit attendance status</DialogTitle>
            <DialogDescription>
              {statusEditRecord
                ? `${statusEditRecord.studentName} · ${statusEditRecord.classTitle}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Status</Label>
            <Select
              value={statusEditValue}
              onValueChange={(v) => setStatusEditValue(v as AttendanceStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} ({opt.points} pt)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusEditRecord(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveStatusEdit()} disabled={statusSaving}>
              {statusSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCancelClassDialog} onOpenChange={setShowCancelClassDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-amber-600" />
              Cancel this class meeting?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Students will not be penalized for this day — the meeting is excluded from attendance
              totals. QR check-in will close. You can restore the class later if plans change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={togglingSessionCancelled}>Keep class</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleToggleSessionCancelled(true)}
              disabled={togglingSessionCancelled}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {togglingSessionCancelled ? "Saving…" : "Cancel class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Clear all attendance records?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This moves all records for section <strong>{sectionFilter}</strong> to trash (recoverable 24h).
              Affects <strong>{filteredRecords.length}</strong> records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAll}
              disabled={clearing}
              className="bg-red-600 hover:bg-red-700"
            >
              {clearing ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

