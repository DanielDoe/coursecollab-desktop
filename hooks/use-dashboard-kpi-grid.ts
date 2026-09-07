"use client"

import { useEffect, useState } from "react"
import {
  resolveDashboardKpiGrid,
  type DashboardKpiGridConfig,
} from "@/lib/dashboard-v2/kpi-layout"

const DEFAULT_GRID = resolveDashboardKpiGrid(1280)

export function useDashboardKpiGrid(): DashboardKpiGridConfig {
  const [grid, setGrid] = useState<DashboardKpiGridConfig>(DEFAULT_GRID)

  useEffect(() => {
    const update = () => setGrid(resolveDashboardKpiGrid(window.innerWidth))

    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])

  return grid
}
