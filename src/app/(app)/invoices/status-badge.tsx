import { Badge } from "@/components/ui/badge";
import { STATUS_TONE, type DisplayStatus } from "@/lib/invoices";

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partially paid",
  overdue: "Overdue",
  paid: "Paid",
  void: "Void",
};

export function InvoiceStatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
