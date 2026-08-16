"use client";

import { cn } from "@/lib/utils";
import React from "react";

/* ─── Input ─── */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helper, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm",
            "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
            "focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            "transition-all outline-none",
            error
               ? "border-danger-500/40 focus:ring-danger-500/20 focus:border-danger-400"
              : "border-neutral-200 dark:border-white/10",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {helper && !error && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{helper}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

/* ─── Textarea ─── */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, helper, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm",
            "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 min-h-[100px] resize-y",
            "placeholder:text-neutral-400 dark:placeholder:text-neutral-500",
            "focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            "transition-all outline-none",
            error
              ? "border-danger-500/40 focus:ring-danger-500/20 focus:border-danger-400"
              : "border-neutral-200 dark:border-white/10",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {helper && !error && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{helper}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

/* ─── Select ─── */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, helper, error, options, placeholder, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full border rounded-[var(--radius-md)] px-3.5 py-2.5 text-sm",
            "bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 appearance-none",
            "focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400",
            "transition-all outline-none cursor-pointer",
            error
              ? "border-danger-500/40 focus:ring-danger-500/20 focus:border-danger-400"
              : "border-neutral-200 dark:border-white/10",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
        {helper && !error && (
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{helper}</p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Input, Select, Textarea };
