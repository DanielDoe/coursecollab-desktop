import { type NextRequest, NextResponse } from "next/server"
import { requireAdminId } from "@/lib/admin-api-auth"
import { sql } from "@/lib/db"
import { ensureExpensesSchema } from "@/lib/ensure-expenses-schema"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Update expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const expenseId = parseInt(id)

    if (isNaN(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 })
    }

    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    // Ensure expenses table exists before querying
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
      status,
      paymentMethod,
      receiptUrl,
    } = body

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

    // Get current expense first
    const currentExpense = hasDeletedAtColumn
      ? await sql`
          SELECT * FROM expenses WHERE id = ${expenseId} AND deleted_at IS NULL
        `
      : await sql`
          SELECT * FROM expenses WHERE id = ${expenseId}
        `

    if (currentExpense.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 })
    }

    const current = currentExpense[0]

    // Update expense with provided values or keep current values
    const updateData = {
      category: category !== undefined ? category : current.category,
      description: description !== undefined ? description : current.description,
      amount: amount !== undefined ? parseFloat(amount) : parseFloat(current.amount),
      expenseDate: expenseDate !== undefined ? expenseDate : current.expense_date,
      vendor: vendor !== undefined ? vendor : current.vendor,
      invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : current.invoice_number,
      notes: notes !== undefined ? notes : current.notes,
      status: status !== undefined ? status : current.status,
      paymentMethod: paymentMethod !== undefined ? paymentMethod : current.payment_method,
      receiptUrl: receiptUrl !== undefined ? receiptUrl : current.receipt_url,
    }

    if (hasDeletedAtColumn) {
      const result = await sql`
        UPDATE expenses
        SET
          category = ${updateData.category},
          description = ${updateData.description},
          amount = ${updateData.amount},
          expense_date = ${updateData.expenseDate},
          vendor = ${updateData.vendor || null},
          invoice_number = ${updateData.invoiceNumber || null},
          notes = ${updateData.notes || null},
          status = ${updateData.status},
          payment_method = ${updateData.paymentMethod || null},
          receipt_url = ${updateData.receiptUrl || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${expenseId}
          AND deleted_at IS NULL
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
    } else {
      const result = await sql`
        UPDATE expenses
        SET
          category = ${updateData.category},
          description = ${updateData.description},
          amount = ${updateData.amount},
          expense_date = ${updateData.expenseDate},
          vendor = ${updateData.vendor || null},
          invoice_number = ${updateData.invoiceNumber || null},
          notes = ${updateData.notes || null},
          status = ${updateData.status},
          payment_method = ${updateData.paymentMethod || null},
          receipt_url = ${updateData.receiptUrl || null},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ${expenseId}
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
    }
  } catch (error: any) {
    console.error("[Financials] Failed to update expense:", error)
    return NextResponse.json(
      { error: "Failed to update expense", details: error.message },
      { status: 500 }
    )
  }
}

// Delete expense (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const expenseId = parseInt(id)

    if (isNaN(expenseId)) {
      return NextResponse.json({ error: "Invalid expense ID" }, { status: 400 })
    }

    const admin = await requireAdminId(request)
    if (!admin.ok) return admin.response

    // Ensure expenses table exists before querying
    await ensureExpensesSchema()

    const searchParams = request.nextUrl.searchParams
    const permanent = searchParams.get("permanent") === "true"

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

    if (permanent && hasDeletedAtColumn) {
      // Permanent delete
      const result = await sql`
        DELETE FROM expenses
        WHERE id = ${expenseId}
        RETURNING id
      `
      if (result.length === 0) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: "Expense permanently deleted" })
    } else if (hasDeletedAtColumn) {
      // Soft delete
      const result = await sql`
        UPDATE expenses
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE id = ${expenseId}
          AND deleted_at IS NULL
        RETURNING id
      `
      if (result.length === 0) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: "Expense deleted" })
    } else {
      // No soft delete support, just delete permanently
      const result = await sql`
        DELETE FROM expenses
        WHERE id = ${expenseId}
        RETURNING id
      `
      if (result.length === 0) {
        return NextResponse.json({ error: "Expense not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: "Expense deleted" })
    }
  } catch (error: any) {
    console.error("[Financials] Failed to delete expense:", error)
    return NextResponse.json(
      { error: "Failed to delete expense", details: error.message },
      { status: 500 }
    )
  }
}

