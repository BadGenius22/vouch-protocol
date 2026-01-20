'use client';

import { cn } from '@/lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: string;
  completedSteps: string[];
  className?: string;
}

export function StepIndicator({
  steps,
  currentStep,
  completedSteps,
  className,
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className={cn('flex items-center justify-between', className)}>
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPast = index < currentIndex;

        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500',
                  isCompleted && 'bg-white border-white',
                  isCurrent && 'border-white bg-white/20 animate-pulse',
                  !isCompleted && !isCurrent && 'border-white/20 bg-white/5'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-black" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <span className="text-sm font-mono text-neutral-500">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-2 font-medium transition-colors whitespace-nowrap',
                  isCompleted && 'text-white',
                  isCurrent && 'text-white',
                  !isCompleted && !isCurrent && 'text-neutral-500'
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 md:mx-4 mt-[-24px]">
                <div
                  className={cn(
                    'h-0.5 transition-all duration-500 rounded-full',
                    isPast || isCompleted
                      ? 'bg-white'
                      : 'bg-white/10'
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
