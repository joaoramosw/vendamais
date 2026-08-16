import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      <div className="flex items-center justify-center h-14 w-14 rounded-full bg-white/[0.06] text-neutral-500 mb-4">
        {icon || <Inbox className="h-7 w-7" />}
      </div>
      <h3 className="text-base font-semibold text-neutral-200 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-neutral-400 max-w-sm mb-5">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
