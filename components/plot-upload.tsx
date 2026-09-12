"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, Image as ImageIcon, FileImage, CheckCircle2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useAppConfirm } from "@/components/providers/app-confirm-provider"

interface PlotUploadProps {
  onUpload: (file: File, base64: string) => void
  onRemove: () => void
  uploadedImage?: string | null
  disabled?: boolean
  isLocked?: boolean
  /** quiz: AI grading copy. classroom: instructor review copy. */
  variant?: "quiz" | "classroom"
}

export function PlotUpload({ 
  onUpload, 
  onRemove, 
  uploadedImage, 
  disabled = false,
  isLocked = false,
  variant = "quiz",
}: PlotUploadProps) {
  const isClassroom = variant === "classroom"
  const [isDragging, setIsDragging] = useState(false)
  const { alert } = useAppConfirm()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Debug: Log when uploadedImage prop changes
  useEffect(() => {
    console.log("[PlotUpload] uploadedImage prop changed:", !!uploadedImage)
    if (uploadedImage) {
      console.log("[PlotUpload] Image data length:", uploadedImage.length)
      console.log("[PlotUpload] Image preview:", uploadedImage.substring(0, 50) + "...")
    }
  }, [uploadedImage])

  const handleFileSelect = async (file: File) => {
    console.log("[PlotUpload] File selected:", file.name, file.type, file.size)
    
    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      console.error("[PlotUpload] Invalid file type:", file.type)
      await alert({
        title: "Invalid file type",
        description: "Please upload an image file (PNG, JPEG, GIF, or WebP).",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      console.error("[PlotUpload] File too large:", file.size)
      await alert({
        title: "File too large",
        description: "File size must be less than 5MB.",
      })
      return
    }

    // Convert to base64 with compression to reduce size
    console.log("[PlotUpload] Converting to base64 with compression...")
    const reader = new FileReader()
    
    reader.onerror = (error) => {
      console.error("[PlotUpload] FileReader error:", error)
      void alert({
        title: "Could not read file",
        description: "Please try again.",
      })
    }
    
    reader.onload = (e) => {
      const originalBase64 = e.target?.result as string
      console.log("[PlotUpload] Original Base64 length:", originalBase64?.length || 0)
      
      // Compress image to reduce API payload size
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // Resize if image is too large (max 1200px on longest side)
        const maxDimension = 1200
        let width = img.width
        let height = img.height
        
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension
            width = maxDimension
          } else {
            width = (width / height) * maxDimension
            height = maxDimension
          }
        }
        
        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)
        
        // Convert to JPEG with 0.8 quality for good balance of size/quality
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8)
        console.log("[PlotUpload] Compressed Base64 length:", compressedBase64?.length || 0)
        console.log("[PlotUpload] Compression ratio:", ((1 - compressedBase64.length / originalBase64.length) * 100).toFixed(1) + "%")
        console.log("[PlotUpload] Calling onUpload handler...")
        
        try {
          onUpload(file, compressedBase64)
          console.log("[PlotUpload] ✅ Upload handler called successfully")
        } catch (error) {
          console.error("[PlotUpload] Error in upload handler:", error)
          void alert({
            title: "Upload failed",
            description: "Please try again.",
          })
        }
      }
      
      img.onerror = () => {
        console.error("[PlotUpload] Error loading image for compression")
        // Fallback to original if compression fails
        onUpload(file, originalBase64)
      }
      
      img.src = originalBase64
    }
    
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (disabled || isLocked) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled && !isLocked) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleClick = () => {
    if (!disabled && !isLocked) {
      fileInputRef.current?.click()
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isLocked}
      />

      <AnimatePresence mode="wait">
        {uploadedImage ? (
          <motion.div
            key="uploaded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Uploaded Image Preview */}
                  <div className="flex-shrink-0">
                    <div className="relative group">
                      <img
                        src={uploadedImage}
                        alt="Uploaded plot"
                        className="w-48 h-48 object-contain rounded-lg border-2 border-green-300 dark:border-green-700 bg-white dark:bg-slate-900"
                      />
                      <div className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-full text-xs flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Uploaded</span>
                      </div>
                    </div>
                  </div>

                  {/* Upload Info */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                          <FileImage className="h-4 w-4" />
                          Plot Image Uploaded
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {isClassroom
                            ? "Your instructor will see this image when reviewing your submission."
                            : "Your plot will be analyzed by AI during grading"}
                        </p>
                        <p className="text-xs text-muted-foreground dark:text-slate-300 mt-2">
                          {isClassroom
                            ? "Attach a clear screenshot of your figure (PNG/JPEG) if the assignment asks for a plot."
                            : "The AI will verify your plot matches the requirements and assess its correctness"}
                        </p>
                      </div>

                      {!disabled && !isLocked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onRemove}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {!disabled && !isLocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClick}
                        className="mt-3 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Replace Image
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={handleClick}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragging 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 scale-105' 
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-gray-900/30'
              }
              ${disabled || isLocked ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <div className="flex flex-col items-center gap-3">
              <div className={`
                rounded-full p-4 transition-colors
                ${isDragging 
                  ? 'bg-blue-100 dark:bg-blue-900/30' 
                  : 'bg-gray-100 dark:bg-gray-800'
                }
              `}>
                {isDragging ? (
                  <Upload className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                ) : (
                  <ImageIcon className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {isDragging
                    ? "Drop your plot image here"
                    : isClassroom
                      ? "Upload plot or figure screenshot"
                      : "Upload your MATLAB plot"}
                </p>
                <p className="text-xs text-muted-foreground dark:text-slate-300 mt-1">
                  Drag & drop or click to browse
                </p>
                <p className="text-xs text-muted-foreground dark:text-slate-300 mt-1">
                  PNG, JPEG, GIF, or WebP (max 5MB)
                </p>
              </div>

              {!disabled && !isLocked && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClick()
                  }}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose File
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {uploadedImage && (
        <p className="text-xs text-muted-foreground dark:text-slate-300 text-center">
          💡 Tip: Make sure your plot is clear and includes proper labels, title, and legend
        </p>
      )}
    </div>
  )
}

