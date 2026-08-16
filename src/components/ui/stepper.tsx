"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface StepperStep {
  label: string;
  description?: string;
}

interface StepperProps {
  steps: StepperStep[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav className={cn("w-full", className)}>
      {/* Desktop */}
      <ol className="hidden sm:flex items-center w-full">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <li
              key={index}
              className={cn(
                "flex items-center",
                index < steps.length - 1 && "flex-1"
              )}
            >
              <div className="flex items-center gap-3">
                {/* Circle */}
                <div
                  className={cn(
                    "flex items-center justify-center h-9 w-9 rounded-full text-sm font-semibold shrink-0 transition-all duration-200",
                    isCompleted &&
                      "bg-primary-500 text-white",
                    isCurrent &&
                      "bg-primary-500/20 text-primary-400 ring-2 ring-primary-500",
                    !isCompleted &&
                      !isCurrent &&
                      "bg-white/[0.06] text-neutral-500"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {/* Label */}
                <div className="hidden lg:block">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCurrent
                        ? "text-primary-700"
                        : isCompleted
                        ? "text-neutral-700"
                        : "text-neutral-400"
                    )}
                  >
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 rounded-full transition-colors duration-200",
                    isCompleted ? "bg-primary-500" : "bg-white/[0.06]"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile: compact */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary-400">
            Etapa {currentStep + 1} de {steps.length}
          </span>
          <span className="text-sm text-neutral-400">
            {steps[currentStep]?.label}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-500 rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${((currentStep + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
