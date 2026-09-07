// Instructor financials expenses route - redirects to admin expenses (shared route)
import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { ensureExpensesSchema } from "@/lib/ensure-expenses-schema"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// This route is identical to admin expenses but is here for instructor-specific access
// Get all expenses
export async function GET(request: NextRequest) {
  try {
    // Check authentication - get instructor ID from headers
    const instructorId = request.headers.get("x-instructor-id")

    if (!instructorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure expenses table exists before querying
    await ensureExpensesSchema()

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (e) {
      // Column doesn't exist yet
    }

    // Check if expenses table exists
    let expenses: any[] = []
    let deletedExpenses: any[] = []
    
    try {
      // Get active expenses
      expenses = hasDeletedAtColumn
        ? await sql`
            SELECT 
              e.*,
              i.name as created_by_name
            FROM expenses e
            LEFT JOIN instructors i ON e.created_by = i.id
            WHERE e.deleted_at IS NULL
            ORDER BY e.expense_date DESC, e.created_at DESC
          `
        : await sql`
            SELECT 
              e.*,
              i.name as created_by_name
            FROM expenses e
            LEFT JOIN instructors i ON e.created_by = i.id
            ORDER BY e.expense_date DESC, e.created_at DESC
          `

      // Get deleted expenses if column exists
      deletedExpenses = hasDeletedAtColumn
        ? await sql`
            SELECT 
              e.*,
              i.name as created_by_name
            FROM expenses e
            LEFT JOIN instructors i ON e.created_by = i.id
            WHERE e.deleted_at IS NOT NULL
            ORDER BY e.deleted_at DESC
          `
        : []
    } catch (error: any) {
      // Table might not exist yet
      console.log("[Instructor Expenses] Expenses table might not exist:", error?.message)
      expenses = []
      deletedExpenses = []
    }

    // Calculate totals
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0)
    const totalByCategory = expenses.reduce((acc: any, e: any) => {
      const category = e.category || "Uncategorized"
      acc[category] = (acc[category] || 0) + parseFloat(e.amount || 0)
      return acc
    }, {})

    return NextResponse.json({
      expenses: expenses.map((e: any) => ({
        id: e.id,
        category: e.category || "",
        description: e.description || "",
        amount: parseFloat(e.amount || 0),
        expenseDate: e.expense_date || e.created_at,
        vendor: e.vendor || null,
        invoiceNumber: e.invoice_number || null,
        notes: e.notes || null,
        status: e.status || "paid",
        paymentMethod: e.payment_method || null,
        receiptUrl: e.receipt_url || null,
        createdBy: e.created_by || null,
        createdByName: e.created_by_name || null,
        createdAt: e.created_at || new Date().toISOString(),
        updatedAt: e.updated_at || new Date().toISOString(),
      })),
      deletedExpenses: deletedExpenses.map((e: any) => ({
        id: e.id,
        category: e.category || "",
        description: e.description || "",
        amount: parseFloat(e.amount || 0),
        expenseDate: e.expense_date || e.created_at,
        vendor: e.vendor || null,
        invoiceNumber: e.invoice_number || null,
        notes: e.notes || null,
        status: e.status || "paid",
        paymentMethod: e.payment_method || null,
        receiptUrl: e.receipt_url || null,
        createdBy: e.created_by || null,
        createdByName: e.created_by_name || null,
        createdAt: e.created_at || new Date().toISOString(),
        updatedAt: e.updated_at || new Date().toISOString(),
        deletedAt: e.deleted_at || new Date().toISOString(),
      })),
      totals: {
        total: totalExpenses,
        byCategory: totalByCategory,
      },
    })
  } catch (error: any) {
    console.error("[Instructor Expenses] Failed to fetch expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch expenses", details: error.message },
      { status: 500 }
    )
  }
}

// Create new expense
export async function POST(request: NextRequest) {
  try {
    const instructorId = request.headers.get("x-instructor-id")
    const createdBy = instructorId ? parseInt(instructorId) : null

    if (!createdBy) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Ensure expenses table exists before inserting
    await ensureExpensesSchema()

    const body = await request.json()
    const {
      category,
      description,
      amount,
      expenseDate,
      vendor,
      invoiceNumber,
      notes,
      status = "paid",
      paymentMethod,
      receiptUrl,
    } = body

    if (!category || !description || !amount || !expenseDate) {
      return NextResponse.json(
        { error: "Category, description, amount, and expense date are required" },
        { status: 400 }
      )
    }

    // Check if deleted_at column exists
    let hasDeletedAtColumn = false
    try {
      const columnCheck = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'deleted_at'
      `
      hasDeletedAtColumn = columnCheck.length > 0
    } catch (e) {
      // Column doesn't exist yet
    }

    const result = hasDeletedAtColumn
      ? await sql`
          INSERT INTO expenses (
            category, description, amount, expense_date, vendor, 
            invoice_number, notes, status, payment_method, receipt_url, created_by
          )
          VALUES (
            ${category}, ${description}, ${amount}, ${expenseDate}, ${vendor || null},
            ${invoiceNumber || null}, ${notes || null}, ${status}, 
            ${paymentMethod || null}, ${receiptUrl || null}, ${createdBy}
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO expenses (
            category, description, amount, expense_date, vendor, 
            invoice_number, notes, status, payment_method, receipt_url, created_by
          )
          VALUES (
            ${category}, ${description}, ${amount}, ${expenseDate}, ${vendor || null},
            ${invoiceNumber || null}, ${notes || null}, ${status}, 
            ${paymentMethod || null}, ${receiptUrl || null}, ${createdBy}
          )
          RETURNING *
        `

    return NextResponse.json({
      expense: result[0],
      message: "Expense created successfully",
    })
  } catch (error: any) {
    console.error("[Instructor Expenses] Failed to create expense:", error)
    return NextResponse.json(
      { error: "Failed to create expense", details: error.message },
      { status: 500 }
    )
  }
}

