import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/expenses";
import { listAllExpenses, parseExpenseFilters } from "@/lib/queries/expenses";
import { today } from "@/lib/utils";

/** CSV of all expenses matching the list page's filters (?q=, ?category=, ?month=). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const filters = parseExpenseFilters(Object.fromEntries(request.nextUrl.searchParams));
  const rows = await listAllExpenses(filters);
  const csv = toCsv(rows, [
    { header: "Date", value: (r) => r.date },
    { header: "Description", value: (r) => r.description },
    { header: "Vendor", value: (r) => r.vendor },
    { header: "Category", value: (r) => EXPENSE_CATEGORY_LABEL[r.category] },
    { header: "Amount", value: (r) => (r.amountCents / 100).toFixed(2) },
    { header: "Notes", value: (r) => r.notes },
  ]);

  const filename = `expenses-${filters.month ?? today()}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
