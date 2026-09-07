"use client"

import React, { createContext, useCallback, useContext, useState } from "react"
import { StudentErrorDialog, type StudentErrorType } from "./student-error-dialog"

interface StudentErrorContextValue {
  showError: (type: StudentErrorType, options?: { message?: string; redirectTo?: string }) => void
}

const StudentErrorContext = createContext<StudentErrorContextValue | null>(null)

export function StudentErrorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [errorType, setErrorType] = useState<StudentErrorType>("generic")
  const [customMessage, setCustomMessage] = useState<string | undefined>()
  const [redirectTo, setRedirectTo] = useState<string | undefined>()

  const showError = useCallback(
    (type: StudentErrorType, options?: { message?: string; redirectTo?: string }) => {
      setErrorType(type)
      setCustomMessage(options?.message)
      setRedirectTo(options?.redirectTo)
      setOpen(true)
    },
    []
  )

  return (
    <StudentErrorContext.Provider value={{ showError }}>
      {children}
      <StudentErrorDialog
        open={open}
        onOpenChange={setOpen}
        errorType={errorType}
        customMessage={customMessage}
        redirectTo={redirectTo}
      />
    </StudentErrorContext.Provider>
  )
}

export function useStudentError() {
  const ctx = useContext(StudentErrorContext)
  if (!ctx) {
    return {
      showError: (type: StudentErrorType, _opts?: { message?: string; redirectTo?: string }) => {
        if (type === "session_expired") {
          const { logoutStudent } = require("@/lib/auth")
          logoutStudent()
        }
      },
    }
  }
  return ctx
}
