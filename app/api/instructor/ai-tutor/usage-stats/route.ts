import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "7")

    // Get usage statistics
    const stats = await sql`
      SELECT 
        COUNT(*) as total_requests,
        SUM(tokens_used) as total_tokens,
        SUM(estimated_cost) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM ai_tutor_api_usage
      WHERE created_at >= NOW() - make_interval(days => ${days})
    `

    // Get daily breakdown
    const dailyStats = await sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as requests,
        SUM(tokens_used) as tokens,
        SUM(estimated_cost) as cost,
        COUNT(DISTINCT conversation_id) as conversations
      FROM ai_tutor_api_usage
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `

    // Get model usage breakdown
    const modelStats = await sql`
      SELECT 
        model_used,
        COUNT(*) as requests,
        SUM(tokens_used) as tokens,
        SUM(estimated_cost) as cost,
        AVG(response_time_ms) as avg_response_time
      FROM ai_tutor_api_usage
      WHERE created_at >= NOW() - make_interval(days => ${days})
      GROUP BY model_used
      ORDER BY requests DESC
    `

    // Get cost limits from config
    const costConfig = await sql`
      SELECT setting_value
      FROM ai_tutor_config
      WHERE setting_key = 'cost_limits'
    `

    const costLimits = costConfig[0]?.setting_value || {
      daily_limit: 10.00,
      monthly_limit: 200.00,
      alert_threshold: 0.8
    }

    // Calculate today's cost
    const todayCost = await sql`
      SELECT SUM(estimated_cost) as cost
      FROM ai_tutor_api_usage
      WHERE DATE(created_at) = CURRENT_DATE
    `

    // Calculate month's cost
    const monthCost = await sql`
      SELECT SUM(estimated_cost) as cost
      FROM ai_tutor_api_usage
      WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
    `

    const todaySpent = parseFloat(todayCost[0]?.cost || 0)
    const monthSpent = parseFloat(monthCost[0]?.cost || 0)

    return NextResponse.json({
      success: true,
      summary: {
        totalRequests: parseInt(stats[0]?.total_requests || 0),
        totalTokens: parseInt(stats[0]?.total_tokens || 0),
        totalCost: parseFloat(stats[0]?.total_cost || 0).toFixed(4),
        avgResponseTime: parseFloat(stats[0]?.avg_response_time || 0).toFixed(2),
        activeDays: parseInt(stats[0]?.active_days || 0)
      },
      dailyStats,
      modelStats,
      costLimits,
      currentUsage: {
        today: {
          spent: todaySpent.toFixed(4),
          limit: costLimits.daily_limit,
          percentage: ((todaySpent / costLimits.daily_limit) * 100).toFixed(1),
          remaining: (costLimits.daily_limit - todaySpent).toFixed(4)
        },
        month: {
          spent: monthSpent.toFixed(4),
          limit: costLimits.monthly_limit,
          percentage: ((monthSpent / costLimits.monthly_limit) * 100).toFixed(1),
          remaining: (costLimits.monthly_limit - monthSpent).toFixed(4)
        }
      },
      alerts: {
        dailyAlert: todaySpent >= (costLimits.daily_limit * costLimits.alert_threshold),
        monthlyAlert: monthSpent >= (costLimits.monthly_limit * costLimits.alert_threshold)
      },
      timeRange: `Last ${days} days`
    })
  } catch (error: any) {
    console.error("[AI Tutor Usage Stats Error]", error)
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to fetch usage statistics",
        summary: {
          totalRequests: 0,
          totalTokens: 0,
          totalCost: "0.0000",
          avgResponseTime: "0.00",
          activeDays: 0
        }
      },
      { status: 500 }
    )
  }
}

