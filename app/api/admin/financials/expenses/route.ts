import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensureExpensesSchema } from "@/lib/ensure-expenses-schema"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Get all expenses
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

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

    // Get active expenses
    const expenses = hasDeletedAtColumn
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
    const deletedExpenses = hasDeletedAtColumn
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

    // Calculate totals
    const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0)
    const totalByCategory = expenses.reduce((acc: any, e: any) => {
      const category = e.category || 'Other'
      acc[category] = (acc[category] || 0) + parseFloat(e.amount || 0)
      return acc
    }, {})

    // Monthly breakdown
    const monthlyExpenses = expenses.reduce((acc: any, e: any) => {
      const month = new Date(e.expense_date).toISOString().slice(0, 7) // YYYY-MM
      if (!acc[month]) {
        acc[month] = { month, total: 0, count: 0 }
      }
      acc[month].total += parseFloat(e.amount || 0)
      acc[month].count += 1
      return acc
    }, {})

    return NextResponse.json({
      expenses: expenses.map((e: any) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: parseFloat(e.amount || 0),
        expenseDate: e.expense_date,
        vendor: e.vendor,
        invoiceNumber: e.invoice_number,
        notes: e.notes,
        status: e.status,
        paymentMethod: e.payment_method,
        receiptUrl: e.receipt_url,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        createdBy: e.created_by,
        createdByName: e.created_by_name,
      })),
      deletedExpenses: deletedExpenses.map((e: any) => ({
        id: e.id,
        category: e.category,
        description: e.description,
        amount: parseFloat(e.amount || 0),
        expenseDate: e.expense_date,
        vendor: e.vendor,
        invoiceNumber: e.invoice_number,
        notes: e.notes,
        status: e.status,
        paymentMethod: e.payment_method,
        receiptUrl: e.receipt_url,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
        deletedAt: e.deleted_at,
        createdBy: e.created_by,
        createdByName: e.created_by_name,
      })),
      totals: {
        totalExpenses,
        totalByCategory,
      },
      monthlyBreakdown: Object.values(monthlyExpenses),
    })
  } catch (error: any) {
    console.error("[Financials] Failed to fetch expenses:", error)
    return NextResponse.json(
      { error: "Failed to fetch expenses", details: error.message },
      { status: 500 }
    )
  }
}

// Create new expense
export async function POST(request: NextRequest) {
  try {
    // Verify admin or instructor authentication
    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response
    const createdBy = Number(admin.adminId)

    if (!createdBy) {
      return NextResponse.json({ error: "Could not determine creator ID" }, { status: 400 })
    }

    const body = await request.json()
    const {
      category,
      description,
      amount,
      expenseDate,
      vendor,
      invoiceNumber,
      notes,
      status = 'paid',
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
            invoice_number, notes, status, payment_method, receipt_url,
            created_by, deleted_at
          )
          VALUES (
            ${category}, ${description}, ${parseFloat(amount)}, ${expenseDate},
            ${vendor || null}, ${invoiceNumber || null}, ${notes || null},
            ${status}, ${paymentMethod || null}, ${receiptUrl || null},
            ${createdBy}, NULL
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO expenses (
            category, description, amount, expense_date, vendor, 
            invoice_number, notes, status, payment_method, receipt_url,
            created_by
          )
          VALUES (
            ${category}, ${description}, ${parseFloat(amount)}, ${expenseDate},
            ${vendor || null}, ${invoiceNumber || null}, ${notes || null},
            ${status}, ${paymentMethod || null}, ${receiptUrl || null},
            ${createdBy}
          )
          RETURNING *
        `

    return NextResponse.json({
      success: true,
      expense: {
        id: result[0].id,
        category: result[0].category,
        description: result[0].description,
        amount: parseFloat(result[0].amount),
        expenseDate: result[0].expense_date,
        vendor: result[0].vendor,
        invoiceNumber: result[0].invoice_number,
        notes: result[0].notes,
        status: result[0].status,
        paymentMethod: result[0].payment_method,
        receiptUrl: result[0].receipt_url,
        createdAt: result[0].created_at,
        updatedAt: result[0].updated_at,
        createdBy: result[0].created_by,
      },
    })
  } catch (error: any) {
    console.error("[Financials] Failed to create expense:", error)
    return NextResponse.json(
      { error: "Failed to create expense", details: error.message },
      { status: 500 }
    )
  }
}

