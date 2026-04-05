import { NextRequest, NextResponse } from "next/server";
import { generateTaxReport } from "@/modules/books/actions/tax.actions";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { udaId, year, format = "csv" } = body;

  if (!udaId) return NextResponse.json({ error: "udaId required" }, { status: 400 });

  try {
    const report = await generateTaxReport({ udaId, year: year ?? new Date().getFullYear() });

    const rows = report.transactions.map((v) => ({
      Date: v.tax_date ?? v.books_transactions?.date ?? "",
      Description: v.books_transactions?.description ?? v.books_transactions?.merchant ?? "",
      Amount: v.books_transactions?.amount ?? 0,
      "Tax Amount": v.tax_amount ?? 0,
      "Business %": v.business_percentage,
      "Deduction %": v.deduction_percentage,
      "Tax Deductible": v.is_tax_deductible ? "Yes" : "No",
      Category: v.books_categories?.name ?? "Uncategorized",
      Notes: v.tax_notes ?? "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tax Transactions");

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="tax-report-${year}.csv"`,
        },
      });
    } else {
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buf, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="tax-report-${year}.xlsx"`,
        },
      });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
