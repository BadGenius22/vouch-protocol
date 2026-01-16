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
                  isCompleted && 'bg-primary border-primary shadow-neon-cyan',
                  isCurrent && 'border-primary bg-primary/20 animate-pulse-glow shadow-neon-cyan',
                  !isCompleted && !isCurrent && 'border-muted-foreground/30 bg-muted/50'
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5 text-primary-foreground" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <span className="text-sm font-mono text-muted-foreground">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs mt-2 font-medium transition-colors whitespace-nowrap',
                  isCompleted && 'text-primary',
                  isCurrent && 'text-primary text-glow-cyan',
                  !isCompleted && !isCurrent && 'text-muted-foreground'
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
                      ? 'bg-gradient-to-r from-primary to-primary shadow-[0_0_8px_rgba(0,255,255,0.5)]'
                      : 'bg-muted-foreground/20'
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
