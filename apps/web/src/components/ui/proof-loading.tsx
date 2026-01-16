'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';

interface ProofLoadingProps {
  status: 'idle' | 'loading' | 'success' | 'error';
  progress?: number;
  message?: string;
  className?: string;
}

const loadingMessages = [
  'Initializing zero-knowledge circuit...',
  'Computing witness values...',
  'Generating cryptographic proof...',
  'Applying constraint system...',
  'Finalizing proof output...',
];

export function ProofLoading({ status, progress = 0, message, className }: ProofLoadingProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');

  // Typing effect for loading messages
  useEffect(() => {
    if (status !== 'loading') {
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
      {status === 'loading' && (
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
                status === 'loading' && 'animate-spin-slow'
              )}
            />

            {/* Middle ring */}
            <div
              className={cn(
                'absolute inset-2 rounded-full border border-primary/50',
                status === 'loading' && 'animate-spin-slow'
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
                status === 'loading' && 'animate-spin-slow'
              )}
              style={{ animationDuration: '4s' }}
            />

            {/* Center icon */}
            <div
              className={cn(
                'absolute inset-6 rounded-full flex items-center justify-center transition-all duration-500',
                status === 'loading' && 'bg-primary/20',
                status === 'success' && 'bg-accent/20',
                status === 'error' && 'bg-destructive/20'
              )}
            >
              {status === 'success' ? (
                <Check className="w-8 h-8 text-accent" />
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
                status === 'loading' && 'bg-primary/20 opacity-100',
                status === 'success' && 'bg-accent/20 opacity-100',
                status === 'error' && 'bg-destructive/20 opacity-100',
                !['loading', 'success', 'error'].includes(status) && 'opacity-0'
              )}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Progress bar */}
        {status === 'loading' && (
          <div className="mb-6">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-secondary to-primary rounded-full transition-all duration-300 animate-gradient-shift"
                style={{ width: `${Math.max(progress, 5)}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-muted-foreground font-mono">Generating proof</span>
              <span className="text-xs text-primary font-mono">{progress.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Status message with typing effect */}
        <div className="text-center min-h-[24px]">
          <p className="font-mono text-sm">
            {status === 'loading' && (
              <span className="text-primary">
                {displayedText}
                <span className="animate-pulse">|</span>
              </span>
            )}
            {status === 'success' && (
              <span className="text-accent text-glow-green">Proof generated successfully!</span>
            )}
            {status === 'error' && (
              <span className="text-destructive">Proof generation failed. Please try again.</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
