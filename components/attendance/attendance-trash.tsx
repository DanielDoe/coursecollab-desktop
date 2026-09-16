"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RotateCcw, Search, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCentralDate, dbTimeToCDT } from "@/lib/timezone";
import { motion } from "framer-motion";
import { buildInstructorApiHeaders, instructorApiFetch } from "@/lib/instructor-api-headers";
import { useInstructorDashboardV2 } from "@/components/instructor/dashboard-v2/InstructorDashboardV2Context";
import { uniqueSessionCodes } from "@/lib/unique-session-codes";
import { FacultyAttendancePanel, FacultyAttendanceLoading } from "@/components/attendance/faculty-attendance-ui";
import {
  ATTENDANCE_INPUT,
  PORTAL_TEXT,
  PORTAL_TEXT_MUTED,
} from "@/lib/attendance/attendance-surface-classes";
import { facultyEmbedChrome } from "@/lib/faculty-embed-chrome";
import { portalListStripe } from "@/lib/portal-module-themes";
import { cn } from "@/lib/utils";

const chrome = facultyEmbedChrome("attendance");

interface TrashRecord {
  id: number;
  studentId: number;
  studentName: string;
  studentNumber: string;
  section: string;
  classTitle: string;
  timestamp: string;
  deletedAt: string;
  status: string;
  geoVerified: boolean;
  distanceMeters: number | null;
  pointsEarned: number;
}

interface AttendanceTrashProps {
  instructorId: string;
}

export function AttendanceTrash({ instructorId }: AttendanceTrashProps) {
  const { toast } = useToast();
  const { courseScopeVersion } = useInstructorDashboardV2();
  const instHeaders = (): Record<string, string> => ({
    ...buildInstructorApiHeaders(),
    Authorization: localStorage.getItem("instructorSession") || "",
    "x-instructor-id": localStorage.getItem("instructorId") || instructorId,
  });

  const [records, setRecords] = useState<TrashRecord[]>([]);
  const [expiredRecords, setExpiredRecords] = useState<TrashRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [availableSessions, setAvailableSessions] = useState<{ code: string }[]>([]);
  const [recovering, setRecovering] = useState<number | null>(null);

  useEffect(() => {
    fetchTrashRecords();
    fetchAvailableSessions();
  }, [instructorId, sectionFilter, courseScopeVersion]);

  const fetchAvailableSessions = async () => {
    try {
      const response = await instructorApiFetch("/api/instructor/sessions", {
        headers: buildInstructorApiHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(uniqueSessionCodes(data.sessions || []));
      }
    } catch (error) {
    }
  };

  const fetchTrashRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (sectionFilter !== "all") {
        params.append("section", sectionFilter);
      }

      const response = await fetch(`/api/attendance/records/trash?${params}`, {
        headers: instHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records || []);
        setExpiredRecords(data.expiredRecords || []);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch trash records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecover = async (recordId: number) => {
    setRecovering(recordId);
    try {
      const response = await fetch("/api/attendance/records/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...instHeaders(),
        },
        body: JSON.stringify({ recordId }),
      });

      if (response.ok) {
        toast({
          title: "✅ Record Recovered",
          description: "Attendance record has been restored",
        });
        fetchTrashRecords();
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to recover record");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to recover attendance record",
        variant: "destructive",
      });
    } finally {
      setRecovering(null);
    }
  };

  const getHoursUntilExpiry = (deletedAt: string): number => {
    const deleted = new Date(deletedAt);
    const now = Date.now();
    const hoursSinceDeletion = (now - deleted.getTime()) / (1000 * 60 * 60);
    return Math.max(0, 24 - hoursSinceDeletion);
  };

  const filteredRecords = records.filter((r) => {
    const matchesSearch =
      r.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.studentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.classTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading) return <FacultyAttendanceLoading />;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--cc-text-muted)]" />
              <Input
                placeholder="Search deleted records…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("h-9 pl-9", ATTENDANCE_INPUT)}
              />
            </div>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className={cn("h-9 w-[140px]", ATTENDANCE_INPUT)}>
                <SelectValue placeholder="Section" />
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
      </div>

      {filteredRecords.length > 0 && (
        <FacultyAttendancePanel
          title={`${filteredRecords.length} recoverable`}
          action={
            <span className={cn("text-xs", PORTAL_TEXT_MUTED)}>24h window</span>
          }
        >
            <div className="-mx-3 -mb-3 divide-y divide-[var(--border)] overflow-hidden sm:-mx-4 sm:-mb-4">
              {filteredRecords.map((record, index) => {
                const hoursLeft = getHoursUntilExpiry(record.deletedAt);
                const stripe = portalListStripe(index, chrome.theme.family);
                return (
                  <motion.div
                    key={record.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 px-3 py-2 transition-colors hover:bg-[var(--cc-accent-soft)]/45 sm:px-4"
                  >
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                      <RotateCcw className={cn("h-4 w-4", stripe.iconText)} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("font-semibold", PORTAL_TEXT)}>{record.studentName}</span>
                        <Badge variant="outline">{record.studentNumber}</Badge>
                        <Badge variant="outline">{record.section}</Badge>
                        <Badge
                          className={
                            record.status === "present"
                              ? "border-0 bg-[var(--cc-sem-success)]/10 text-[var(--cc-sem-success)]"
                              : "border-0 bg-[var(--cc-sem-danger)]/10 text-[var(--cc-sem-danger)]"
                          }
                        >
                          {record.status}
                        </Badge>
                      </div>
                      <p className={cn("mb-1 text-sm", PORTAL_TEXT_MUTED)}>{record.classTitle}</p>
                      <div className={cn("flex flex-wrap items-center gap-3 text-xs", PORTAL_TEXT_MUTED)}>
                        <span>Deleted: {formatCentralDate(record.deletedAt)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {hoursLeft.toFixed(1)}h left to recover
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRecover(record.id)}
                      disabled={recovering === record.id}
                      size="sm"
                      className={cn("shrink-0", chrome.success)}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      {recovering === record.id ? "Recovering..." : "Recover"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
        </FacultyAttendancePanel>
      )}

      {expiredRecords.length > 0 && (
        <FacultyAttendancePanel
          title={`${expiredRecords.length} expired`}
        >
            <div className="-mx-3 -mb-3 divide-y divide-[var(--border)] overflow-hidden sm:-mx-4 sm:-mb-4">
              {expiredRecords.map((record, index) => {
                const stripe = portalListStripe(index, chrome.theme.family);
                return (
                <motion.div
                  key={record.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 px-4 py-2.5 opacity-70 sm:px-5"
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl", stripe.iconBg)}>
                    <Trash2 className={cn("h-4 w-4", stripe.iconText)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn("font-semibold", PORTAL_TEXT_MUTED)}>{record.studentName}</span>
                      <Badge variant="outline">{record.studentNumber}</Badge>
                      <Badge variant="outline">{record.section}</Badge>
                    </div>
                    <p className={cn("mb-1 text-sm", PORTAL_TEXT_MUTED)}>{record.classTitle}</p>
                    <p className={cn("text-xs", PORTAL_TEXT_MUTED)}>
                      Deleted: {formatCentralDate(record.deletedAt)} (More than 24 hours ago)
                    </p>
                  </div>
                </motion.div>
                );
              })}
            </div>
        </FacultyAttendancePanel>
      )}

      {!loading && filteredRecords.length === 0 && expiredRecords.length === 0 && (
        <FacultyAttendancePanel title="Trash">
          <div className="py-8 text-center">
            <div className={cn("mx-auto mb-3", chrome.iconBadge())}>
              <Trash2 className="h-5 w-5 !text-white" />
            </div>
            <p className={cn("font-medium", PORTAL_TEXT)}>Trash is empty</p>
            <p className={cn("mt-1 text-sm", PORTAL_TEXT_MUTED)}>Deleted attendance records will appear here</p>
          </div>
        </FacultyAttendancePanel>
      )}
    </div>
  );
}
