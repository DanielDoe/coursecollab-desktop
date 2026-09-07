"use client"

import { createContext, useContext } from "react"

export const CampPresentationContext = createContext(false)

export function useCampPresentation() {
  return useContext(CampPresentationContext)
}
