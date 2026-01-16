'use client';

import { useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, Zap, Shield, Cpu, Database, Clock } from 'lucide-react';

interface ProofLoadingProps {
  status: 'idle' | 'loading' | 'preparing' | 'generating' | 'success' | 'error';
  progress?: number;
  message?: string;
  errorDetails?: string;
  fromCache?: boolean;
  className?: string;
}

// Proof generation steps with estimated time per step
const PROOF_STEPS = [
  { id: 'preparing', label: 'Preparing inputs', icon: Database, duration: 2 },
  { id: 'loading', label: 'Loading circuit', icon: Cpu, duration: 5 },
  { id: 'generating', label: 'Generating proof', icon: Shield, duration: 15 },
  { id: 'complete', label: 'Complete', icon: Check, duration: 0 },
] as const;

const loadingMessages = [
  'Initializing zero-knowledge circuit...',
  'Computing witness values...',
  'Generating cryptographic proof...',
  'Applying constraint system...',
  'Finalizing proof output...',
];

export function ProofLoading({
  status,
  progress = 0,
  message,
  errorDetails,
  fromCache,
  className,
}: ProofLoadingProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [startTime] = useState(() => Date.now());

  // Calculate current step index based on status
  const currentStepIndex = useMemo(() => {
    switch (status) {
      case 'preparing':
        return 0;
      case 'loading':
        return 1;
      case 'generating':
        return 2;
      case 'success':
        return 3;
      default:
        return -1;
    }
  }, [status]);

  // Estimate remaining time
  const estimatedTimeRemaining = useMemo(() => {
    if (status === 'idle' || status === 'success' || status === 'error') return null;
    const elapsed = (Date.now() - startTime) / 1000;
    const progressFraction = progress / 100;
    if (progressFraction < 0.1) return 'Calculating...';
    const estimatedTotal = elapsed / progressFraction;
    const remaining = Math.max(0, estimatedTotal - elapsed);
    if (remaining < 5) return 'Almost done...';
    return `~${Math.ceil(remaining)}s remaining`;
  }, [status, progress, startTime]);

  // Typing effect for loading messages
  useEffect(() => {
    if (!['loading', 'preparing', 'generating'].includes(status)) {
      setDisplayedText('');
      setMessageIndex(0);
      return;
    }

    const currentMessage = message || loadingMessages[messageIndex % loadingMessages.length];
    let charIndex = 0;

    setDisplayedText('');

    const typeInterval = setInterval(() => {
      if (charIndex <= currentMessage.length) {
        setDisplayedText(currentMessage.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setMessageIndex((i) => i + 1);
        }, 1500);
      }
    }, 30);

    return () => clearInterval(typeInterval);
  }, [status, messageIndex, message]);

  if (status === 'idle') return null;

  return (
    <div
      className={cn(
        'relative p-8 rounded-xl border border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" aria-hidden="true" />

      {/* Scan line */}
      {['loading', 'preparing', 'generating'].includes(status) && (
        <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan-line" />
        </div>
      )}

      <div className="relative z-10">
        {/* Central visualization */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <div
              className={cn(
                'absolute inset-0 rounded-full border-2 border-primary/30',
                ['loading', 'preparing', 'generating'].includes(status) && 'animate-spin-slow'
              )}
            />

            {/* Middle ring */}
            <div
              className={cn(
                'absolute inset-2 rounded-full border border-primary/50',
                ['loading', 'preparing', 'generating'].includes(status) && 'animate-spin-slow'
              )}
              style={{
                animationDirection: 'reverse',
                animationDuration: '2s',
              }}
            />

            {/* Inner ring */}
            <div
              className={cn(
                'absolute inset-4 rounded-full border border-secondary/50',
                ['loading', 'preparing', 'generating'].includes(status) && 'animate-spin-slow'
              )}
              style={{ animationDuration: '4s' }}
            />

            {/* Center icon */}
            <div
              className={cn(
                'absolute inset-6 rounded-full flex items-center justify-center transition-all duration-500',
                ['loading', 'preparing', 'generating'].includes(status) && 'bg-primary/20',
                status === 'success' && 'bg-accent/20',
                status === 'error' && 'bg-destructive/20'
              )}
            >
              {status === 'success' ? (
                fromCache ? (
                  <Zap className="w-8 h-8 text-accent" />
                ) : (
                  <Check className="w-8 h-8 text-accent" />
                )
              ) : status === 'error' ? (
                <X className="w-8 h-8 text-destructive" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-primary animate-pulse-glow shadow-neon-cyan" />
              )}
            </div>

            {/* Glow effect */}
            <div
              className={cn(
                'absolute inset-0 rounded-full blur-xl transition-opacity duration-500',
                ['loading', 'preparing', 'generating'].includes(status) && 'bg-primary/20 opacity-100',
                status === 'success' && 'bg-accent/20 opacity-100',
                status === 'error' && 'bg-destructive/20 opacity-100',
                !['loading', 'preparing', 'generating', 'success', 'error'].includes(status) && 'opacity-0'
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Step indicators */}
        {['loading', 'preparing', 'generating'].includes(status) && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              {PROOF_STEPS.slice(0, -1).map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === currentStepIndex;
                const isComplete = index < currentStepIndex;
                return (
                  <div key={step.id} className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300',
                        isComplete && 'bg-accent/20 border-accent text-accent',
                        isActive && 'bg-primary/20 border-primary text-primary animate-pulse',
                        !isComplete && !isActive && 'bg-muted/20 border-muted-foreground/30 text-muted-foreground/50'
                      )}
                    >
                      {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] mt-1 font-mono',
                        isActive && 'text-primary',
                        isComplete && 'text-accent',
                        !isComplete && !isActive && 'text-muted-foreground/50'
                      )}
                    >
                      {step.label}
                    </span>
                    {/* Connector line */}
                    {index < PROOF_STEPS.length - 2 && (
                      <div
                        className={cn(
                          'absolute h-px w-12 top-4 left-1/2 ml-4',
                          isComplete ? 'bg-accent' : 'bg-muted-foreground/20'
                        )}
                        style={{ transform: `translateX(${(index - 1) * 100}%)` }}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-secondary to-primary rounded-full transition-all duration-300 animate-gradient-shift"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {estimatedTimeRemaining || 'Generating proof'}
              </span>
              <span className="text-xs text-primary font-mono">{progress.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Status message with typing effect */}
        <div className="text-center min-h-[48px]">
          <p className="font-mono text-sm">
            {['loading', 'preparing', 'generating'].includes(status) && (
              <span className="text-primary">
                {displayedText}
                <span className="animate-pulse">|</span>
              </span>
            )}
            {status === 'success' && (
              <span className="text-accent text-glow-green flex items-center justify-center gap-2">
                {fromCache ? (
                  <>
                    <Zap className="w-4 h-4" />
                    Using cached proof!
                  </>
                ) : (
                  'Proof generated successfully!'
                )}
              </span>
            )}
            {status === 'error' && (
              <span className="text-destructive">
                Proof generation failed.
                {errorDetails && (
                  <span className="block text-xs mt-1 text-destructive/70">{errorDetails}</span>
                )}
              </span>
            )}
          </p>
        </div>

        {/* Cache indicator for success */}
        {status === 'success' && fromCache && (
          <div className="mt-4 text-center">
            <span className="text-xs text-muted-foreground font-mono">
              Retrieved from local cache (instant)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
