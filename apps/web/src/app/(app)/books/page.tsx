import { ArrowRight, LayoutDashboard, ListChecks, Upload } from "lucide-react";
import { createServerSupabaseClient } from "@cashpile/db";
import { Card, CardContent, PageHeader } from "@cashpile/ui";
import Link from "next/link";
import { listAiInstructionOptions } from "@/modules/books/actions/ai-review.actions";
import { getTaxTestingAccess } from "@/lib/tax-access";
import { AskCashpilePanel } from "./_components/ask-cashpile-panel";

export default async function BooksPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [accounts, uncategorized, aiOptions, taxEnabled] = await Promise.all([
    (supabase as any)
      .from("books_financial_accounts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
    (supabase as any)
      .from("books_transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("category_id", null),
    listAiInstructionOptions(),
    getTaxTestingAccess(),
  ]);

  const tasks = [
    {
      href: "/books/transactions/import",
      label: "Import finances",
      desc: "Upload a bank CSV or connect an account to bring transactions into Cashpile.",
      value: (accounts.count ?? 0).toLocaleString(),
      valueLabel: "accounts",
      icon: Upload,
    },
    {
      href: "/books/transactions/ai-review",
      label: "Clean up with AI",
      desc: "Review grouped suggestions and save category rules for future transactions.",
      value: (uncategorized.count ?? 0).toLocaleString(),
      valueLabel: "need review",
      icon: ListChecks,
    },
    {
      href: "/cashboard",
      label: "See your cashboard",
      desc: "Use your cleaned-up financial data to understand what to do next.",
      value: "Next",
      valueLabel: "actionable cash flow",
      icon: LayoutDashboard,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Books"
        description="Import your finances, clean up your transactions, and keep your cashboard accurate."
        actions={
          <Link
            href="/books/transactions/import"
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Upload className="h-4 w-4" /> Import transactions
          </Link>
        }
      />

      <AskCashpilePanel
        categories={aiOptions.categories}
        taxEntities={taxEnabled ? aiOptions.taxEntities : []}
        accounts={aiOptions.accounts}
        description="Tell Cashpile how to categorize transactions and save rules for the future."
      />

      <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tasks.map(({ href, label, desc, value, valueLabel, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full hover:border-emerald-500/40 transition-colors">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-emerald-500" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
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
      </section>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link className="text-emerald-700 hover:underline" href="/books/transactions">
          Review transactions
        </Link>
        <Link className="text-emerald-700 hover:underline" href="/books/accounts">
          Manage accounts
        </Link>
        <Link className="text-emerald-700 hover:underline" href="/books/category-rules">
          Category rules
        </Link>
        {taxEnabled && (
          <Link className="text-emerald-700 hover:underline" href="/books/tax">
            Tax testing
          </Link>
        )}
      </div>
    </div>
  );
}
