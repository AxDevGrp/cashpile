"use client";

import { useRouter } from "next/navigation";
import { PageHeader, Badge, Card, CardHeader, CardTitle, CardContent } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { formatCurrency } from "@cashpile/ui";
import type { BooksEntity, PnLReport, CashFlowReport, ScheduleEReport } from "@/modules/books/types";

interface Props {
  entities: BooksEntity[];
  selectedEntityId: string;
  year: number;
  pnl: PnLReport | null;
  cashFlow: CashFlowReport | null;
  scheduleE: ScheduleEReport | null;
}

export default function ReportsClient({ entities, selectedEntityId, year, pnl, cashFlow, scheduleE }: Props) {
  const router = useRouter();

  function update(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    router.push(`/books/reports?${params.toString()}`);
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="P&L, cash flow, and Schedule E summaries" />

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={selectedEntityId} onValueChange={(v) => update("entityId", v)}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => update("year", v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* P&L Summary */}
      {pnl && (
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss — {year}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-950/20 p-4">
                <p className="text-xs text-muted-foreground">Total Income</p>
                <p className="text-xl font-semibold text-green-700 dark:text-green-400">{formatCurrency(pnl.totalIncome)}</p>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4">
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-semibold text-red-700 dark:text-red-400">{formatCurrency(pnl.totalExpenses)}</p>
              </div>
              <div className={`rounded-lg p-4 ${pnl.netIncome >= 0 ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                <p className="text-xs text-muted-foreground">Net Income</p>
                <p className={`text-xl font-semibold ${pnl.netIncome >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {formatCurrency(pnl.netIncome)}
                </p>
              </div>
            </div>

            {pnl.rows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="p-3 text-left font-medium">Category</th>
                      <th className="p-3 text-left font-medium">Type</th>
                      <th className="p-3 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pnl.rows.map((row) => (
                      <tr key={row.categoryId} className="border-b last:border-0">
                        <td className="p-3">{row.categoryName}</td>
                        <td className="p-3">
                          <Badge variant={row.type === "income" ? "default" : "secondary"} className="text-xs capitalize">
                            {row.type}
                          </Badge>
                        </td>
                        <td className={`p-3 text-right tabular-nums font-medium ${row.type === "income" ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(row.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cash Flow */}
      {cashFlow && cashFlow.months.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Cash Flow by Month — {year}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="p-2 text-left font-medium">Month</th>
                    <th className="p-2 text-right font-medium text-green-600">Inflows</th>
                    <th className="p-2 text-right font-medium text-red-600">Outflows</th>
                    <th className="p-2 text-right font-medium">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {cashFlow.months.map((m) => (
                    <tr key={m.month} className="border-b last:border-0">
                      <td className="p-2">{m.month}</td>
                      <td className="p-2 text-right tabular-nums text-green-600">{formatCurrency(m.inflows)}</td>
                      <td className="p-2 text-right tabular-nums text-red-600">{formatCurrency(m.outflows)}</td>
                      <td className={`p-2 text-right tabular-nums font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(m.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule E stub */}
      {scheduleE && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Schedule E — {year}</CardTitle>
              <Badge variant="outline" className="text-xs">Rental Income</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {scheduleE.properties.length === 0 ? (
              <p className="text-sm text-muted-foreground">No properties found for this entity.</p>
            ) : (
              <div className="space-y-4">
                {scheduleE.properties.map((prop) => (
                  <div key={prop.taxEntityId} className="border rounded-lg p-4 space-y-3">
                    <h3 className="font-medium">{prop.taxEntityName}</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Rental Income</p>
                        <p className="font-medium text-green-600">{formatCurrency(prop.income)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Total Expenses</p>
                        <p className="font-medium text-red-600">
                          {formatCurrency(Object.values(prop.expenses).reduce((s, v) => s + v, 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Net Income</p>
                        <p className={`font-medium ${prop.netIncome >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {formatCurrency(prop.netIncome)}
                        </p>
                      </div>
                    </div>
                    {Object.keys(prop.expenses).length > 0 && (
                      <div className="text-xs space-y-1">
                        {Object.entries(prop.expenses).map(([cat, amt]) => (
                          <div key={cat} className="flex justify-between text-muted-foreground">
                            <span>{cat}</span>
                            <span>{formatCurrency(amt)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!pnl && !cashFlow && !scheduleE && (
        <div className="text-center text-muted-foreground p-12">
          No transaction data for this entity and year yet.
        </div>
      )}
    </div>
  );
}
