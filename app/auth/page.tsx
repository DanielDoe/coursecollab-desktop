"use client"

import { Navigate } from "react-router-dom"

/** Auth entry — university-first login wizard. */
export default function AuthWelcomePage() {
  return <Navigate to="/auth/welcome" replace />
}
