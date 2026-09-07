"use client"

import { createContext, useContext } from "react"

export const CampLectureContext = createContext(false)

export function useCampLecture() {
  return useContext(CampLectureContext)
}
