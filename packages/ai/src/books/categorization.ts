import { getOpenAIClient, DEFAULT_MODEL } from "../client";

export interface TransactionForCategorization {
  id: string;
  description: string;
  amount: number;
  merchant?: string;
  type?: string;
}

export interface CategorizationResult {
  transactionId: string;
  categoryName: string;
  confidence: number;
  method: "ai" | "rule_based" | "fallback";
}

export interface Category {
  id: number;
  name: string;
}

// ─── Rule-based categorization (fast path, no API call) ──────────────────────

const RULES: Array<{ patterns: RegExp[]; category: string }> = [
  {
    patterns: [/credit card payment/i, /cc payment/i, /autopay.*credit/i, /visa.*payment/i, /mastercard.*payment/i, /amex.*payment/i, /chase.*payment/i, /capital one.*payment/i],
    category: "Transfers",
  },
  {
    patterns: [/transfer from/i, /transfer to/i, /wire transfer/i, /ach transfer/i, /zelle/i, /venmo/i, /cash app/i],
    category: "Transfers",
  },
  {
    patterns: [/direct deposit/i, /payroll/i, /salary/i, /wages/i, /bonus/i, /commission/i, /tax refund/i, /irs.*refund/i],
    category: "Income",
  },
  {
    patterns: [/refund/i, /return.*credit/i, /reversal/i, /cashback/i, /reimbursement/i, /rebate/i],
    category: "Income",
  },
  {
    patterns: [/monthly service fee/i, /maintenance fee/i, /overdraft fee/i, /nsf fee/i, /atm fee/i, /service charge/i, /annual fee/i, /late fee/i],
    category: "Bank Fees",
  },
  {
    patterns: [/restaurant/i, /food/i, /cafe/i, /coffee/i, /pizza/i, /burger/i, /mcdonald/i, /starbucks/i, /subway/i, /doordash/i, /uber eats/i, /grubhub/i, /kitchen/i, /bistro/i, /bakery/i],
    category: "Food & Dining",
  },
  {
    patterns: [/gas station/i, /fuel/i, /shell/i, /exxon/i, /chevron/i, /uber(?! eats)/i, /lyft/i, /taxi/i, /metro/i, /transit/i, /parking/i, /toll/i],
    category: "Transportation",
  },
  {
    patterns: [/amazon/i, /walmart/i, /target/i, /costco/i, /home depot/i, /best buy/i, /apple store/i, /macy/i, /nordstrom/i],
    category: "Shopping",
  },
  {
    patterns: [/netflix/i, /hulu/i, /disney.?plus/i, /spotify/i, /apple.?music/i, /youtube.?premium/i, /adobe/i, /microsoft.?365/i, /dropbox/i, /icloud/i, /subscription/i, /membership/i],
    category: "Subscriptions",
  },
  {
    patterns: [/electric/i, /power bill/i, /water bill/i, /internet/i, /comcast/i, /verizon/i, /at&t/i, /utility/i],
    category: "Bills & Utilities",
  },
  {
    patterns: [/doctor/i, /medical/i, /hospital/i, /pharmacy/i, /cvs/i, /walgreens/i, /dental/i, /vision/i, /prescription/i, /clinic/i],
    category: "Healthcare",
  },
  {
    patterns: [/movie/i, /theater/i, /concert/i, /ticket/i, /gym/i, /fitness/i, /bowling/i, /golf/i],
    category: "Entertainment",
  },
];

function ruleBasedCategorize(tx: TransactionForCategorization, categories: Category[]): CategorizationResult | null {
  const text = `${tx.type ?? ""} ${tx.description} ${tx.merchant ?? ""}`.toLowerCase();

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        const category = categories.find((c) => c.name.toLowerCase() === rule.category.toLowerCase());
        if (category) {
          return {
            transactionId: tx.id,
            categoryName: category.name,
            confidence: 0.82,
            method: "rule_based",
          };
        }
      }
    }
  }
  return null;
}

// ─── AI categorization (batch, OpenAI) ───────────────────────────────────────

export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  categories: Category[]
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];
  const needsAI: TransactionForCategorization[] = [];

  // First pass: rule-based
  for (const tx of transactions) {
    const ruleResult = ruleBasedCategorize(tx, categories);
    if (ruleResult) {
      results.push(ruleResult);
    } else {
      needsAI.push(tx);
    }
  }

  // Second pass: AI for unmatched transactions
  if (needsAI.length > 0) {
    try {
      const aiResults = await categorizeWithAI(needsAI, categories);
      results.push(...aiResults);
    } catch {
      // Fallback to "Other" if AI fails
      const otherCategory = categories.find((c) => c.name.toLowerCase() === "other");
      for (const tx of needsAI) {
        results.push({
          transactionId: tx.id,
          categoryName: otherCategory?.name ?? "Other",
          confidence: 0.3,
          method: "fallback",
        });
      }
    }
  }

  return results;
}

async function categorizeWithAI(
  transactions: TransactionForCategorization[],
  categories: Category[]
): Promise<CategorizationResult[]> {
  const client = getOpenAIClient();
  const categoryNames = categories.map((c) => c.name).join(", ");

  const prompt = `You are a financial transaction categorizer. Categorize each transaction into exactly one of these categories: ${categoryNames}.

Transactions to categorize (JSON array):
${JSON.stringify(transactions.map((t) => ({ id: t.id, description: t.description, amount: t.amount, merchant: t.merchant })))}

Return a JSON array with objects: { "transactionId": "...", "categoryName": "...", "confidence": 0.0-1.0 }
Only return valid JSON, no explanation.`;

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content);
  const items = Array.isArray(parsed) ? parsed : parsed.results ?? [];

  return items.map((item: { transactionId: string; categoryName: string; confidence: number }) => ({
    transactionId: item.transactionId,
    categoryName: item.categoryName,
    confidence: item.confidence ?? 0.7,
    method: "ai" as const,
  }));
}
