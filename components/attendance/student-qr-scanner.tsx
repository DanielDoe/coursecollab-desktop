"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, MapPin, CheckCircle, Loader2, Camera, Shield, AlertCircle, XCircle, Clock, Info, X, ZoomIn, ZoomOut, Lightbulb, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getStudentData } from "@/lib/auth";
import { StudentFallbackModal } from "./student-fallback-modal";
import { useToast } from "@/hooks/use-toast";
import { ensureLocation } from "@/lib/location-utils";
import { CC_MODAL_SCRIM, CC_MODAL_SURFACE } from "@/lib/appearance/modal-ui";
import { cn } from "@/lib/utils";

interface StudentQRScannerProps {
  studentId: string;
  onSuccess: () => void;
  onClose: () => void;
}

interface SuccessModalProps {
  isOpen: boolean;
  points: number;
  geoVerified: boolean;
  onClose: () => void;
}

interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onRetry?: () => void;
  showRetry?: boolean;
  buttonText?: string;
}

// Success Modal Component
function SuccessModal({ isOpen, points, geoVerified, onClose }: SuccessModalProps) {
  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("z-[200]", CC_MODAL_SCRIM)}
            onClick={handleBackdropClick}
            onTouchStart={handleBackdropClick}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none"
            onClick={handleModalClick}
            onTouchStart={handleModalClick}
          >
            <div 
              className={cn(
                "rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8 border-2 border-green-200 dark:border-green-800 pointer-events-auto",
                CC_MODAL_SURFACE,
              )}
              onClick={handleModalClick}
              onTouchStart={handleModalClick}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg"
                >
                  <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                </motion.div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    ✅ Attendance Recorded!
                  </h3>
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
                    You earned <span className="font-bold text-green-600 dark:text-green-400">{points} points</span>!
                  </p>
                  {geoVerified && (
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-center gap-1">
                      <MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      Location verified
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleClose}
                  onTouchEnd={handleClose}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 text-white touch-manipulation"
                  size="lg"
                  type="button"
                >
                  Continue
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Error Modal Component
function ErrorModal({ isOpen, title, message, onClose, onRetry, showRetry = true, buttonText = "Try Again" }: ErrorModalProps) {
  const handleButtonClick = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (showRetry && onRetry) {
      // Call retry - it will handle closing the modal
      await onRetry();
    } else {
      // For dismiss button (already recorded, etc.), just close
      onClose();
    }
  };

  const handleClose = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  const handleModalClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("z-[200]", CC_MODAL_SCRIM)}
            onClick={handleBackdropClick}
            onTouchStart={handleBackdropClick}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-[201] flex items-center justify-center p-4 pointer-events-none overflow-y-auto"
            onClick={handleModalClick}
            onTouchStart={handleModalClick}
          >
            <div 
              className={cn(
                "rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] my-auto border-2 border-red-200 dark:border-red-800 pointer-events-auto flex flex-col",
                CC_MODAL_SURFACE,
              )}
              onClick={handleModalClick}
              onTouchStart={handleModalClick}
            >
              {/* Header with X button */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-red-100 dark:border-red-900 flex-shrink-0">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  {title}
                </h3>
                <Button
                  onClick={handleClose}
                  onTouchEnd={handleClose}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 touch-manipulation"
                  type="button"
                >
                  <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </Button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg flex-shrink-0"
                  >
                    <XCircle className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                  </motion.div>
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
                    {message}
                  </p>
                </div>
              </div>

              {/* Footer with action button */}
              <div className="p-4 sm:p-6 border-t border-red-100 dark:border-red-900 flex-shrink-0">
                <Button
                  onClick={handleButtonClick}
                  onTouchEnd={handleButtonClick}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 active:from-red-800 active:to-red-900 text-white touch-manipulation"
                  size="lg"
                  type="button"
                >
                  {buttonText}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function StudentQRScanner({ studentId, onSuccess, onClose }: StudentQRScannerProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [location, setLocation] = useState<{lat: number; long: number} | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationObtained, setLocationObtained] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const [locationPermission, setLocationPermission] = useState<"prompt" | "granted" | "denied" | "checking">("checking");
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(true);
  const [successModal, setSuccessModal] = useState<{show: boolean; points: number; geoVerified: boolean}>({show: false, points: 0, geoVerified: false});
  const [errorModal, setErrorModal] = useState<{show: boolean; title: string; message: string}>({show: false, title: "", message: ""});
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRunningRef = useRef<boolean>(false);
  const qrBoxId = "qr-reader";
  const streamRef = useRef<MediaStream | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [maxZoom, setMaxZoom] = useState(1);
  const [showFallbackButton, setShowFallbackButton] = useState(true); // Always show fallback button
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [sessionRequiresLocation, setSessionRequiresLocation] = useState(false);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const cameraStatus = await navigator.permissions.query({ name: "camera" as PermissionName });
          setCameraPermission(cameraStatus.state === "granted" ? "granted" : cameraStatus.state === "denied" ? "denied" : "prompt");
          
          cameraStatus.onchange = () => {
            setCameraPermission(cameraStatus.state === "granted" ? "granted" : cameraStatus.state === "denied" ? "denied" : "prompt");
          };
        } catch (e) {
          setCameraPermission("prompt");
        }

        try {
          const geoStatus = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          const geoState = geoStatus.state === "granted" ? "granted" : geoStatus.state === "denied" ? "denied" : "prompt";
          setLocationPermission(geoState);
          
          // If already granted, try to get location
          if (geoState === "granted" && !location) {
            // Don't auto-request, let user click button
          }
          
          geoStatus.onchange = () => {
            const newState = geoStatus.state === "granted" ? "granted" : geoStatus.state === "denied" ? "denied" : "prompt";
            setLocationPermission(newState);
            if (newState === "granted" && !location) {
              // Auto-request location when permission changes to granted
              requestLocation();
            }
          };
        } catch (e) {
          setLocationPermission("prompt");
        }
      } else {
        setCameraPermission("prompt");
        setLocationPermission("prompt");
      }
    };

    checkPermissions();
  }, []);

  // Function to request camera permission
  const requestCameraPermission = async () => {
    setCameraPermission("checking");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermission("granted");
    } catch (error: any) {
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setCameraPermission("denied");
      } else {
        setCameraPermission("prompt");
      }
    }
  };

  // Function to request location with improved error handling
  const requestLocation = async () => {
    if (!navigator.geolocation) {
      setLocationPermission("denied");
      toast({
        title: "Location Not Supported",
        description: "Your browser does not support geolocation. Please use a different device or browser.",
        variant: "destructive",
      });
      return;
    }

    setLocationLoading(true);
    setLocationObtained(false);
    setLocationPermission("checking");
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        // Use getCurrentPosition directly - it handles timeout internally
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve(pos);
          },
          (err) => {
            reject(err);
          },
          {
            enableHighAccuracy: true,
            timeout: 20000, // 20 second timeout
            maximumAge: 0 // Always get fresh location
          }
        );
      });

      setLocation({
        lat: position.coords.latitude,
        long: position.coords.longitude,
      });
      setLocationPermission("granted");
      setLocationLoading(false);
      
      // Show success state briefly
      setLocationObtained(true);
      toast({
        title: "Location Obtained",
        description: "Location services enabled successfully.",
      });
      setTimeout(() => {
        setLocationObtained(false);
      }, 2000);
    } catch (error: any) {
      setLocationLoading(false);
      
      // Handle different error codes
      let errorMessage = "Failed to get location";
      let permissionState: "prompt" | "denied" = "prompt";
      
      if (error.code === 1) {
        // PERMISSION_DENIED
        permissionState = "denied";
        errorMessage = "Location permission denied. Please click the lock icon in your browser's address bar, change location permission to 'Allow', then click 'Retry Location'.";
      } else if (error.code === 2) {
        // POSITION_UNAVAILABLE
        permissionState = "prompt";
        errorMessage = "Location unavailable. Please check your device's location settings and ensure GPS is enabled.";
      } else if (error.code === 3) {
        // TIMEOUT
        permissionState = "prompt";
        errorMessage = "Location request timed out. Please ensure your device's location is enabled and try again.";
      } else if (error.message?.includes("timeout")) {
        permissionState = "prompt";
        errorMessage = "Location request timed out. Please ensure your device's location is enabled and try again.";
      }
      
      setLocationPermission(permissionState);
      
      // Only show toast if not already showing error modal
      if (!errorModal.show) {
        toast({
          title: "Location Error",
          description: errorMessage,
          variant: "destructive",
          duration: 6000, // Show longer for important errors
        });
      }
    }
  };

  // Request location automatically when starting scanning ONLY if required
  // Note: We don't know if location is required until we scan QR code, so we'll request it conditionally
  useEffect(() => {
    // Only auto-request location if we know it's required
    // Otherwise, wait until QR scan to check session requirements
    if (!showPermissionPrompt && cameraPermission === "granted" && !location && !locationLoading) {
      // Don't auto-request - wait for session data
    }
  }, [showPermissionPrompt, cameraPermission]);

  // Initialize scanner after permissions are granted
  useEffect(() => {
    if (showPermissionPrompt) return;
    if (cameraPermission !== "granted") return;

    let mounted = true;
    let scanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        let retries = 20;
        while (retries > 0 && mounted) {
          const element = document.getElementById(qrBoxId);
          if (element) break;
          await new Promise(resolve => setTimeout(resolve, 100));
          retries--;
        }

        if (!mounted || retries === 0) return;

        scanner = new Html5Qrcode(qrBoxId);
        scannerRef.current = scanner;

        const cameras = await Html5Qrcode.getCameras();
        if (cameras.length === 0) {
          throw new Error("No cameras found");
        }

        let preferredCameraId = cameras[0].id;
        for (const camera of cameras) {
          const label = camera.label.toLowerCase();
          if (label.includes("back") || label.includes("environment") || label.includes("rear")) {
            preferredCameraId = camera.id;
            break;
          }
        }

        await scanner.start(
          preferredCameraId,
          {
            fps: 30, // Higher FPS for better scanning
            qrbox: { width: 300, height: 300 }, // Larger scan area
            aspectRatio: 1.0,
            videoConstraints: {
              width: { ideal: 1920 },
              height: { ideal: 1080 },
              facingMode: "environment",
            },
          },
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        );

        // Get the stream from scanner for zoom/torch controls
        setTimeout(() => {
          try {
            const videoElement = document.querySelector(`#${qrBoxId} video`) as HTMLVideoElement;
            if (videoElement && videoElement.srcObject) {
              streamRef.current = videoElement.srcObject as MediaStream;
              const track = streamRef.current.getVideoTracks()[0];
              const capabilities = track.getCapabilities();
              if (capabilities.zoom) {
                setMaxZoom(capabilities.zoom.max || 4);
              }
            }
          } catch (e) {
            console.log("Could not access stream for zoom/torch:", e);
          }
        }, 500);

        scannerRunningRef.current = true;
        setScanning(true);
        // Always show fallback button - don't hide it
        setShowFallbackButton(true);
      } catch (error: any) {
        if (error?.message?.includes("Permission") || error?.message?.includes("NotAllowedError")) {
          setCameraPermission("denied");
        }
      }
    };

    initScanner();

    return () => {
      mounted = false;
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
      }
      if (scanner && scannerRunningRef.current) {
        scannerRunningRef.current = false;
        scanner.stop().catch(() => {
          // Ignore errors when stopping scanner during cleanup
        });
        scanner.clear().catch(() => {
          // Ignore errors when clearing scanner during cleanup
        });
      }
    };
  }, [showPermissionPrompt, cameraPermission]);

  const handleScanSuccess = async (decodedText: string) => {
    if (processing) return;
    
    // Clear fallback timeout
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    
    setScanning(false);
    setProcessing(true);
    setShowFallbackButton(false);
    
    try {
      if (scannerRef.current && scannerRunningRef.current) {
        scannerRunningRef.current = false;
        try {
          await scannerRef.current.stop();
        } catch (stopError: any) {
          // Ignore "scanner is not running" errors
          if (!stopError?.message?.includes("not running") && !stopError?.message?.includes("not started")) {
          }
        }
        try {
          await scannerRef.current.clear();
        } catch (clearError: any) {
          // Ignore clear errors
        }
      }

      const qrData = parseQRCode(decodedText);
      if (!qrData) {
        setErrorModal({
          show: true,
          title: "Invalid QR Code",
          message: "The scanned QR code is not valid. Please scan the correct QR code displayed by your instructor or try a fallback method."
        });
        setProcessing(false);
        setScanning(true);
        return;
      }

      // Store session ID for fallback modal
      const sessionIdNum = parseInt(qrData.sessionId);
      setCurrentSessionId(sessionIdNum);

      // Fetch session data to check if location is required
      let requiresLocation = false;
      try {
        const sessionRes = await fetch(`/api/attendance/sessions?sessionId=${sessionIdNum}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData.sessions && sessionData.sessions.length > 0) {
            requiresLocation = sessionData.sessions[0].require_location === true;
            setSessionRequiresLocation(requiresLocation);
          }
        }
      } catch (e) {
        console.error("Failed to fetch session data:", e);
      }

      const student = getStudentData();
      
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };
      
      if (student) {
        headers["x-student-id"] = student.databaseId;
        headers["x-student-session"] = student.section;
      }

      // Ensure location coordinates are obtained ONLY if required
      let currentLocation = location;
      if (requiresLocation) {
        if (!currentLocation || !currentLocation.lat || !currentLocation.long) {
          setLocationLoading(true);
          try {
            const position = await ensureLocation();
            
            currentLocation = {
              lat: position.coords.latitude,
              long: position.coords.longitude,
            };
            
            setLocation(currentLocation);
            setLocationPermission("granted");
          } catch (error: any) {
            setLocationLoading(false);
            setErrorModal({
              show: true,
              title: "Location Required",
              message: "Location is required for this session. Please enable location services and try again."
            });
            setProcessing(false);
            setScanning(true);
            return;
          } finally {
            setLocationLoading(false);
          }
        }
      }

      const response = await fetch("/api/attendance/mark", {
        method: "POST",
        headers,
        body: JSON.stringify({
          studentId,
          sessionId: qrData.sessionId,
          qrCode: decodedText,
          checkInLat: requiresLocation ? (currentLocation?.lat || null) : null,
          checkInLong: requiresLocation ? (currentLocation?.long || null) : null,
          checkInMethod: "qr",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Show success modal
        setSuccessModal({
          show: true,
          points: data.points || 1,
          geoVerified: data.geoVerified || false
        });
        
        // Close scanner and call onSuccess after modal closes
        setTimeout(() => {
          setSuccessModal({ show: false, points: 0, geoVerified: false });
          onSuccess();
        }, 2000);
      } else {
        // Handle specific error cases with user-friendly messages
        let errorTitle = "Attendance Failed";
        let errorMessage = data.error || "Failed to mark attendance";
        
        if (errorMessage.includes("already recorded") || errorMessage.includes("already marked")) {
          errorTitle = "Already Recorded";
          errorMessage = "You have already marked attendance for this session using QR scan or code entry. Attendance can only be recorded once per session.";
          // Don't show retry for already recorded - just dismiss
          setErrorModal({
            show: true,
            title: errorTitle,
            message: errorMessage,
            showRetry: false,
            buttonText: "Dismiss"
          });
          setProcessing(false);
          return;
        } else if (errorMessage.includes("window has closed") || errorMessage.includes("expired")) {
          errorTitle = "Attendance Window Closed";
          errorMessage = "The attendance window for this session has closed. Please contact your instructor if you believe this is an error.";
        } else if (errorMessage.includes("not within") || errorMessage.includes("radius") || errorMessage.includes("away from")) {
          errorTitle = "Location Out of Range";
          // Use the detailed error message from the API which includes distance and radius
          errorMessage = data.error || `You are not within the allowed area to mark attendance. ${data.distance ? `You are ${data.distance}m away from the class location. The allowed radius is ${data.required || 'unknown'}m.` : 'Please move to the class location and try again.'}`;
        } else if (errorMessage.includes("Location is required")) {
          errorTitle = "Location Required";
          errorMessage = "Location is required for this session. Please enable location services and try again.";
        } else if (errorMessage.includes("not enrolled")) {
          errorTitle = "Not Enrolled";
          errorMessage = "You are not enrolled in this section. Please contact your instructor.";
        } else if (errorMessage.includes("Invalid") || errorMessage.includes("expired QR")) {
          errorTitle = "Invalid QR Code";
          errorMessage = "This QR code is invalid or has expired. Please ask your instructor for a new QR code.";
        }

        // Store error info for retry
        const isLocationError = errorMessage.includes("not within") || 
                                errorMessage.includes("radius") ||
                                errorMessage.includes("Location is required");
        
        setErrorModal({
          show: true,
          title: errorTitle,
          message: errorMessage,
          showRetry: true,
          buttonText: "Try Again"
        });
        
        setProcessing(false);
        
        // For non-location errors, restart scanner automatically
        // For location errors, let the retry button handle it
        if (!isLocationError && scannerRef.current && cameraPermission === "granted") {
          try {
            const cameras = await Html5Qrcode.getCameras();
            let preferredCameraId = cameras[0].id;
            for (const camera of cameras) {
              const label = camera.label.toLowerCase();
              if (label.includes("back") || label.includes("environment") || label.includes("rear")) {
                preferredCameraId = camera.id;
                break;
              }
            }
            await scannerRef.current.start(
              preferredCameraId,
              {
                fps: 30,
                qrbox: { width: 300, height: 300 },
                aspectRatio: 1.0,
                videoConstraints: {
                  width: { ideal: 1920 },
                  height: { ideal: 1080 },
                  facingMode: "environment",
                },
              },
              (decodedText) => {
                handleScanSuccess(decodedText);
              },
              () => {}
            );

            // Get the stream from scanner for zoom/torch controls
            try {
              const videoElement = document.querySelector(`#${qrBoxId} video`) as HTMLVideoElement;
              if (videoElement && videoElement.srcObject) {
                streamRef.current = videoElement.srcObject as MediaStream;
                const track = streamRef.current.getVideoTracks()[0];
                const capabilities = track.getCapabilities();
                if (capabilities.zoom) {
                  setMaxZoom(capabilities.zoom.max || 4);
                }
              }
            } catch (e) {
              console.log("Could not access stream for zoom/torch:", e);
            }
            scannerRunningRef.current = true;
            setScanning(true);
          } catch (e) {
            // Failed to restart
          }
        }
      }
    } catch (error: any) {
      setErrorModal({
        show: true,
        title: "Scan Error",
        message: error.message || "Failed to process QR code. Please try again."
      });
      setProcessing(false);
      setScanning(true);
      
      // Restart scanner
      if (scannerRef.current && cameraPermission === "granted") {
        try {
          const cameras = await Html5Qrcode.getCameras();
          let preferredCameraId = cameras[0].id;
          for (const camera of cameras) {
            const label = camera.label.toLowerCase();
            if (label.includes("back") || label.includes("environment") || label.includes("rear")) {
              preferredCameraId = camera.id;
              break;
            }
          }
          // Get camera stream with high resolution
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: preferredCameraId },
              facingMode: "environment",
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          });
          streamRef.current = stream;

          // Get zoom capabilities
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities();
          if (capabilities.zoom) {
            setMaxZoom(capabilities.zoom.max || 4);
          }

          await scannerRef.current.start(
            preferredCameraId,
            {
              fps: 30,
              qrbox: { width: 300, height: 300 },
              aspectRatio: 1.0,
              videoConstraints: {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
              },
            },
            (decodedText) => {
              handleScanSuccess(decodedText);
            },
            () => {}
          );
          scannerRunningRef.current = true;
          setScanning(true);
        } catch (e) {
          // Failed to restart
          scannerRunningRef.current = false;
        }
      }
    }
  };

  function parseQRCode(qrText: string) {
    try {
      const parts = qrText.split('_');
      if (parts[0] !== 'ATTEND' || parts.length < 3) {
        return null;
      }
      return {
        sessionId: parts[1],
        section: parts[2],
        timestamp: parts[3],
      };
    } catch {
      return null;
    }
  }

  // Zoom controls
  const handleZoomIn = async () => {
    if (streamRef.current && zoomLevel < maxZoom) {
      const track = streamRef.current.getVideoTracks()[0];
      const newZoom = Math.min(zoomLevel + 0.5, maxZoom);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
        setZoomLevel(newZoom);
      } catch (error) {
        console.error("Failed to zoom in:", error);
      }
    }
  };

  const handleZoomOut = async () => {
    if (streamRef.current && zoomLevel > 1) {
      const track = streamRef.current.getVideoTracks()[0];
      const newZoom = Math.max(zoomLevel - 0.5, 1);
      try {
        await track.applyConstraints({
          advanced: [{ zoom: newZoom }],
        });
        setZoomLevel(newZoom);
      } catch (error) {
        console.error("Failed to zoom out:", error);
      }
    }
  };

  // Torch/flashlight control
  const toggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if (capabilities.torch) {
        try {
          await track.applyConstraints({
            advanced: [{ torch: !torchEnabled }],
          });
          setTorchEnabled(!torchEnabled);
        } catch (error) {
          console.error("Failed to toggle torch:", error);
        }
      }
    }
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Cleanup function to stop scanner when dialog closes
  const handleDialogClose = async (open: boolean) => {
    if (!open) {
      // Stop scanner and cleanup
      if (scannerRef.current && scannerRunningRef.current) {
        scannerRunningRef.current = false;
        try {
          await scannerRef.current.stop();
        } catch (stopError: any) {
          // Ignore "scanner is not running" errors
          if (!stopError?.message?.includes("not running") && !stopError?.message?.includes("not started")) {
            console.error("Error stopping scanner:", stopError);
          }
        }
        try {
          await scannerRef.current.clear();
        } catch (clearError: any) {
          // Ignore clear errors
          console.error("Error clearing scanner:", clearError);
        }
      }
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Clear any pending timeouts
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      
      // Call the original onClose
      onClose();
    }
  };

  return (
    <>
      <Dialog open onOpenChange={handleDialogClose}>
        <DialogContent 
          className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden sm:max-w-lg" 
          aria-describedby="qr-scanner-description"
          showCloseButton={false}
        >
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 flex-shrink-0 border-b bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl">
                <QrCode className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                <span className="truncate">Scan QR Code</span>
              </DialogTitle>
              <Button
                onClick={() => handleDialogClose(false)}
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 touch-manipulation"
                type="button"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-3 sm:py-4 min-h-0">
            <div id="qr-scanner-description" className="sr-only">
              Scan the QR code displayed by your instructor to mark your attendance
            </div>

            <div className="space-y-4">
            {/* Permission Request Section */}
            {showPermissionPrompt && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Alert className="border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                  <AlertDescription className="space-y-2 sm:space-y-3">
                    <div>
                      <strong className="text-sm sm:text-base block">🔒 Permissions Required</strong>
                      <p className="text-xs sm:text-sm mt-1">To scan QR codes and mark attendance, we need access to your camera. Location may be required depending on your instructor's settings.</p>
                    </div>
                    
                    {/* Camera Permission */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <Camera className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm">Camera Access</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Needed to scan QR codes</p>
                          {cameraPermission === "granted" && (
                            <div className="flex items-center gap-1 mt-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">Granted</span>
                            </div>
                          )}
                          {cameraPermission === "denied" && (
                            <div className="flex items-center gap-1 mt-1 text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs">Denied - Click button to retry</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={requestCameraPermission}
                        disabled={cameraPermission === "checking" || cameraPermission === "granted"}
                        size="sm"
                        variant={cameraPermission === "granted" ? "outline" : "default"}
                        className="flex-shrink-0 w-full sm:w-auto touch-manipulation"
                      >
                        {cameraPermission === "checking" ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Checking...
                          </>
                        ) : cameraPermission === "granted" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-2" />
                            Allowed
                          </>
                        ) : (
                          <>
                            <Camera className="h-3 w-3 mr-2" />
                            Allow Camera
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Location Permission - Optional unless required by session */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-2.5 sm:p-3 bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-xs sm:text-sm">Location Access</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Optional - May be required depending on session settings</p>
                          {locationPermission === "granted" && (
                            <div className="flex items-center gap-1 mt-1 text-green-600 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-xs font-medium">Granted</span>
                            </div>
                          )}
                          {locationPermission === "denied" && (
                            <div className="flex items-center gap-1 mt-1 text-red-600 dark:text-red-400">
                              <AlertCircle className="h-3 w-3" />
                              <span className="text-xs">Denied - Click button to retry</span>
                            </div>
                          )}
                          {locationLoading && (
                            <div className="flex items-center gap-1 mt-1 text-blue-600 dark:text-blue-400">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span className="text-xs">Requesting...</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={requestLocation}
                        disabled={locationPermission === "checking" || locationLoading || locationPermission === "granted"}
                        size="sm"
                        variant={locationPermission === "granted" ? "outline" : "default"}
                        className="flex-shrink-0 w-full sm:w-auto touch-manipulation"
                      >
                        {locationLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Requesting...
                          </>
                        ) : locationPermission === "granted" ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-2" />
                            Allowed
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3 w-3 mr-2" />
                            Allow Location
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Continue Button */}
                    {cameraPermission === "granted" && (
                      <Button
                        onClick={() => {
                          // Location will be requested after QR scan if required
                          // For now, just proceed to scanning
                          setShowPermissionPrompt(false);
                        }}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white touch-manipulation"
                        size="lg"
                      >
                        <QrCode className="h-4 w-4 mr-2" />
                        Start Scanning
                      </Button>
                    )}

                    {cameraPermission === "denied" && (
                      <Alert className="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          <strong>Camera permission denied.</strong> Please click "Allow Camera" above and select "Allow" when your browser prompts you.
                        </AlertDescription>
                      </Alert>
                    )}
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Scanner Section */}
            {!showPermissionPrompt && (
              <>
                {/* Location Status - Improved UX */}
                {locationLoading ? (
                  <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription className="flex items-center gap-2">
                      <span className="font-medium">📍 Obtaining location...</span>
                    </AlertDescription>
                  </Alert>
                ) : locationObtained ? (
                  <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="flex items-center gap-2">
                      <span className="font-medium">✅ Location obtained successfully. Proceed to scan.</span>
                    </AlertDescription>
                  </Alert>
                ) : location ? (
                  <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200">
                    <MapPin className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">✅ Location ready. You can now scan the QR code.</span>
                    </AlertDescription>
                  </Alert>
                ) : locationPermission === "denied" ? (
                  <Alert className="border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200">
                    <MapPin className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <div className="text-sm">
                        <strong>⚠️ Location Access Denied:</strong> Location permission was denied. To enable:
                        <ol className="list-decimal list-inside mt-2 space-y-1 text-xs">
                          <li>Click the browser's lock icon in the address bar</li>
                          <li>Change location permission to "Allow"</li>
                          <li>Click "Retry Location" below or refresh the page</li>
                        </ol>
                      </div>
                      <Button
                        onClick={requestLocation}
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full sm:w-auto touch-manipulation"
                        disabled={locationLoading}
                      >
                        {locationLoading ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                            Requesting...
                          </>
                        ) : (
                          <>
                            <MapPin className="h-3 w-3 mr-2" />
                            Retry Location
                          </>
                        )}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {/* QR Scanner */}
                <div className="relative">
                  {/* Zoom and Torch Controls */}
                  {scanning && streamRef.current && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-20 flex flex-col gap-2">
                      {/* Zoom Controls */}
                      {maxZoom > 1 && (
                        <div className="flex flex-col gap-1 bg-black/60 backdrop-blur-sm rounded-lg p-1">
                          <Button
                            onClick={handleZoomIn}
                            disabled={zoomLevel >= maxZoom}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-white hover:bg-white/20 touch-manipulation"
                            type="button"
                          >
                            <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                          <div className="text-[10px] sm:text-xs text-white text-center px-0.5 sm:px-1">
                            {zoomLevel.toFixed(1)}x
                          </div>
                          <Button
                            onClick={handleZoomOut}
                            disabled={zoomLevel <= 1}
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-white hover:bg-white/20 touch-manipulation"
                            type="button"
                          >
                            <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {/* Torch Control */}
                      {streamRef.current.getVideoTracks()[0]?.getCapabilities().torch && (
                        <Button
                          onClick={toggleTorch}
                          size="sm"
                          variant={torchEnabled ? "default" : "ghost"}
                          className={`h-9 w-9 sm:h-10 sm:w-10 p-0 touch-manipulation ${torchEnabled ? "bg-yellow-500 hover:bg-yellow-600" : "bg-black/60 backdrop-blur-sm text-white hover:bg-white/20"}`}
                          type="button"
                        >
                          <Lightbulb className={`h-4 w-4 sm:h-5 sm:w-5 ${torchEnabled ? "fill-white" : ""}`} />
                        </Button>
                      )}
                    </div>
                  )}
                  
                  <AnimatePresence>
                    {processing && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="flex flex-col items-center gap-4"
                        >
                          <motion.div
                            animate={{
                              scale: [1, 1.2, 1],
                              rotate: [0, 360],
                            }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                            }}
                          >
                            <Loader2 className="h-16 w-16 sm:h-20 sm:w-20 text-blue-500 animate-spin" />
                          </motion.div>
                          <p className="text-base sm:text-lg font-semibold text-blue-600 text-center px-4">
                            Processing Attendance...
                          </p>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!scanning && !processing && (
                    <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-slate-100 dark:bg-slate-800 rounded-lg min-h-[200px] sm:min-h-[300px]">
                      <Camera className="h-12 w-12 sm:h-16 sm:w-16 text-slate-400 mb-3 sm:mb-4" />
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Initializing camera...</p>
                    </div>
                  )}

                  <div id={qrBoxId} className="rounded-lg overflow-hidden" />
                </div>

                {/* Instructions */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">
                    📱 How to scan:
                  </h4>
                  <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>• Point your camera at the QR code</li>
                    <li>• Hold steady until the scan completes</li>
                    <li>• Ensure you're within the class area (if location required)</li>
                    <li>• You'll earn 1 point per attendance!</li>
                  </ul>
                  
                  {/* Trouble Scanning Button */}
                  <Button
                    onClick={() => {
                      // Try to get session ID - if we have it from QR scan, use it
                      // Otherwise, fetch active sessions for student's section
                      if (currentSessionId) {
                        setShowFallbackModal(true);
                      } else {
                        // Fetch active session for student's section
                        const student = getStudentData();
                        if (student?.section) {
                          fetch(`/api/attendance/sessions?section=${student.section}&isActive=true`)
                            .then(res => res.json())
                            .then(data => {
                              if (data.sessions && data.sessions.length > 0) {
                                setCurrentSessionId(data.sessions[0].id);
                                setShowFallbackModal(true);
                              } else {
                                toast({
                                  title: "No Active Session",
                                  description: "There are no active attendance sessions for your section.",
                                  variant: "destructive",
                                });
                              }
                            })
                            .catch(() => {
                              toast({
                                title: "Error",
                                description: "Could not load fallback options",
                                variant: "destructive",
                              });
                            });
                        } else {
                          toast({
                            title: "Error",
                            description: "Unable to determine your section",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    variant="outline"
                    className="w-full mt-3 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 touch-manipulation"
                  >
                    <HelpCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Trouble Scanning? Enter Attendance Code</span>
                  </Button>
                </div>
              </>
            )}

            <Button
              onClick={onClose}
              variant="outline"
              className="w-full touch-manipulation"
            >
              Cancel
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.show}
        points={successModal.points}
        geoVerified={successModal.geoVerified}
        onClose={() => {
          setSuccessModal({ show: false, points: 0, geoVerified: false });
          onSuccess();
        }}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={errorModal.show}
        title={errorModal.title}
        message={errorModal.message}
        showRetry={errorModal.showRetry !== false}
        buttonText={errorModal.buttonText || "Try Again"}
        onClose={() => {
          setErrorModal({ show: false, title: "", message: "", showRetry: true, buttonText: "Try Again" });
        }}
        onRetry={async () => {
          // Close the error modal first
          setErrorModal({ show: false, title: "", message: "", showRetry: true, buttonText: "Try Again" });
          
          // Reset location if it was an out-of-range error or location permission error
          const isLocationError = errorModal.message.includes("not within") || 
                                  errorModal.message.includes("radius") ||
                                  errorModal.message.includes("Location is required") ||
                                  errorModal.message.includes("location services");
          
          if (isLocationError) {
            // Clear current location and re-request
            setLocation(null);
            setLocationObtained(false);
            setLocationPermission("prompt");
            setLocationLoading(true);
            try {
              await requestLocation();
            } catch (e) {
              setLocationLoading(false);
            }
          }
          
          // Restart scanner
          if (scannerRef.current && cameraPermission === "granted") {
            try {
              // Stop current scanner if running
              if (scannerRunningRef.current) {
                scannerRunningRef.current = false;
                try {
                  await scannerRef.current.stop();
                } catch (e) {
                  // Ignore stop errors
                }
                try {
                  await scannerRef.current.clear();
                } catch (e) {
                  // Ignore clear errors
                }
              }
              
              // Small delay to ensure scanner is fully stopped
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Get cameras and start scanner
              const cameras = await Html5Qrcode.getCameras();
              if (cameras.length === 0) {
                throw new Error("No cameras available");
              }
              
              let preferredCameraId = cameras[0].id;
              for (const camera of cameras) {
                const label = camera.label.toLowerCase();
                if (label.includes("back") || label.includes("environment") || label.includes("rear")) {
                  preferredCameraId = camera.id;
                  break;
                }
              }
              
              await scannerRef.current.start(
                preferredCameraId,
                {
                  fps: 10,
                  qrbox: { width: 250, height: 250 },
                  aspectRatio: 1.0,
                },
                (decodedText) => {
                  handleScanSuccess(decodedText);
                },
                () => {}
              );
              
              scannerRunningRef.current = true;
              setScanning(true);
            } catch (e) {
              scannerRunningRef.current = false;
              // Show error if scanner restart fails
              setErrorModal({
                show: true,
                title: "Scanner Error",
                message: "Failed to restart camera. Please refresh the page and try again.",
                showRetry: false,
                buttonText: "Dismiss"
              });
            }
          } else if (cameraPermission !== "granted") {
            // If camera permission is not granted, show permission prompt again
            setShowPermissionPrompt(true);
          }
        }}
      />

      {/* Fallback Code Modal */}
      {showFallbackModal && currentSessionId && (
        <StudentFallbackModal
          isOpen={showFallbackModal}
          onClose={() => {
            setShowFallbackModal(false);
            setCurrentSessionId(null);
          }}
          onSuccess={() => {
            setShowFallbackModal(false);
            setCurrentSessionId(null);
            onSuccess();
          }}
          sessionId={currentSessionId}
          studentId={studentId}
        />
      )}
    </>
  );
}
