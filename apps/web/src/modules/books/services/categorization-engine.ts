import { categorizeTransactions as aiCategorizeTransactions } from "@cashpile/ai";

type SupabaseLike = any;

export type CategorizationMethod = "category_rule" | "learned_rule" | "default_rule" | "ai" | "rule_based";

interface CategoryRow {
  id: string | number;
  name: string;
  category_type?: string | null;
  type?: string | null;
}

interface CategoryRuleRow {
  id: string;
  pattern: string;
  match_type: "contains" | "equals";
  category_id: string | number;
  priority: number;
  financial_account_id?: string | null;
}

interface TransactionRow {
  id: string;
  description: string;
  merchant?: string | null;
  amount: number;
  transaction_type?: string | null;
  type?: string | null;
  category_id?: string | number | null;
  financial_account_id?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface CategorizationMatch {
  transactionId: string;
  categoryId: string | number;
  categoryName: string;
  confidence: number;
  method: CategorizationMethod;
  ruleId?: string;
}

export interface BulkCategorizationResult {
  scanned: number;
  categorized: number;
  ruleMatches: number;
  learnedMatches: number;
  aiMatches: number;
  needsReview: number;
  createdCategories: string[];
  examples: Array<{
    description: string;
    categoryName: string;
    confidence: number;
    method: CategorizationMethod;
  }>;
}

const DEFAULT_CATEGORIES = [
  "Software & Subscriptions",
  "Cloud & Hosting",
  "Meals & Dining",
  "Groceries",
  "Transportation",
  "Travel",
  "Shopping",
  "Utilities",
  "Mortgage Payments",
  "Rent",
  "Property Taxes",
  "Home Insurance",
  "Car Insurance",
  "Insurance",
  "HOA Fees",
  "Cleaning and Maintenance",
  "Healthcare",
  "Dental",
  "Entertainment",
  "Bank Fees",
  "Income",
  "Transfers",
  "Other",
];

const DEFAULT_RULES: Array<{ category: string; patterns: RegExp[] }> = [
  {
    category: "Software & Subscriptions",
    patterns: [
      /anthropic|claude|openrouter|openai|chatgpt|cursor|replit|github|linear|notion|figma|canva/i,
      /adobe|microsoft\s*365|google\s*workspace|dropbox|zoom|slack|loom|calendly/i,
      /netflix|hulu|spotify|disney\+?|youtube\s*premium|icloud|subscription|membership/i,
    ],
  },
  {
    category: "Cloud & Hosting",
    patterns: [/aws|amazon web services|vercel|supabase|cloudflare|digitalocean|heroku|render\.com|railway/i],
  },
  {
    category: "Transfers",
    patterns: [/credit card payment|cc payment|autopay.*credit|transfer from|transfer to|wire transfer|ach transfer|zelle|venmo|cash app/i],
  },
  {
    category: "Income",
    patterns: [/direct deposit|payroll|salary|wages|bonus|commission|tax refund|irs.*refund|refund|reimbursement|rebate/i],
  },
  {
    category: "Bank Fees",
    patterns: [/monthly service fee|maintenance fee|overdraft|nsf fee|atm fee|service charge|annual fee|late fee/i],
  },
  {
    category: "Meals & Dining",
    patterns: [/restaurant|cafe|coffee|pizza|burger|mcdonald|starbucks|subway|doordash|uber eats|grubhub|bistro|bakery/i],
  },
  {
    category: "Groceries",
    patterns: [/whole foods|trader joe|kroger|publix|safeway|wegmans|aldi|costco|grocery|supermarket/i],
  },
  {
    category: "Transportation",
    patterns: [/gas station|fuel|shell|exxon|chevron|uber(?! eats)|lyft|taxi|metro|transit|parking|toll/i],
  },
  {
    category: "Travel",
    patterns: [/airbnb|vrbo|hotel|marriott|hilton|hyatt|delta|united airlines|american airlines|southwest|expedia|booking\.com/i],
  },
  {
    category: "Shopping",
    patterns: [/amazon|walmart|target|home depot|best buy|apple store|macy|nordstrom|etsy|shopify/i],
  },
  {
    category: "Utilities",
    patterns: [/electric|power bill|water bill|internet|comcast|xfinity|verizon|at&t|utility|trash|sewer/i],
  },
  {
    category: "Mortgage Payments",
    patterns: [/mortgage|loan payment|home loan|rocket mortgage|quicken loans|mr cooper|loandepot|pennymac|freedom mortgage|newrez|nationstar/i],
  },
  {
    category: "Rent",
    patterns: [/rent payment|apartments|property management|tenant portal|avail rent|zillow rental/i],
  },
  {
    category: "Cleaning and Maintenance",
    patterns: [/cleaning|cleaner|maid|janitorial|maintenance|repair|handyman|plumbing|plumber|electrical|electrician|hvac|landscap|lawn care|pest control|trash removal|appliance repair/i],
  },
  {
    category: "Car Insurance",
    patterns: [/auto insurance|car insurance|geico|progressive|state farm|allstate|liberty mutual|farmers insurance|usaa insurance|nationwide|travelers insurance|erie insurance|amica|root insurance/i],
  },
  {
    category: "Insurance",
    patterns: [/insurance premium|insurance payment|policy premium/i],
  },
  {
    category: "HOA Fees",
    patterns: [/hoa|homeowners association|condo association/i],
  },
  {
    category: "Dental",
    patterns: [/dental|dentist|orthodont|endodont|periodont|oral surgery|dmd|dds/i],
  },
  {
    category: "Healthcare",
    patterns: [/doctor|medical|hospital|pharmacy|cvs|walgreens|dental|vision|prescription|clinic/i],
  },
  {
    category: "Entertainment",
    patterns: [/movie|theater|concert|ticketmaster|gym|fitness|bowling|golf/i],
  },
];

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(inc|llc|ltd|co|corp|corporation|payment|purchase|pos|debit|card|online)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function merchantKey(tx: Pick<TransactionRow, "merchant" | "description">) {
  const source = normalizeText(tx.merchant) || normalizeText(tx.description);
  return source.split(" ").slice(0, 3).join(" ");
}

function categoryByName(categories: CategoryRow[], name: string) {
  const target = name.toLowerCase();
  return categories.find((category) => category.name.toLowerCase() === target);
}

async function ensureDefaultCategories(
  supabase: SupabaseLike,
  userId: string,
  categories: CategoryRow[]
): Promise<{ categories: CategoryRow[]; created: string[] }> {
  const created: string[] = [];
  const next = [...categories];

  for (const name of DEFAULT_CATEGORIES) {
    if (categoryByName(next, name)) continue;

    const insert = {
      user_id: userId,
      name,
      category_type: name === "Income" ? "income" : name === "Transfers" ? "transfer" : "expense",
      is_tax_deductible: ["Software & Subscriptions", "Cloud & Hosting", "Meals & Dining", "Travel", "Bank Fees", "Property Taxes", "Cleaning and Maintenance"].includes(name),
    };

    const { data, error } = await supabase
      .from("books_categories")
      .insert(insert)
      .select("id, name, category_type")
      .single();

    if (!error && data) {
      next.push(data);
      created.push(name);
    }
  }

  return { categories: next, created };
}

function getDefaultMatch(tx: TransactionRow, categories: CategoryRow[]): CategorizationMatch | null {
  const text = `${tx.transaction_type ?? tx.type ?? ""} ${tx.description} ${tx.merchant ?? ""}`;

  for (const rule of DEFAULT_RULES) {
    if (!rule.patterns.some((pattern) => pattern.test(text))) continue;
    const category = categoryByName(categories, rule.category);
    if (!category) return null;
    return {
      transactionId: tx.id,
      categoryId: category.id,
      categoryName: category.name,
      confidence: 0.9,
      method: "default_rule",
    };
  }

  return null;
}

function buildLearnedRules(categorized: TransactionRow[]) {
  const votes = new Map<string, Map<string | number, number>>();

  for (const tx of categorized) {
    if (!tx.category_id) continue;
    const key = merchantKey(tx);
    if (key.length < 3) continue;
    const byCategory = votes.get(key) ?? new Map<string | number, number>();
    byCategory.set(tx.category_id, (byCategory.get(tx.category_id) ?? 0) + 1);
    votes.set(key, byCategory);
  }

  const learned = new Map<string, string | number>();
  for (const [key, byCategory] of votes) {
    const [winner] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    if (winner) learned.set(key, winner);
  }
  return learned;
}

function getLearnedMatch(
  tx: TransactionRow,
  learnedRules: Map<string, string | number>,
  categories: CategoryRow[]
): CategorizationMatch | null {
  const key = merchantKey(tx);
  const categoryId = learnedRules.get(key);
  if (!categoryId) return null;
  const category = categories.find((item) => String(item.id) === String(categoryId));
  if (!category) return null;
  return {
    transactionId: tx.id,
    categoryId: category.id,
    categoryName: category.name,
    confidence: 0.96,
    method: "learned_rule",
  };
}

async function fetchCategoryRules(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("books_category_rules")
    .select("id, pattern, match_type, category_id, priority, financial_account_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    if (error.message?.includes("books_category_rules")) return [] as CategoryRuleRow[];
    throw new Error(error.message);
  }
  return (data ?? []) as CategoryRuleRow[];
}

function getCategoryRuleMatch(
  tx: TransactionRow,
  rules: CategoryRuleRow[],
  categories: CategoryRow[]
): CategorizationMatch | null {
  const normalized = normalizeText(`${tx.merchant ?? ""} ${tx.description}`);

  for (const rule of rules) {
    if (rule.financial_account_id && rule.financial_account_id !== tx.financial_account_id) continue;
    const pattern = normalizeText(rule.pattern);
    if (!pattern) continue;
    const isMatch = rule.match_type === "equals" ? normalized === pattern : normalized.includes(pattern);
    if (!isMatch) continue;

    const category = categories.find((item) => String(item.id) === String(rule.category_id));
    if (!category) continue;

    return {
      transactionId: tx.id,
      categoryId: category.id,
      categoryName: category.name,
      confidence: 0.99,
      method: "category_rule",
      ruleId: rule.id,
    };
  }

  return null;
}

async function updateRuleMatchCounts(supabase: SupabaseLike, ruleIds: string[]) {
  const uniqueRuleIds = [...new Set(ruleIds)];
  const now = new Date().toISOString();
  for (const id of uniqueRuleIds) {
    const count = ruleIds.filter((ruleId) => ruleId === id).length;
    const { data: rule } = await supabase
      .from("books_category_rules")
      .select("match_count")
      .eq("id", id)
      .single();

    await supabase
      .from("books_category_rules")
      .update({ match_count: (rule?.match_count ?? 0) + count, last_matched_at: now, updated_at: now })
      .eq("id", id);
  }
}

async function fetchCategories(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("books_categories")
    .select("id, name, category_type")
    .eq("user_id", userId)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as CategoryRow[];
}

async function fetchUncategorizedTransactions(supabase: SupabaseLike, userId: string, limit: number) {
  const { data, error } = await supabase
    .from("books_transactions")
    .select("id, description, merchant, amount, transaction_type, category_id, financial_account_id, metadata")
    .eq("user_id", userId)
    .is("category_id", null)
    .eq("is_transfer", false)
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TransactionRow[];
}

async function fetchUncategorizedTransactionsByIds(supabase: SupabaseLike, userId: string, ids: string[]) {
  if (ids.length === 0) return [] as TransactionRow[];
  const { data, error } = await supabase
    .from("books_transactions")
    .select("id, description, merchant, amount, transaction_type, category_id, financial_account_id, metadata")
    .eq("user_id", userId)
    .in("id", ids)
    .is("category_id", null)
    .eq("is_transfer", false);
  if (error) throw new Error(error.message);
  return (data ?? []) as TransactionRow[];
}

async function fetchCategorizedTransactions(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("books_transactions")
    .select("id, description, merchant, amount, transaction_type, category_id, financial_account_id, metadata")
    .eq("user_id", userId)
    .not("category_id", "is", null)
    .order("date", { ascending: false })
    .limit(10000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TransactionRow[];
}

async function applyMatches(supabase: SupabaseLike, userId: string, txById: Map<string, TransactionRow>, matches: CategorizationMatch[]) {
  const now = new Date().toISOString();
  let applied = 0;

  for (const match of matches) {
    const tx = txById.get(match.transactionId);
    const { error } = await supabase
      .from("books_transactions")
      .update({
        category_id: match.categoryId,
        metadata: {
          ...(tx?.metadata ?? {}),
          category_assignment: {
            method: match.method,
            confidence: match.confidence,
            category_name: match.categoryName,
            rule_id: match.ruleId ?? null,
            assigned_at: now,
          },
        },
        updated_at: now,
      })
      .eq("id", match.transactionId)
      .eq("user_id", userId)
      .is("category_id", null);

    if (!error) applied += 1;
    if (error) console.warn("[bulk-categorize] Failed to update transaction", tx?.description, error.message);
  }

  return applied;
}

export async function bulkCategorizeTransactions(
  supabase: SupabaseLike,
  userId: string,
  options?: { limit?: number; useAI?: boolean; minConfidence?: number }
): Promise<BulkCategorizationResult> {
  const limit = options?.limit ?? 5000;
  const minConfidence = options?.minConfidence ?? 0.85;
  const useAI = options?.useAI ?? true;

  const initialCategories = await fetchCategories(supabase, userId);
  const { categories, created } = await ensureDefaultCategories(supabase, userId, initialCategories);
  const [uncategorized, categorized, categoryRules] = await Promise.all([
    fetchUncategorizedTransactions(supabase, userId, limit),
    fetchCategorizedTransactions(supabase, userId),
    fetchCategoryRules(supabase, userId),
  ]);

  const txById = new Map(uncategorized.map((tx) => [tx.id, tx]));
  const learnedRules = buildLearnedRules(categorized);
  const matches: CategorizationMatch[] = [];
  const leftovers: TransactionRow[] = [];

  for (const tx of uncategorized) {
    const explicitRule = getCategoryRuleMatch(tx, categoryRules, categories);
    if (explicitRule) {
      matches.push(explicitRule);
      continue;
    }

    const learned = getLearnedMatch(tx, learnedRules, categories);
    if (learned) {
      matches.push(learned);
      continue;
    }

    const defaultMatch = getDefaultMatch(tx, categories);
    if (defaultMatch) {
      matches.push(defaultMatch);
      continue;
    }

    leftovers.push(tx);
  }

  if (useAI && leftovers.length > 0) {
    try {
      const aiResults = await aiCategorizeTransactions(
        leftovers.map((tx) => ({
          id: tx.id,
          description: tx.description,
          merchant: tx.merchant ?? undefined,
          amount: Number(tx.amount),
          type: tx.transaction_type ?? tx.type ?? undefined,
        })),
        categories.map((category) => ({ id: Number(category.id), name: category.name }))
      );

      for (const result of aiResults) {
        if (result.confidence < minConfidence) continue;
        const category = categoryByName(categories, result.categoryName);
        if (!category) continue;
        matches.push({
          transactionId: result.transactionId,
          categoryId: category.id,
          categoryName: category.name,
          confidence: result.confidence,
          method: result.method === "rule_based" ? "rule_based" : "ai",
        });
      }
    } catch (error) {
      console.warn("[bulk-categorize] AI pass skipped:", error instanceof Error ? error.message : error);
    }
  }

  const confidentMatches = matches.filter((match) => match.confidence >= minConfidence);
  const applied = await applyMatches(supabase, userId, txById, confidentMatches);
  await updateRuleMatchCounts(supabase, confidentMatches.map((match) => match.ruleId).filter(Boolean) as string[]);

  return {
    scanned: uncategorized.length,
    categorized: applied,
    ruleMatches: confidentMatches.filter((match) => match.method === "category_rule" || match.method === "default_rule" || match.method === "rule_based").length,
    learnedMatches: confidentMatches.filter((match) => match.method === "learned_rule").length,
    aiMatches: confidentMatches.filter((match) => match.method === "ai").length,
    needsReview: Math.max(uncategorized.length - applied, 0),
    createdCategories: created,
    examples: confidentMatches.slice(0, 8).map((match) => ({
      description: txById.get(match.transactionId)?.description ?? "Transaction",
      categoryName: match.categoryName,
      confidence: match.confidence,
      method: match.method,
    })),
  };
}

export async function categorizeTransactionsByIds(
  supabase: SupabaseLike,
  userId: string,
  ids: string[],
  options?: { useAI?: boolean; minConfidence?: number }
): Promise<BulkCategorizationResult> {
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const minConfidence = options?.minConfidence ?? 0.85;
  const useAI = options?.useAI ?? true;

  const initialCategories = await fetchCategories(supabase, userId);
  const { categories, created } = await ensureDefaultCategories(supabase, userId, initialCategories);
  const [uncategorized, categorized, categoryRules] = await Promise.all([
    fetchUncategorizedTransactionsByIds(supabase, userId, uniqueIds),
    fetchCategorizedTransactions(supabase, userId),
    fetchCategoryRules(supabase, userId),
  ]);

  const txById = new Map(uncategorized.map((tx) => [tx.id, tx]));
  const learnedRules = buildLearnedRules(categorized);
  const matches: CategorizationMatch[] = [];
  const leftovers: TransactionRow[] = [];

  for (const tx of uncategorized) {
    const explicitRule = getCategoryRuleMatch(tx, categoryRules, categories);
    if (explicitRule) {
      matches.push(explicitRule);
      continue;
    }

    const learned = getLearnedMatch(tx, learnedRules, categories);
    if (learned) {
      matches.push(learned);
      continue;
    }

    const defaultMatch = getDefaultMatch(tx, categories);
    if (defaultMatch) {
      matches.push(defaultMatch);
      continue;
    }

    leftovers.push(tx);
  }

  if (useAI && leftovers.length > 0) {
    try {
      const aiResults = await aiCategorizeTransactions(
        leftovers.map((tx) => ({
          id: tx.id,
          description: tx.description,
          merchant: tx.merchant ?? undefined,
          amount: Number(tx.amount),
          type: tx.transaction_type ?? tx.type ?? undefined,
        })),
        categories.map((category) => ({ id: Number(category.id), name: category.name }))
      );

      for (const result of aiResults) {
        if (result.confidence < minConfidence) continue;
        const category = categoryByName(categories, result.categoryName);
        if (!category) continue;
        matches.push({
          transactionId: result.transactionId,
          categoryId: category.id,
          categoryName: category.name,
          confidence: result.confidence,
          method: result.method === "rule_based" ? "rule_based" : "ai",
        });
      }
    } catch (error) {
      console.warn("[auto-categorize] AI pass skipped:", error instanceof Error ? error.message : error);
    }
  }

  const confidentMatches = matches.filter((match) => match.confidence >= minConfidence);
  const applied = await applyMatches(supabase, userId, txById, confidentMatches);
  await updateRuleMatchCounts(supabase, confidentMatches.map((match) => match.ruleId).filter(Boolean) as string[]);

  return {
    scanned: uncategorized.length,
    categorized: applied,
    ruleMatches: confidentMatches.filter((match) => match.method === "category_rule" || match.method === "default_rule" || match.method === "rule_based").length,
    learnedMatches: confidentMatches.filter((match) => match.method === "learned_rule").length,
    aiMatches: confidentMatches.filter((match) => match.method === "ai").length,
    needsReview: Math.max(uncategorized.length - applied, 0),
    createdCategories: created,
    examples: confidentMatches.slice(0, 8).map((match) => ({
      description: txById.get(match.transactionId)?.description ?? "Transaction",
      categoryName: match.categoryName,
      confidence: match.confidence,
      method: match.method,
    })),
  };
}
