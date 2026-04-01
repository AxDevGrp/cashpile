/**
 * Stacks → Cashpile data migration
 * Run with: node packages/db/migrations/run_stacks_migration.mjs
 */

import { createClient } from '@supabase/supabase-js'

// ── Clients ───────────────────────────────────────────────────────────────────
// Set these env vars before running:
//   STACKS_SUPABASE_URL, STACKS_SERVICE_ROLE_KEY
//   CASHPILE_SUPABASE_URL, CASHPILE_SERVICE_ROLE_KEY

const stacks = createClient(
  process.env.STACKS_SUPABASE_URL,
  process.env.STACKS_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const cashpile = createClient(
  process.env.CASHPILE_SUPABASE_URL,
  process.env.CASHPILE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const STACKS_USER_ID   = '272c4e7d-0877-4e67-bac1-f7493964ca7f'
const CASHPILE_USER_ID = 'c685fe3e-f2ec-47a2-9efc-46e2e8086b0a'
const BATCH_SIZE = 200

// ── Helpers ───────────────────────────────────────────────────────────────────

function inferCategoryType(name) {
  const n = name.toLowerCase()
  if (/income|revenue|salary/.test(n)) return 'income'
  if (/transfer/.test(n))              return 'transfer'
  if (/investment|asset/.test(n))      return 'asset'
  return 'expense'
}

async function batchInsert(client, table, rows, label) {
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await client.from(table).upsert(batch, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw new Error(`${label} batch ${i / BATCH_SIZE + 1}: ${error.message}`)
    inserted += batch.length
    process.stdout.write(`\r  ${label}: ${inserted}/${rows.length}`)
  }
  console.log()
}

// ── Migration steps ───────────────────────────────────────────────────────────

async function migrateCategories(usedCategoryIds) {
  console.log('\n[1/4] Categories')
  if (usedCategoryIds.size === 0) { console.log('  No categories used — skipping'); return new Map() }

  const { data, error } = await stacks
    .from('categories')
    .select('*')
    .in('id', [...usedCategoryIds])
  if (error) throw error

  const rows = data.map(c => ({
    name:              c.name,
    description:       c.description ?? null,
    is_tax_deductible: c.is_tax_deductible ?? false,
    color:             c.color ?? '#6B7280',
    icon:              c.icon ?? 'folder',
    user_id:           CASHPILE_USER_ID,
    category_type:     inferCategoryType(c.name),
  }))

  const { error: insErr } = await cashpile
    .from('books_categories')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true })
  if (insErr) throw insErr
  console.log(`  Inserted ${rows.length} categories`)

  // Build stacks_category_id → cashpile_category_id map (matched by name)
  const { data: inserted, error: selErr } = await cashpile
    .from('books_categories')
    .select('id, name')
    .eq('user_id', CASHPILE_USER_ID)
    .in('name', data.map(c => c.name))
  if (selErr) throw selErr

  const nameToNewId = new Map(inserted.map(r => [r.name, r.id]))
  const oldToNew = new Map(data.map(c => [c.id, nameToNewId.get(c.name)]))
  return oldToNew
}

async function migrateUDAs() {
  console.log('\n[2/4] User-Defined Accounts (UDAs)')
  const { data, error } = await stacks
    .from('user_defined_accounts')
    .select('*')
    .eq('user_id', STACKS_USER_ID)
  if (error) throw error

  const rows = data.map(u => ({
    id:          u.id,
    user_id:     CASHPILE_USER_ID,
    name:        u.name,
    description: u.description ?? null,
    created_at:  u.created_at,
    updated_at:  u.updated_at,
  }))

  await batchInsert(cashpile, 'books_udas', rows, 'UDAs')
  return new Set(rows.map(r => r.id))
}

async function migrateFinancialAccounts(udaIds) {
  console.log('\n[3/4] Financial Accounts')
  const { data, error } = await stacks
    .from('financial_accounts')
    .select('*')
    .in('user_defined_account_id', [...udaIds])
  if (error) throw error

  const rows = data.map(fa => ({
    id:                  fa.id,
    uda_id:              fa.user_defined_account_id,
    name:                fa.name,
    account_type:        fa.account_type ?? 'other',
    institution_name:    fa.institution_name ?? null,
    last_four_digits:    fa.last_four_digits ?? null,
    account_identifier:  fa.account_identifier ?? null,
    current_balance:     0,
    is_active:           true,
    created_at:          fa.created_at,
    updated_at:          fa.updated_at,
  }))

  await batchInsert(cashpile, 'books_financial_accounts', rows, 'Accounts')
}

async function migrateTransactions(categoryMap) {
  console.log('\n[4/4] Transactions')

  // Paginate to get all rows (Supabase default cap is 1000)
  let all = []
  let from = 0
  while (true) {
    const { data, error } = await stacks
      .from('transactions')
      .select('*')
      .eq('user_id', STACKS_USER_ID)
      .order('date', { ascending: true })
      .range(from, from + BATCH_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < BATCH_SIZE) break
    from += BATCH_SIZE
  }

  const rows = all.map(t => ({
    id:                   t.id,
    user_id:              CASHPILE_USER_ID,
    financial_account_id: t.financial_account_id ?? null,
    description:          t.description,
    amount:               t.amount,
    date:                 t.date,
    merchant:             t.merchant ?? null,
    transaction_type:     t.transaction_type ?? 'debit',
    category_id:          t.category_id ? (categoryMap.get(t.category_id) ?? null) : null,
    is_transfer:          false,
    import_source:        t.import_source ?? 'manual',
    import_batch_id:      t.import_batch_id ?? null,
    metadata:             t.metadata ?? {},
    created_at:           t.created_at,
    updated_at:           t.updated_at,
  }))

  await batchInsert(cashpile, 'books_transactions', rows, 'Transactions')
}

// ── Verification ──────────────────────────────────────────────────────────────

async function verify() {
  console.log('\n── Verification ─────────────────────────────────────────')
  const tables = [
    ['books_categories',        'books_categories',        'user_id'],
    ['books_udas',              'books_udas',              'user_id'],
    ['books_transactions',      'books_transactions',      'user_id'],
  ]
  for (const [label, table, col] of tables) {
    const { count } = await cashpile
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq(col, CASHPILE_USER_ID)
    console.log(`  ${label}: ${count} rows`)
  }
  const { count: faCount } = await cashpile
    .from('books_financial_accounts')
    .select('uda_id, books_udas!inner(user_id)', { count: 'exact', head: true })
  console.log(`  books_financial_accounts: ${faCount} rows`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Stacks → Cashpile migration starting…')
  console.log(`  Stacks user:   ${STACKS_USER_ID}`)
  console.log(`  Cashpile user: ${CASHPILE_USER_ID}`)

  // Pre-fetch all transactions to know which category IDs are used
  const { data: txnMeta, error: txnMetaErr } = await stacks
    .from('transactions')
    .select('category_id')
    .eq('user_id', STACKS_USER_ID)
    .not('category_id', 'is', null)
  if (txnMetaErr) throw txnMetaErr

  const usedCategoryIds = new Set(txnMeta.map(t => t.category_id))
  console.log(`  Found ${txnMeta.length} transactions, ${usedCategoryIds.size} distinct categories used`)

  const categoryMap = await migrateCategories(usedCategoryIds)
  const udaIds      = await migrateUDAs()
  await migrateFinancialAccounts(udaIds)
  await migrateTransactions(categoryMap)
  await verify()

  console.log('\nMigration complete.')
}

main().catch(err => { console.error('\nMigration failed:', err.message); process.exit(1) })
