import { BookOpen, Upload, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { PageHeader, Card, CardContent } from "@cashpile/ui";
import Link from "next/link";

export default function BooksPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Books"
        description="AI-powered accounting for your business and personal finances"
        actions={
          <Link href="/books/transactions" className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Upload className="h-4 w-4" /> Import transactions
          </Link>
        }
      />
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total income", icon: ArrowUpRight, color: "text-emerald-500" },
          { label: "Total expenses", icon: ArrowDownRight, color: "text-red-500" },
          { label: "Net cash flow", icon: TrendingUp, color: "text-blue-500" },
          { label: "Transactions", icon: BookOpen, color: "text-muted-foreground" },
        ].map(({ label, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div className="text-xl font-bold">—</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: "/books/transactions", label: "Transactions", desc: "View and manage all transactions" },
          { href: "/books/accounts", label: "Accounts", desc: "Financial accounts and UDAs" },
          { href: "/books/entities", label: "Business Entities", desc: "LLCs, rentals, corporations" },
          { href: "/books/reports", label: "Reports", desc: "P&L, Schedule E, cash flow" },
        ].map(({ href, label, desc }) => (
          <Link key={href} href={href} className="bg-background rounded-xl border p-4 hover:border-emerald-500/40 transition-colors">
            <div className="font-medium text-sm mb-1">{label}</div>
            <div className="text-xs text-muted-foreground">{desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
