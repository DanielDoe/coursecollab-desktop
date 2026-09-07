"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageSquare, Calendar, CheckCircle2 } from "lucide-react";
import { buildInstructorApiHeaders } from "@/lib/instructor-api-headers";

interface InstructorGradesFlaggedProps {
  instructorId: number;
  session?: string;
  dataRefreshKey?: number;
}

const FLAG_LABELS: Record<string, string> = {
  both: "Low attendance & grade",
  attendance: "Low attendance",
  grade: "Low grade",
};

export function InstructorGradesFlagged({ instructorId, session = "ALL", dataRefreshKey = 0 }: InstructorGradesFlaggedProps) {
  const [loading, setLoading] = useState(true);
  const [flaggedStudents, setFlaggedStudents] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ instructorId: String(instructorId), session });
    studentApiFetch(`/api/grades/flagged?${params}`, { headers: buildInstructorApiHeaders() })
      .then((r) => r.json())
      .then((data) => setFlaggedStudents(data.flaggedStudents || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [instructorId, session, dataRefreshKey]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 dark:border-amber-400 mx-auto" />
        <p className="mt-4 text-slate-600 dark:text-slate-400">Loading flagged students...</p>
      </div>
    );
  }

  return (
    <Card className="border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          Flagged Students
        </CardTitle>
        <CardDescription className="text-slate-600 dark:text-slate-400">
          Students at risk (attendance &lt; 70% and/or total &lt; 60%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {flaggedStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full p-4 bg-emerald-100 dark:bg-emerald-500/20 mb-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="font-medium text-slate-800 dark:text-slate-100">No students flagged</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              All students meet the attendance and grade thresholds.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-white/10">
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-white/10">
                  <TableHead className="text-slate-700 dark:text-slate-300">Student</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Section</TableHead>
                  <TableHead className="text-right text-slate-700 dark:text-slate-300">Attendance</TableHead>
                  <TableHead className="text-right text-slate-700 dark:text-slate-300">Total Score</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Reason</TableHead>
                  <TableHead className="text-slate-700 dark:text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flaggedStudents.map((student) => (
                  <TableRow key={student.student_id} className="border-slate-200 dark:border-white/10">
                    <TableCell className="font-medium text-slate-900 dark:text-slate-100">{student.full_name}</TableCell>
                    <TableCell className="text-slate-600 dark:text-slate-400">{student.section}</TableCell>
                    <TableCell className="text-right">{Number(student.attendance_score ?? 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{Number(student.total_score ?? 0).toFixed(1)}%</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="capitalize">
                        {FLAG_LABELS[student.flag_reason] || student.flag_reason}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 sm:gap-2">
                        <Button size="sm" variant="outline" className="text-xs" title="Message">
                          <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Message</span>
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs" title="Schedule">
                          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Schedule</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
