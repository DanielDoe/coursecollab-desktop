"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Hash,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getStudentData } from "@/lib/auth";
import { ensureLocation } from "@/lib/location-utils";

interface StudentFallbackModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  sessionId: number
  studentId: string
  requireLocation?: boolean
  sessionLabel?: string
}

export function StudentFallbackModal({
  isOpen,
  onClose,
  onSuccess,
  sessionId,
  studentId,
  requireLocation: requireLocationProp,
  sessionLabel,
}: StudentFallbackModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [sessionData, setSessionData] = useState<{ require_location?: boolean } | null>(null)
  const [fallbackCode, setFallbackCode] = useState("")

  useEffect(() => {
    if (isOpen && sessionId) {
      if (requireLocationProp != null) {
        setSessionData({ require_location: requireLocationProp })
      } else {
        void fetchSessionData()
      }
      setFallbackCode("")
    }
  }, [isOpen, sessionId, requireLocationProp])

  const fetchSessionData = async () => {
    try {
      const student = getStudentData()
      const headers: HeadersInit = {}
      if (student?.databaseId) headers["x-student-id"] = student.databaseId
      const response = await fetch("/api/attendance/student-sessions", {
        headers,
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        const match = (data.sessions ?? []).find((s: { id: number }) => s.id === sessionId)
        if (match) setSessionData({ require_location: match.requireLocation })
      }
    } catch (error) {
      console.error("Failed to fetch session data:", error)
    }
  }

  const handleSubmit = async () => {
    if (!fallbackCode.trim()) {
      toast({
        title: "Error",
        description: "Please enter the attendance code",
        variant: "destructive",
      });
      return;
    }

    await submitAttendance();
  };

  const submitAttendance = async () => {
    try {
      setLoading(true);
      const student = getStudentData();

      // Check if location is required
      const requiresLocation = sessionData?.require_location === true;

      // Get location ONLY if required
      let location = null;
      if (requiresLocation) {
        try {
          const position = await ensureLocation();
          location = {
            lat: position.coords.latitude,
            long: position.coords.longitude,
          };
        } catch (e) {
          toast({
            title: "Location Required",
            description: "Enable your device's location to mark attendance.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-student-id": student?.databaseId || studentId,
        },
        credentials: "include",
        body: JSON.stringify({
          studentId,
          sessionId,
          code: fallbackCode.toUpperCase(),
          checkInLat: requiresLocation ? (location?.lat || null) : null,
          checkInLong: requiresLocation ? (location?.long || null) : null,
          checkInMethod: "code",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Attendance marked successfully",
        });
        onSuccess();
        onClose();
      } else {
        // Check for duplicate attendance error
        if (data.error?.includes("already recorded") || data.error?.includes("already marked")) {
          toast({
            title: "Already Recorded",
            description: "You have already marked attendance for this session. Attendance can only be recorded once per session.",
            variant: "destructive",
          });
          onClose();
        } else if (data.error === "LOCATION_REQUIRED" || data.error?.includes("Location is required")) {
          toast({
            title: "Location Required",
            description: data.message || "Please enable location services and try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: data.error || "Failed to mark attendance",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit attendance code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader className="px-1 sm:px-0">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Hash className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
            <span className="truncate">{sessionLabel ?? "Enter Attendance Code"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4 px-1 sm:px-0">
          <div>
            <Label htmlFor="fallbackCode" className="text-sm sm:text-base">Attendance Code</Label>
            <Input
              id="fallbackCode"
              type="text"
              placeholder="Enter code (e.g., ABC9F3)"
              value={fallbackCode}
              onChange={(e) => {
                // Auto-uppercase and filter to alphanumeric
                const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setFallbackCode(value);
              }}
              maxLength={8}
              className="text-center text-xl sm:text-2xl font-mono tracking-wider mt-2 h-12 sm:h-14"
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading && fallbackCode.trim()) {
                  handleSubmit();
                }
              }}
            />
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-center sm:text-left">
              Enter the code shown on your instructor's screen
            </p>
          </div>

          {sessionData?.require_location && (
            <Alert className="text-xs sm:text-sm">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <AlertDescription className="text-xs sm:text-sm">
                Location services will be required to submit attendance.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full sm:w-auto order-2 sm:order-1 text-sm sm:text-base"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 order-1 sm:order-2 text-sm sm:text-base"
              disabled={loading || !fallbackCode.trim()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                  <span>Submitting...</span>
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
