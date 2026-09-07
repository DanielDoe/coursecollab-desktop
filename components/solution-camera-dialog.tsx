"use client"



import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"

import {

  Dialog,

  DialogContent,

  DialogDescription,

  DialogFooter,

  DialogHeader,

  DialogTitle,

} from "@/components/ui/dialog"

import { Camera, Loader2, RefreshCw, X } from "lucide-react"

import { isMobileOrTablet, isSecureCameraContext } from "@/lib/solution-camera"



type SolutionCameraDialogProps = {

  open: boolean

  onOpenChange: (open: boolean) => void

  /** Resolve true when another photo may be captured (multi-page solutions). */

  onCapture: (file: File) => Promise<boolean>

  /** When true, keep dialog open after capture so student can add more pages. */

  allowMultiple?: boolean

}



export function SolutionCameraDialog({

  open,

  onOpenChange,

  onCapture,

  allowMultiple = false,

}: SolutionCameraDialogProps) {

  const videoRef = useRef<HTMLVideoElement>(null)

  const streamRef = useRef<MediaStream | null>(null)

  const [starting, setStarting] = useState(false)

  const [error, setError] = useState<string | null>(null)

  const [videoReady, setVideoReady] = useState(false)

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment")



  const stopStream = useCallback(() => {

    streamRef.current?.getTracks().forEach((t) => t.stop())

    streamRef.current = null

    if (videoRef.current) videoRef.current.srcObject = null

    setVideoReady(false)

  }, [])



  const bindStreamToVideo = useCallback(async (stream: MediaStream) => {

    const el = videoRef.current

    if (!el) return false

    el.srcObject = stream

    try {

      await el.play()

      setVideoReady(el.videoWidth > 0)

      return true

    } catch {

      return false

    }

  }, [])



  const startCamera = useCallback(async () => {

    if (!navigator.mediaDevices?.getUserMedia) {

      setError("Camera is not supported in this browser. Use Choose file instead.")

      setStarting(false)

      return

    }

    if (!isSecureCameraContext()) {

      setError("Camera requires a secure connection (HTTPS). Use Choose file instead.")

      setStarting(false)

      return

    }



    stopStream()

    setStarting(true)

    setError(null)

    setVideoReady(false)



    const isMobile = isMobileOrTablet()

    const tryConstraints: MediaTrackConstraints[] = [

      {

        facingMode: { ideal: facingMode },

        width: { ideal: isMobile ? 1280 : 1920 },

        height: { ideal: isMobile ? 720 : 1080 },

      },

      facingMode === "environment"

        ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }

        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },

      { width: { ideal: 640 }, height: { ideal: 480 } },

      true,

    ]



    for (const video of tryConstraints) {

      try {

        const stream = await navigator.mediaDevices.getUserMedia({

          video: typeof video === "boolean" ? video : video,

          audio: false,

        })

        streamRef.current = stream

        await bindStreamToVideo(stream)

        setStarting(false)

        return

      } catch {

        /* try next constraint */

      }

    }



    setError("Could not access the camera. Allow camera permission or use Choose file.")

    setStarting(false)

  }, [bindStreamToVideo, facingMode, stopStream])



  useEffect(() => {

    if (!open) {

      stopStream()

      setError(null)

      setStarting(false)

      return

    }



    // Defer until dialog content is mounted (iOS Safari).

    const id = requestAnimationFrame(() => {

      void startCamera()

    })



    return () => {

      cancelAnimationFrame(id)

      stopStream()

    }

  }, [open, facingMode, startCamera, stopStream])



  const [capturing, setCapturing] = useState(false)

  const handleCapture = () => {

    const video = videoRef.current

    if (!video || video.videoWidth === 0 || capturing) return



    const canvas = document.createElement("canvas")

    canvas.width = video.videoWidth

    canvas.height = video.videoHeight

    const ctx = canvas.getContext("2d")

    if (!ctx) return

    ctx.drawImage(video, 0, 0)

    canvas.toBlob(

      (blob) => {

        if (!blob) return

        const file = new File([blob], `solution-photo-${Date.now()}.jpg`, { type: "image/jpeg" })

        setCapturing(true)

        void onCapture(file)

          .then((canTakeMore) => {

            if (!allowMultiple || !canTakeMore) {

              onOpenChange(false)

            } else {

              void startCamera()

            }

          })

          .finally(() => setCapturing(false))

      },

      "image/jpeg",

      0.92,

    )

  }



  const switchCamera = () => {

    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))

  }



  return (

    <Dialog open={open} onOpenChange={onOpenChange}>

      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">

        <DialogHeader>

          <DialogTitle className="flex items-center gap-2">

            <Camera className="h-5 w-5" />

            Take photo of your solution

          </DialogTitle>

          <DialogDescription>

            Position your worked solution in the frame, then capture.

            {allowMultiple

              ? " You can take multiple photos for multi-page solutions."

              : " Works with webcam on laptop and camera on tablet/phone."}

          </DialogDescription>

        </DialogHeader>



        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950">

          {starting ? (

            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-slate-300">

              <Loader2 className="h-8 w-8 animate-spin" />

              <p className="text-sm">Starting camera…</p>

            </div>

          ) : null}

          {error ? (

            <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-sm text-red-300">

              {error}

            </div>

          ) : null}

          <video

            ref={videoRef}

            autoPlay

            playsInline

            muted

            onLoadedMetadata={() => setVideoReady(true)}

            className="h-full w-full object-cover"

          />

        </div>



        <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">

          <div className="flex w-full flex-wrap gap-2 sm:mr-auto">

            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>

              <X className="h-4 w-4 mr-1.5" />

              Cancel

            </Button>

            {!error ? (

              <Button type="button" variant="outline" size="sm" onClick={switchCamera} disabled={starting}>

                <RefreshCw className="h-4 w-4 mr-1.5" />

                Flip camera

              </Button>

            ) : null}

          </div>

          <Button

            type="button"

            onClick={handleCapture}

            disabled={starting || capturing || !!error || !videoReady}

          >

            <Camera className="h-4 w-4 mr-1.5" />

            {allowMultiple ? "Capture & add another" : "Capture photo"}

          </Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  )

}


