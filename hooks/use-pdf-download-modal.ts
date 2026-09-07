"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getStudentAuthHeaders, studentApiFetch } from "@/lib/auth"
import { studentResultsPdfGateSatisfied } from "@/lib/student-results-pdf-gate"

interface UsePdfDownloadModalReturn {
  showModal: boolean
  pendingNavigation: string | null
  checkAndNavigate: (attemptId: string | number, targetPath: string) => Promise<void>
  confirmDownloaded: () => void
  downloadAndNavigate: (attemptId: string | number, targetPath: string, onDownload: () => Promise<void>) => Promise<void>
  closeModal: () => void
}

export function usePdfDownloadModal(): UsePdfDownloadModalReturn {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [currentAttemptId, setCurrentAttemptId] = useState<string | null>(null)

  const checkPdfDownloadStatus = useCallback(async (attemptId: string | number): Promise<boolean> => {
    try {
      const response = await studentApiFetch(`/api/student/results/${attemptId}`, {
        headers: getStudentAuthHeaders(),
      })
      if (!response.ok) {
        // If we can't check, assume not downloaded to be safe
        return false
      }
      const data = await response.json()
      return studentResultsPdfGateSatisfied(data)
    } catch (error) {
      console.error("[PDF Modal] Error checking download status:", error)
      // On error, assume not downloaded to be safe
      return false
    }
  }, [])

  const checkAndNavigate = useCallback(async (attemptId: string | number, targetPath: string) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 [PDF Download] Checking before navigation')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📄 Attempt ID:', attemptId)
    console.log('📍 Target Path:', targetPath)
    
    const hasDownloaded = await checkPdfDownloadStatus(attemptId)
    
    console.log('📥 PDF Downloaded:', hasDownloaded ? '✅ YES' : '❌ NO')
    
    if (hasDownloaded) {
      console.log('✅ PDF already downloaded - allowing navigation')
      router.push(targetPath)
    } else {
      console.log('🚫 PDF not downloaded - showing modal')
      setCurrentAttemptId(attemptId.toString())
      setPendingNavigation(targetPath)
      setShowModal(true)
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  }, [checkPdfDownloadStatus, router])

  const confirmDownloaded = useCallback(() => {
    console.log('✅ [PDF Download] User confirmed PDF downloaded')
    setShowModal(false)
    if (pendingNavigation) {
      router.push(pendingNavigation)
      setPendingNavigation(null)
    }
    setCurrentAttemptId(null)
  }, [pendingNavigation, router])

  const downloadAndNavigate = useCallback(async (
    attemptId: string | number,
    targetPath: string,
    onDownload: () => Promise<void>
  ) => {
    console.log('📥 [PDF Download] Downloading PDF and navigating...')
    try {
      await onDownload()
      
      // Mark PDF as downloaded in database
      try {
        const markResponse = await studentApiFetch(`/api/student/results/${attemptId}/mark-pdf-downloaded`, {
          method: 'POST',
          headers: getStudentAuthHeaders(),
        })
        if (!markResponse.ok) {
          console.warn("⚠️ Failed to mark PDF as downloaded in database")
        } else {
          console.log('✅ PDF marked as downloaded in database')
        }
      } catch (markError) {
        console.error("❌ Error marking PDF as downloaded:", markError)
      }
      
      setShowModal(false)
      router.push(targetPath)
      setPendingNavigation(null)
      setCurrentAttemptId(null)
    } catch (error) {
      console.error("❌ Failed to download PDF:", error)
      throw error
    }
  }, [router])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setPendingNavigation(null)
    setCurrentAttemptId(null)
  }, [])

  return {
    showModal,
    pendingNavigation,
    checkAndNavigate,
    confirmDownloaded,
    downloadAndNavigate,
    closeModal,
  }
}
