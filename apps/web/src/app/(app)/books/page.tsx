import { BookOpen, Upload, Building2, Landmark, Tags, ArrowRight, ListChecks, Settings } from "lucide-react";
import { createServerSupabaseClient } from "@cashpile/db";
import { PageHeader, Card, CardContent } from "@cashpile/ui";
import Link from "next/link";

async function getBooksDataStatus(userId: string) {
  const supabase = await createServerSupabaseClient();

  const [transactions, accounts, entities, uncategorized, categoryRules] = await Promise.all([
    (supabase as any)
      .from("books_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    (supabase as any)
      .from("books_financial_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_active", true),
    (supabase as any)
      .from("books_business_entities")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    (supabase as any)
      .from("books_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("category_id", null),
    (supabase as any)
      .from("books_category_rules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return {
    transactionCount: transactions.count ?? 0,
    accountCount: accounts.count ?? 0,
    entityCount: entities.count ?? 0,
    uncategorizedCount: uncategorized.count ?? 0,
    categoryRuleCount: categoryRules.count ?? 0,
  };
}

export default async function BooksPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const status = await getBooksDataStatus(user.id);

  const workingTasks = [
    {
      href: "/books/transactions",
      label: "Transactions",
      desc: "Main workspace: choose an account to review its ledger, or search globally across all accounts.",
      value: status.transactionCount.toLocaleString(),
      valueLabel: "transactions",
      icon: BookOpen,
    },
    {
      href: "/books/transactions?filter=uncategorized",
      label: "Categorization queue",
      desc: "Work through transactions that need category review.",
      value: status.uncategorizedCount.toLocaleString(),
      valueLabel: "need review",
      icon: Tags,
    },
  ];

  const setupTasks = [
    {
      href: "/books/accounts",
      label: "Accounts",
      desc: "Set up literal financial accounts: banks, credit cards, checking, savings, and Plaid connections.",
      value: status.accountCount.toLocaleString(),
      valueLabel: "financial accounts",
      icon: Landmark,
    },
    {
      href: "/books/entities",
      label: "Entities",
      desc: "Set up LLCs, rentals, businesses, and other tax/reporting entities.",
      value: status.entityCount.toLocaleString(),
      valueLabel: "entities",
      icon: Building2,
    },
    {
      href: "/books/category-rules",
      label: "Category rules",
      desc: "Reusable merchant rules applied before AI categorization.",
      value: status.categoryRuleCount.toLocaleString(),
      valueLabel: "rules",
      icon: ListChecks,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Books"
        description="Manage the financial data Cashpile uses for cash flow, Cashboard, reporting, and taxes."
        actions={
          <Link href="/books/transactions/import" className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Upload className="h-4 w-4" /> Import transactions
          </Link>
        }
      />

      <div className="rounded-xl border bg-card p-5">
        <div className="text-sm font-medium mb-1">Recommended workflow</div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Use <span className="font-medium text-foreground">Transactions</span> as the daily workspace: pick an account to view its ledger, or search globally when you need to find something. Accounts, Entities, and Rules are setup/data-cleanup tools.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Work with transaction data</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {workingTasks.map(({ href, label, desc, value, valueLabel, icon: Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full hover:border-emerald-500/40 transition-colors">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <div className="font-semibold text-base mb-1">{label}</div>
                    <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold">{value}</div>
                    <div className="text-[11px] text-muted-foreground">{valueLabel}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Setup and data cleanup</h2>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {setupTasks.map(({ href, label, desc, value, valueLabel, icon: Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full hover:border-slate-400/40 transition-colors">
                <CardContent className="pt-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-9 w-9 rounded-lg bg-slate-500/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">{label}</div>
                    <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="text-lg font-semibold">{value}</div>
                    <div className="text-[11px] text-muted-foreground">{valueLabel}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
