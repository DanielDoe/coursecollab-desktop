import { NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"



export const dynamic = 'force-dynamic'
// Mark as dynamic to prevent build-time database initialization

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tableName = searchParams.get("table") || "quiz_answers"
    
    console.log(`[Schema Info] Fetching schema for table: ${tableName}`)
    
    // Get column information
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = ${tableName}
      ORDER BY ordinal_position
    `
    
    // Get constraints
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        contype as constraint_type,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = ${tableName}::regclass
    `
    
    // Get indexes
    const indexes = await sql`
      SELECT
        indexname as index_name,
        indexdef as definition
      FROM pg_indexes
      WHERE tablename = ${tableName}
    `
    
    return NextResponse.json({
      table: tableName,
      columns,
      constraints,
      indexes,
      totalColumns: columns.length
    })
  } catch (error) {
    console.error("[Schema Info] Error:", error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

