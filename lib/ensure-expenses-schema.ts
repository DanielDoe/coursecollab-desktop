import { sql } from "@/lib/db"

let schemaEnsured = false

/**
 * Ensure the expenses table schema exists.
 * This function is idempotent and can be called multiple times safely.
 */
export async function ensureExpensesSchema() {
  if (schemaEnsured) {
    return
  }

  try {
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses'
      ) as table_exists
    `
    
    // The EXISTS query returns a boolean, check the first value
    const tableExists = tableCheck[0]?.table_exists ?? tableCheck[0]?.exists ?? false
    
    if (tableExists) {
      // Table exists, just ensure columns are up to date
      await ensureExpensesColumns()
      schemaEnsured = true
      return
    }

    // Create the expenses table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        category VARCHAR(100) NOT NULL CHECK (category IN ('AI', 'Database', 'Web Hosting', 'API Services', 'Storage', 'Other')),
        description TEXT NOT NULL,
        amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
        expense_date DATE NOT NULL,
        vendor VARCHAR(255),
        invoice_number VARCHAR(100),
        notes TEXT,
        status VARCHAR(50) DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'overdue')),
        payment_method VARCHAR(50),
        receipt_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        created_by INTEGER REFERENCES instructors(id) ON DELETE SET NULL
      )
    `

    // Create indexes
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at ON expenses(deleted_at) WHERE deleted_at IS NULL
    `

    // Create updated_at trigger function if it doesn't exist
    await sql`
      CREATE OR REPLACE FUNCTION update_expenses_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `

    // Create trigger if it doesn't exist
    await sql`
      DROP TRIGGER IF EXISTS expenses_updated_at ON expenses
    `
    await sql`
      CREATE TRIGGER expenses_updated_at
        BEFORE UPDATE ON expenses
        FOR EACH ROW
        EXECUTE FUNCTION update_expenses_updated_at()
    `

    schemaEnsured = true
  } catch (error: any) {
    // If table creation fails, log but don't throw (might be permission issue)
    console.error("[Ensure Expenses Schema] Failed to create expenses table:", error?.message)
    // Don't set schemaEnsured = true so we retry next time
  }
}

/**
 * Ensure all required columns exist (for incremental migrations)
 */
async function ensureExpensesColumns() {
  try {
    // Add deleted_at column if it doesn't exist
    await sql`
      ALTER TABLE expenses
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `
  } catch (error: any) {
    console.error("[Ensure Expenses Schema] Failed to ensure columns:", error?.message)
  }
}

