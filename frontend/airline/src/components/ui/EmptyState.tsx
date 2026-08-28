import { LucideIcon } from "lucide-react";

interface TableEmptyStateProps {
  colSpan: number;
  icon?: LucideIcon;
  title?: string;
  message?: string;
}

export function TableEmptyState({
  colSpan,
  icon: Icon,
  title,
  message = "No results found.",
}: TableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center gap-2">
          {Icon && <Icon className="w-6 h-6 text-slate-300" />}
          {title && <p className="text-sm font-medium text-slate-500">{title}</p>}
          <p className="text-sm text-slate-400">{message}</p>
        </div>
      </td>
    </tr>
  );
}
