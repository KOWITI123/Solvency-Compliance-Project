import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle } from "lucide-react";
interface ComplianceBadgeProps {
  status: 'Compliant' | 'Non-Compliant';
  className?: string;
}
export function ComplianceBadge({ status, className }: ComplianceBadgeProps) {
  const isCompliant = status === 'Compliant';
  return (
    <Badge
      className={cn(
        "flex items-center gap-2 text-sm font-semibold transition-all",
        isCompliant
          ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800"
          : "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",
        className
      )}
    >
      {isCompliant ? (
        <CheckCircle className="h-4 w-4" />
      ) : (
        <XCircle className="h-4 w-4" />
      )}
      <span>{status}</span>
    </Badge>
  );
}