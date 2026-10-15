"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "border-red-200 bg-red-50 text-red-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  pending_review: "border-amber-200 bg-amber-50 text-amber-700",
  in_review: "border-blue-200 bg-blue-50 text-blue-700",
  open: "border-red-200 bg-red-50 text-red-700",
  resolved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-zinc-200 bg-zinc-100 text-zinc-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
};

const formatNumber = (value: number) => new Intl.NumberFormat().format(value || 0);
export function Badge({ value }: { value?: string | null }) {
  const status = value || "pending";
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-md border px-2 text-xs font-semibold capitalize",
        statusStyles[status] ?? "border-zinc-200 bg-zinc-100 text-zinc-700",
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-3 py-3 sm:gap-3 sm:px-4">
        <h2 className="min-w-0 break-words text-base font-bold text-zinc-950">{title}</h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="min-w-0 p-3 sm:p-4">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "section";
  return (
    <Component
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm sm:p-4",
        onClick && "transition hover:border-blue-300 hover:bg-blue-50/40",
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-lg",
          tone,
        )}
      >
        <Icon className="size-5" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-words text-2xl font-black text-zinc-950 sm:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{detail}</p>
    </Component>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm font-semibold text-zinc-500">
      {message}
    </div>
  );
}

export function PaginationControls({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 text-sm text-zinc-500">
      <span>
        {formatNumber(total)} record{total === 1 ? "" : "s"} - page {page} of{" "}
        {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}



