"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  Trash2,
  Loader,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toYmdFromDb } from "@/lib/presentation-window-time";
import {
  FacultyIntegratedToolbar,
  facultyToolbarFilterButtonClass,
} from "@/components/instructor/dashboard-v2/FacultyIntegratedToolbar";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { PORTAL_TEXT, PORTAL_TEXT_MUTED } from "@/lib/appearance/portal-nav-classes";
import { cn } from "@/lib/utils";
import { facultyModuleSpinnerClass } from "@/lib/faculty-module-themes";
import { instructorApiFetch } from "@/lib/instructor-api-headers";

interface Presentation {
  id: number;
  project_id: number;
  group_id: number;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
  status: string;
  attendance_taken: boolean;
  instructor_notes: string;
  project_title: string;
  group_name: string;
  session: string;
  created_by_name: string;
}

export function InstructorPresentationsSchedule() {
  const chrome = facultyEmbedChrome("projects");
  const cardBase = chrome.card;
  const { toast } = useToast();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all"); // Changed from "scheduled" to "all" to show all student bookings
  const [searchQuery, setSearchQuery] = useState("");
  const [sessionFilter, setSessionFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [selectedPresentation, setSelectedPresentation] = useState<Presentation | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [instructorNotes, setInstructorNotes] = useState("");
  const [attendanceTaken, setAttendanceTaken] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [presentationToDelete, setPresentationToDelete] = useState<Presentation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [presentationToReschedule, setPresentationToReschedule] = useState<Presentation | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStartTime, setRescheduleStartTime] = useState("");
  const [rescheduleEndTime, setRescheduleEndTime] = useState("");
  const [availableRescheduleSlots, setAvailableRescheduleSlots] = useState<TimeSlot[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    fetchPresentations();
  }, [statusFilter]);

  const fetchPresentations = async () => {
    try {
      setLoading(true);
      // Default to 'all' to show all presentations (scheduled, completed, cancelled)
      // This ensures student bookings are visible regardless of status
      // But exclude cancelled presentations from the default view unless explicitly filtered
      const status = statusFilter === "all" ? "all" : statusFilter;
      const url = `/api/projects/presentations?status=${status}`;
      console.log('[INSTRUCTOR] Fetching presentations:', url, 'with status:', status);
      const response = await instructorApiFetch(url);
      const data = await response.json();
      
      console.log('[INSTRUCTOR] API response:', data);
      console.log('[INSTRUCTOR] Presentations count:', data.presentations?.length || 0);
      
      if (response.ok) {
        let presos = Array.isArray(data.presentations) ? data.presentations : [];
        
        // Show all presentations including cancelled when status filter is "all"
        // Only filter cancelled when explicitly filtering for a specific status
        if (statusFilter !== "all" && statusFilter !== "cancelled") {
          presos = presos.filter((p: { status?: string }) => p.status !== "cancelled");
        }
        
        console.log('[INSTRUCTOR] Setting presentations state:', presos.length, 'presentations');
        console.log('[INSTRUCTOR] First 5 presentations:', presos.slice(0, 5).map((p: any) => ({ 
          id: p.id, 
          title: p.project_title, 
          status: p.status, 
          date: p.scheduled_date,
          session: p.session 
        })));
        setPresentations(presos);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch presentations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching presentations:", error);
      toast({
        title: "Error",
        description: "Failed to fetch presentations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (presentation: Presentation) => {
    setSelectedPresentation(presentation);
    setInstructorNotes(presentation.instructor_notes || "");
    setAttendanceTaken(presentation.attendance_taken);
    setDetailsDialogOpen(true);
  };

  const handleUpdatePresentation = async () => {
    if (!selectedPresentation) return;

    try {
      const response = await instructorApiFetch("/api/projects/presentations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId: selectedPresentation.id,
          instructorNotes,
          attendanceTaken,
        }),
      });

      if (response.ok) {
        toast({
          title: "Updated",
          description: "Presentation details updated successfully",
        });
        setDetailsDialogOpen(false);
        fetchPresentations();
      } else {
        throw new Error("Failed to update");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update presentation",
        variant: "destructive",
      });
    }
  };

  const handleMarkComplete = async (presentationId: number) => {
    try {
      const response = await instructorApiFetch("/api/projects/presentations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          presentationId,
          status: "completed",
        }),
      });

      if (response.ok) {
        toast({
          title: "Marked Complete",
          description: "Presentation marked as completed",
        });
        fetchPresentations();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark presentation as complete",
        variant: "destructive",
      });
    }
  };

  const handleOpenDeleteConfirm = (presentation: Presentation) => {
    setPresentationToDelete(presentation);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!presentationToDelete) return;

    try {
      setIsDeleting(true);
      console.log("🗑️  Deleting presentation:", presentationToDelete.id);
      const response = await instructorApiFetch(`/api/projects/presentations?presentationId=${presentationToDelete.id}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "x-instructor-id": "1" // Instructor authorization for hard delete
        },
      });

      const data = await response.json();
      console.log("🗑️ Delete response:", data);

      if (response.ok) {
        // Check if it was actually deleted (hard delete) or just cancelled (soft delete)
        if (data.deleted === true && data.deleteType === "hard") {
          toast({
            title: "✅ Presentation Deleted",
            description: `Presentation for "${presentationToDelete.project_title}" has been permanently deleted and removed from the schedule`,
          });
        } else {
          toast({
            title: "⚠️ Presentation Cancelled",
            description: `Presentation for "${presentationToDelete.project_title}" has been cancelled. It will be removed from the schedule.`,
          });
        }
        setDeleteConfirmOpen(false);
        setPresentationToDelete(null);
        // Refresh the list to remove the deleted presentation
        await fetchPresentations();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to delete presentation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("❌ Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete presentation",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmOpen(false);
    setPresentationToDelete(null);
  };

  interface TimeSlot {
    startTime: string;
    endTime: string;
    available: boolean;
    projectTitle?: string;
    groupName?: string;
  }

  const handleOpenRescheduleDialog = async (presentation: Presentation) => {
    setPresentationToReschedule(presentation);
    setRescheduleDate("");
    setRescheduleStartTime("");
    setRescheduleEndTime("");
    setAvailableRescheduleSlots([]);
    setRescheduleDialogOpen(true);
  };

  const fetchRescheduleSlots = async (date: string) => {
    if (!date || !presentationToReschedule) return;
    
    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Parse date in local timezone to avoid UTC shifts
    const [year, month, day] = date.split('-').map(Number);
    const selectedDate = new Date(year, month - 1, day, 12, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
      setAvailableRescheduleSlots([]);
      toast({
        title: "Date Unavailable",
        description: "Cannot reschedule to a past date. Please select today or a future date.",
        variant: "destructive",
      });
      return;
    }
    
    // Check if date is Thanksgiving (Nov 26)
    const thanksgivingDate = new Date(2025, 10, 26, 12, 0, 0); // Nov 26, 2025 (month is 0-indexed)
    thanksgivingDate.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() === thanksgivingDate.getTime() || 
        (selectedDate.getDate() === 26 && selectedDate.getMonth() === 10)) {
      setAvailableRescheduleSlots([]);
      toast({
        title: "Date Unavailable",
        description: "Nov 26 is a holiday and unavailable for scheduling.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setLoadingRescheduleSlots(true);
      const response = await instructorApiFetch(
        `/api/projects/presentation-config?session=${presentationToReschedule.session}`
      );
      const configData = await response.json();
      
      if (configData.config) {
        const config = configData.config;
        const slotsResponse = await instructorApiFetch(
          `/api/projects/presentations/available-slots?date=${date}&startTime=${config.start_time}&endTime=${config.end_time}&slotDuration=${config.slot_duration}&session=${presentationToReschedule.session}`
        );
        const slotsData = await slotsResponse.json();
        
        if (slotsResponse.ok) {
          setAvailableRescheduleSlots(slotsData.slots || []);
        }
      }
    } catch (error) {
      console.error("Error fetching reschedule slots:", error);
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  const handleRescheduleDateChange = (date: string) => {
    setRescheduleDate(date);
    setRescheduleStartTime("");
    setRescheduleEndTime("");
    if (date) {
      fetchRescheduleSlots(date);
    }
  };

  const handleRescheduleTimeSelect = (startTime: string) => {
    const slot = availableRescheduleSlots.find((s) => s.startTime === startTime);
    if (slot) {
      setRescheduleStartTime(slot.startTime);
      setRescheduleEndTime(slot.endTime);
    }
  };

  const handleReschedulePresentation = async () => {
    if (!presentationToReschedule || !rescheduleDate || !rescheduleStartTime || !rescheduleEndTime) {
      toast({
        title: "Missing Information",
        description: "Please select a date and time slot",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsRescheduling(true);
      const response = await instructorApiFetch("/api/projects/presentations", {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "x-instructor-id": "1"
        },
        body: JSON.stringify({
          presentationId: presentationToReschedule.id,
          scheduledDate: rescheduleDate,
          startTime: rescheduleStartTime,
          endTime: rescheduleEndTime,
          status: "scheduled",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "✅ Presentation Rescheduled!",
          description: `"${presentationToReschedule.project_title}" rescheduled to ${new Date(rescheduleDate).toLocaleDateString()} at ${rescheduleStartTime.substring(0, 5)}`,
        });
        setRescheduleDialogOpen(false);
        setPresentationToReschedule(null);
        setRescheduleDate("");
        setRescheduleStartTime("");
        setRescheduleEndTime("");
        fetchPresentations();
      } else {
        toast({
          title: "Reschedule Failed",
          description: data.error || "Failed to reschedule presentation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Reschedule error:", error);
      toast({
        title: "Error",
        description: "Failed to reschedule presentation",
        variant: "destructive",
      });
    } finally {
      setIsRescheduling(false);
    }
  };

  const formatTime = (time: string) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Invalid Date";
    
    // Use local date parsing to avoid timezone shifts
    try {
      const localDate = parseLocalDate(date);
      // Validate the date is valid
      if (isNaN(localDate.getTime())) {
        return "Invalid Date";
      }
      return localDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch (error) {
      console.error("Error formatting date:", date, error);
      return "Invalid Date";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return (
          <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-accent)]/15 text-[var(--cc-accent-dark)]">
            Scheduled
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-success)]/15 text-[var(--cc-sem-success)]">
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-danger)]/15 text-[var(--cc-sem-danger)]">
            Cancelled
          </span>
        );
      case "rescheduled":
        return (
          <span className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[var(--cc-sem-warning)]/15 text-[var(--cc-sem-warning)]">
            Rescheduled
          </span>
        );
      default:
        return (
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {status}
          </span>
        );
    }
  };

  const presentationMeta = (presentation: Presentation) => {
    const parts = [presentation.group_name, presentation.session].filter(Boolean);
    if (presentation.location) parts.push(presentation.location);
    return parts.join(" · ");
  };

  const rowActionClass =
    "h-7 w-7 text-[var(--cc-text-muted)] hover:bg-[var(--cc-accent-soft)]/45 hover:text-[var(--cc-text)]";

  const renderPresentationCard = (
    presentation: Presentation,
    index: number,
    showDate = false,
    layout: "card" | "list" = "list",
  ) => {
    const stripe = portalListStripe(index, chrome.theme.family)
    const dateLabel = showDate ? formatDate(toYmdFromDb(presentation.scheduled_date)) : null
    return (
      <article
        key={presentation.id}
        className={cn(
          "flex flex-col gap-3 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:flex-row sm:items-center sm:gap-4",
          layout === "card"
            ? "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4"
            : "px-3 py-2.5 sm:px-4 sm:py-3",
        )}
      >
        <button
          type="button"
          onClick={() => handleViewDetails(presentation)}
          className="flex min-w-0 flex-1 flex-col gap-2 text-left sm:flex-row sm:items-center sm:gap-4"
        >
          <div className="flex shrink-0 items-center gap-1.5 sm:w-[9.5rem] sm:flex-col sm:items-start sm:gap-0.5">
            {dateLabel ? (
              <span className={cn("text-[11px] font-medium", PORTAL_TEXT_MUTED)}>{dateLabel}</span>
            ) : null}
            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold tabular-nums", PORTAL_TEXT)}>
              <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg", stripe.iconBg)}>
                <Clock className={cn("h-3.5 w-3.5", stripe.iconText)} aria-hidden />
              </span>
              {formatTime(presentation.start_time)} – {formatTime(presentation.end_time)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={cn("text-sm font-semibold leading-snug", PORTAL_TEXT)}>
                {presentation.project_title}
              </h4>
              {getStatusBadge(presentation.status)}
              {presentation.attendance_taken ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--cc-sem-success)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--cc-sem-success)]">
                  <CheckCircle className="h-3 w-3" aria-hidden />
                  Attendance
                </span>
              ) : null}
            </div>
            <p className={cn("mt-1 line-clamp-2 text-xs", PORTAL_TEXT_MUTED)}>
              {presentationMeta(presentation)}
            </p>
          </div>
        </button>
        <div
          className="flex shrink-0 items-center gap-0.5 self-end sm:self-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className={rowActionClass}
            onClick={() => handleViewDetails(presentation)}
            title="Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {presentation.status === "scheduled" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-success)] hover:bg-[var(--cc-sem-success)]/10"
                onClick={() => handleMarkComplete(presentation.id)}
                title="Mark complete"
              >
                <CheckCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/10"
                onClick={() => handleOpenDeleteConfirm(presentation)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {presentation.status === "cancelled" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={rowActionClass}
                onClick={() => handleOpenRescheduleDialog(presentation)}
                title="Reschedule"
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--cc-sem-danger)] hover:bg-[var(--cc-sem-danger)]/10"
                onClick={() => handleOpenDeleteConfirm(presentation)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </article>
    )
  }

  // Ensure presentations is always an array
  const safePresentations = Array.isArray(presentations) ? presentations : [];
  
  console.log('[INSTRUCTOR] safePresentations:', safePresentations.length, 'items');

  // Helper function to parse date string in local timezone (avoid UTC shifts)
  const parseLocalDate = (dateString: string | null | undefined): Date => {
    if (!dateString) {
      return new Date(NaN); // Return invalid date
    }
    
    try {
      // Parse YYYY-MM-DD format and create date in local timezone
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        return new Date(NaN); // Return invalid date
      }
      
      const [year, month, day] = parts.map(Number);
      
      // Validate the parsed values
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        return new Date(NaN); // Return invalid date
      }
      
      return new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid timezone edge cases
    } catch (error) {
      console.error("Error parsing date:", dateString, error);
      return new Date(NaN); // Return invalid date
    }
  };

  // Show ALL presentations including past dates for record keeping
  // Only filter out presentations with invalid dates
  const filteredPresentations = Array.isArray(safePresentations)
    ? safePresentations.filter((p) => {
        // Skip presentations with invalid or missing dates
        if (!p.scheduled_date) {
          console.warn('[INSTRUCTOR] Skipping presentation with missing date:', p.id, p.project_title, p.status);
          return false;
        }
        
        const dateStr = toYmdFromDb(p.scheduled_date);

        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn(
            "[INSTRUCTOR] Skipping presentation with invalid date format:",
            p.id,
            dateStr,
            "Type:",
            typeof p.scheduled_date
          );
          return false;
        }
        
        // Validate date can be parsed
        const presentationDate = parseLocalDate(dateStr);
        if (isNaN(presentationDate.getTime())) {
          console.warn('[INSTRUCTOR] Skipping presentation with unparseable date:', p.id, dateStr);
          return false;
        }
        
        const query = searchQuery.trim().toLowerCase();
        if (sessionFilter !== "all" && p.session !== sessionFilter) return false;
        if (query) {
          const haystack = [
            p.project_title,
            p.group_name,
            p.session,
            p.location,
            p.created_by_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      })
    : [];
  
  const presentationSessions = useMemo(() => {
    return Array.from(
      new Set(safePresentations.map((p) => p.session).filter((session): session is string => Boolean(session))),
    ).sort();
  }, [safePresentations]);

  console.log('[INSTRUCTOR] Filtered presentations:', filteredPresentations.length, 'out of', safePresentations.length);

  // Group presentations by date
  const groupedPresentations = Array.isArray(filteredPresentations) 
      ? filteredPresentations.reduce((acc, presentation) => {
        const date = presentation.scheduled_date
          ? toYmdFromDb(presentation.scheduled_date)
          : "";
        if (!date) {
          if (presentation.scheduled_date) {
            console.warn("[INSTRUCTOR] Invalid date object for presentation:", presentation.id);
          } else {
            console.warn("[INSTRUCTOR] Missing date for presentation:", presentation.id);
          }
          return acc;
        }
        
        // Validate date format
        if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          console.warn('[INSTRUCTOR] Invalid date format for presentation:', presentation.id, date);
          return acc;
        }
        
        if (!acc[date]) {
          acc[date] = [];
        }
        acc[date].push(presentation);
        return acc;
      }, {} as Record<string, Presentation[]>)
    : {};

  const sortedDates = Object.keys(groupedPresentations).sort().filter(date => {
    // Validate date format before including
    return date && date.match(/^\d{4}-\d{2}-\d{2}$/);
  });
  
  console.log('[INSTRUCTOR] Grouped presentations:', Object.keys(groupedPresentations).length, 'dates');
  console.log('[INSTRUCTOR] Sorted dates:', sortedDates);

  return (
    <div className="space-y-4">
      <FacultyIntegratedToolbar
        moduleId="projects"
        search={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchClear={() => setSearchQuery("")}
        searchPlaceholder="Search projects, groups, or locations…"
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
                {presentationSessions.map((session) => (
                  <SelectItem key={session} value={session}>
                    {session}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className={cn(
                  facultyToolbarFilterButtonClass(statusFilter !== "all"),
                  "h-9 w-[132px] shadow-none",
                )}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        meta={
          <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
            {filteredPresentations.length} presentation{filteredPresentations.length === 1 ? "" : "s"}
            {statusFilter !== "all" ? ` · ${statusFilter}` : ""}
            {sessionFilter !== "all" ? ` · ${sessionFilter}` : ""}
            {" · "}
            {filteredPresentations.filter((p) => p.status === "scheduled").length} scheduled
          </p>
        }
        trailing={
          <Button
            size="sm"
            onClick={fetchPresentations}
            disabled={loading}
            className={cn("h-9 rounded-lg", chrome.quiet)}
          >
            {loading ? "Loading…" : "Refresh"}
          </Button>
        }
      />

      {loading ? (
        <div className={cn(cardBase, "p-12 text-center")}>
          <div className={cn("h-8 w-8 animate-spin rounded-full border-2 border-t-transparent mx-auto mb-2", facultyModuleSpinnerClass("projects"))} />
          <p className={cn("text-sm", PORTAL_TEXT_MUTED)}>Loading schedule…</p>
        </div>
      ) : sortedDates.length === 0 ? (
        <div className={cn(cardBase, "p-8 sm:p-12 text-center")}>
          <Calendar className={cn("mx-auto mb-3 h-10 w-10", PORTAL_TEXT_MUTED)} />
          <p className={cn("font-medium", PORTAL_TEXT)}>
            {searchQuery.trim() || sessionFilter !== "all" || statusFilter !== "all"
              ? "No matching presentations"
              : "No presentations found."}
          </p>
          <p className={cn("text-sm mt-2", PORTAL_TEXT_MUTED)}>
            Students can schedule presentations from their project page.
          </p>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 gap-3 md:grid-cols-2" : "space-y-5"}>
          {viewMode === "grid"
            ? filteredPresentations
                .slice()
                .sort((a, b) => {
                  const dateCmp = toYmdFromDb(a.scheduled_date).localeCompare(toYmdFromDb(b.scheduled_date))
                  return dateCmp !== 0 ? dateCmp : a.start_time.localeCompare(b.start_time)
                })
                .map((presentation, index) =>
                  renderPresentationCard(presentation, index, true, "card"),
                )
            : sortedDates.map((date, dateIndex) => {
            const dayPresentations = groupedPresentations[date].sort((a, b) =>
              a.start_time.localeCompare(b.start_time)
            );

            return (
              <div key={date} className="space-y-3">
                <div className="px-1">
                  <h4 className={cn("text-sm font-semibold", PORTAL_TEXT)}>{formatDate(date)}</h4>
                  <p className={cn("mt-0.5 text-xs", PORTAL_TEXT_MUTED)}>
                    {dayPresentations.length} presentation{dayPresentations.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className={cn(cardBase, "divide-y divide-[var(--border)] overflow-hidden")}>
                  {dayPresentations.map((presentation, index) =>
                    renderPresentationCard(presentation, dateIndex + index, false, "list"),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Presentation Details</DialogTitle>
            <DialogDescription>View and manage presentation information</DialogDescription>
          </DialogHeader>

          {selectedPresentation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">Project</Label>
                  <p className="font-semibold">{selectedPresentation.project_title}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Group</Label>
                  <p className="font-semibold">{selectedPresentation.group_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Date</Label>
                  <p className="font-semibold">{formatDate(selectedPresentation.scheduled_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Time</Label>
                  <p className="font-semibold">
                    {formatTime(selectedPresentation.start_time)} -{" "}
                    {formatTime(selectedPresentation.end_time)}
                  </p>
                </div>
                {selectedPresentation.location && (
                  <div>
                    <Label className="text-xs text-slate-600">Location</Label>
                    <p className="font-semibold">{selectedPresentation.location}</p>
                  </div>
                )}
                <div>
                  <Label className="text-xs text-slate-600">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedPresentation.status)}</div>
                </div>
              </div>

              {selectedPresentation.notes && (
                <div>
                  <Label className="text-xs text-slate-600">Student Notes</Label>
                  <p className="text-sm mt-1 p-3 bg-slate-50 rounded-lg">
                    {selectedPresentation.notes}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="attendance"
                  checked={attendanceTaken}
                  onChange={(e) => setAttendanceTaken(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="attendance" className="cursor-pointer">
                  Mark attendance as taken
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructor-notes">Instructor Notes</Label>
                <Textarea
                  id="instructor-notes"
                  placeholder="Add notes about the presentation..."
                  value={instructorNotes}
                  onChange={(e) => setInstructorNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              {selectedPresentation?.status === "cancelled" && (
                <Button
                  variant="outline"
                  onClick={async () => {
                    if (!selectedPresentation) return;
                    try {
                      const response = await instructorApiFetch("/api/projects/presentations", {
                        method: "PUT",
                        headers: { 
                          "Content-Type": "application/json",
                          "x-instructor-id": "1"
                        },
                        body: JSON.stringify({
                          presentationId: selectedPresentation.id,
                          status: "scheduled",
                        }),
                      });
                      if (response.ok) {
                        toast({
                          title: "Presentation Restored",
                          description: `"${selectedPresentation.project_title}" has been restored to scheduled`,
                        });
                        setDetailsDialogOpen(false);
                        fetchPresentations();
                      }
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to restore presentation",
                        variant: "destructive",
                      });
                    }
                  }}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  ↻ Restore
                </Button>
              )}
              <Button
                variant="destructive"
                onClick={() => {
                  if (selectedPresentation) {
                    setPresentationToDelete(selectedPresentation);
                    setDetailsDialogOpen(false);
                    setDeleteConfirmOpen(true);
                  }
                }}
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
              <Button onClick={handleUpdatePresentation}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Delete Presentation
            </DialogTitle>
          </DialogHeader>

          {presentationToDelete && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 mb-3">
                  Are you sure you want to delete this presentation?
                </p>
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>Project:</strong> {presentationToDelete.project_title}
                  </p>
                  <p>
                    <strong>Group:</strong> {presentationToDelete.group_name}
                  </p>
                  <p>
                    <strong>Session:</strong> {presentationToDelete.session}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(presentationToDelete.scheduled_date).toLocaleDateString()}
                  </p>
                  <p>
                    <strong>Time:</strong> {presentationToDelete.start_time} -{" "}
                    {presentationToDelete.end_time}
                  </p>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                This action cannot be undone. Students will need to reschedule their
                presentation.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Presentation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule Presentation</DialogTitle>
            <DialogDescription>
              Select a new date and time for "{presentationToReschedule?.project_title}"
            </DialogDescription>
          </DialogHeader>

          {presentationToReschedule && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div>
                  <Label className="text-xs text-slate-600">Project</Label>
                  <p className="font-semibold">{presentationToReschedule.project_title}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Group</Label>
                  <p className="font-semibold">{presentationToReschedule.group_name}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Session</Label>
                  <p className="font-semibold">{presentationToReschedule.session}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Current Date</Label>
                  <p className="font-semibold">{formatDate(presentationToReschedule.scheduled_date)}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Select New Date *</Label>
                  <Input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => {
                      const selectedDateValue = e.target.value;
                      
                      // Check if date is in the past using local timezone
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const [year, month, day] = selectedDateValue.split('-').map(Number);
                      const selectedDate = new Date(year, month - 1, day, 12, 0, 0);
                      selectedDate.setHours(0, 0, 0, 0);
                      
                      if (selectedDate < today) {
                        toast({
                          title: "Date Unavailable",
                          description: "Cannot reschedule to a past date. Please select today or a future date.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      // Block Thanksgiving date (Nov 26)
                      if (selectedDateValue === '2025-11-26' || 
                          (selectedDate.getDate() === 26 && selectedDate.getMonth() === 10)) {
                        toast({
                          title: "Date Unavailable",
                          description: "Nov 26 is a holiday and unavailable for scheduling.",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      handleRescheduleDateChange(selectedDateValue);
                    }}
                    min={(() => {
                      const today = new Date();
                      const year = today.getFullYear();
                      const month = String(today.getMonth() + 1).padStart(2, '0');
                      const day = String(today.getDate()).padStart(2, '0');
                      return `${year}-${month}-${day}`;
                    })()}
                    max="2026-12-31"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Valid days and time windows follow the presentation schedule for section{" "}
                    {presentationToReschedule.session}.
                  </p>
                </div>

                {rescheduleDate && (
                  <div>
                    <Label>Select Time Slot *</Label>
                    {loadingRescheduleSlots ? (
                      <div className="text-center py-8">
                        <Loader className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <p className="text-sm text-slate-600">Loading available slots...</p>
                      </div>
                    ) : availableRescheduleSlots.length === 0 ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No available slots found for this date. Please select another date.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2 max-h-60 overflow-y-auto p-2 border rounded-lg">
                        {availableRescheduleSlots.map((slot, index) => (
                          <Button
                            key={index}
                            type="button"
                            variant={rescheduleStartTime === slot.startTime ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleRescheduleTimeSelect(slot.startTime)}
                            disabled={!slot.available}
                            className={!slot.available ? "opacity-50 cursor-not-allowed" : ""}
                          >
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {rescheduleStartTime && rescheduleEndTime && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Selected: {new Date(rescheduleDate).toLocaleDateString()} at {formatTime(rescheduleStartTime)} - {formatTime(rescheduleEndTime)}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)} disabled={isRescheduling}>
              Cancel
            </Button>
            <Button 
              onClick={handleReschedulePresentation} 
              disabled={!rescheduleDate || !rescheduleStartTime || !rescheduleEndTime || isRescheduling}
            >
              {isRescheduling ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Rescheduling...
                </>
              ) : (
                "Reschedule Presentation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

