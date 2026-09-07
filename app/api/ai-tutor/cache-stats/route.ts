import { NextRequest, NextResponse } from "next/server"
import { getCacheStats, cleanupCache } from "@/lib/ai-cache"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const stats = await getCacheStats()

    if (!stats) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch cache stats" },
        { status: 500 }
      )
    }

    // Calculate cache efficiency
    const cacheHitRate = stats.totalHits > 0 
      ? ((stats.totalHits - stats.totalCached) / stats.totalHits * 100).toFixed(2)
      : "0.00"

    return NextResponse.json({
      success: true,
      stats: {
        ...stats,
        cacheHitRate: `${cacheHitRate}%`,
        estimatedTimeSaved: `${(stats.totalHits * 2).toFixed(1)} seconds`,
        estimatedCostSaved: `$${(stats.totalHits * 0.0015).toFixed(4)}`
      }
    })

  } catch (error: any) {
    console.error("[Cache Stats Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch cache statistics" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const deletedCount = await cleanupCache()

    return NextResponse.json({
      success: true,
      message: "Cache cleanup completed",
      deletedCount
    })

  } catch (error: any) {
    console.error("[Cache Cleanup Error]", error)
    return NextResponse.json(
      { success: false, error: "Failed to cleanup cache" },
      { status: 500 }
    )
  }
}

