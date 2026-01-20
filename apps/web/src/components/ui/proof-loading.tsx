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
        'relative p-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden',
        className
      )}
    >
      <div className="relative z-10">
        {/* Central visualization */}
        <div className="flex justify-center mb-8">
          <div className="relative w-24 h-24">
            {/* Outer ring */}
            <div
              className={cn(
                'absolute inset-0 rounded-full border-2 border-white/20',
                ['loading', 'preparing', 'generating'].includes(status) && 'animate-spin-slow'
              )}
            />

            {/* Middle ring */}
            <div
              className={cn(
                'absolute inset-2 rounded-full border border-white/30',
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
                'absolute inset-4 rounded-full border border-white/40',
                ['loading', 'preparing', 'generating'].includes(status) && 'animate-spin-slow'
              )}
              style={{ animationDuration: '4s' }}
            />

            {/* Center icon */}
            <div
              className={cn(
                'absolute inset-6 rounded-full flex items-center justify-center transition-all duration-500',
                ['loading', 'preparing', 'generating'].includes(status) && 'bg-white/10',
                status === 'success' && 'bg-green-500/20',
                status === 'error' && 'bg-red-500/20'
              )}
            >
              {status === 'success' ? (
                fromCache ? (
                  <Zap className="w-8 h-8 text-green-400" />
                ) : (
                  <Check className="w-8 h-8 text-green-400" />
                )
              ) : status === 'error' ? (
                <X className="w-8 h-8 text-red-400" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
              )}
            </div>
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
                        isComplete && 'bg-green-500/20 border-green-500 text-green-400',
                        isActive && 'bg-white/10 border-white text-white animate-pulse',
                        !isComplete && !isActive && 'bg-white/5 border-white/20 text-neutral-500'
                      )}
                    >
                      {isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                    </div>
                    <span
                      className={cn(
                        'text-[10px] mt-1 font-mono',
                        isActive && 'text-white',
                        isComplete && 'text-green-400',
                        !isComplete && !isActive && 'text-neutral-500'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-neutral-400 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {estimatedTimeRemaining || 'Generating proof'}
              </span>
              <span className="text-xs text-white font-mono">{progress.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Status message with typing effect */}
        <div className="text-center min-h-[48px]">
          <p className="font-mono text-sm">
            {['loading', 'preparing', 'generating'].includes(status) && (
              <span className="text-white">
                {displayedText}
                <span className="animate-pulse">|</span>
              </span>
            )}
            {status === 'success' && (
              <span className="text-green-400 flex items-center justify-center gap-2">
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
              <span className="text-red-400">
                Proof generation failed.
                {errorDetails && (
                  <span className="block text-xs mt-1 text-red-400/70">{errorDetails}</span>
                )}
              </span>
            )}
          </p>
        </div>

        {/* Cache indicator for success */}
        {status === 'success' && fromCache && (
          <div className="mt-4 text-center">
            <span className="text-xs text-neutral-400 font-mono">
              Retrieved from local cache (instant)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
