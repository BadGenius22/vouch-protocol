'use client';

import { cn } from '@/lib/utils';
import { ArrowRight, Code2, Copy, Rocket, Zap } from 'lucide-react';
import { useState } from 'react';

export interface CardFlipProps {
  title?: string;
  subtitle?: string;
  description?: string;
  features?: string[];
  color?: string;
  icon?: React.ReactNode;
  href?: string;
}

export default function CardFlip({
  title = 'Build MVPs Fast',
  subtitle = 'Launch your idea in record time',
  description = 'Copy, paste, customize—and launch your MVP faster than ever with our developer-first component library.',
  features = [
    'Copy & Paste Ready',
    'Developer-First',
    'MVP Optimized',
    'Zero Setup Required',
  ],
  color = '#ff2e88',
  icon,
  href,
}: CardFlipProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    if (href) {
      window.location.href = href;
    }
  };

  return (
    <div
      style={{
        ['--primary' as string]: color ?? '#2563eb',
      }}
      className="group relative h-[360px] w-full max-w-[300px] [perspective:2000px]"
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className={cn(
          'relative h-full w-full',
          '[transform-style:preserve-3d]',
          'transition-all duration-700',
          isFlipped
            ? '[transform:rotateY(180deg)]'
            : '[transform:rotateY(0deg)]',
        )}
      >
        {/* Front of card */}
        <div
          className={cn(
            'absolute inset-0 h-full w-full',
            '[transform:rotateY(0deg)] [backface-visibility:hidden]',
            'overflow-hidden rounded-2xl',
            'bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-800',
            'border border-zinc-800/50',
            'shadow-xl',
            'transition-all duration-700',
            'group-hover:shadow-2xl',
            'group-hover:border-[var(--primary)]/30',
            isFlipped ? 'opacity-0' : 'opacity-100',
          )}
        >
          {/* Background gradient effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-blue-500/10" />

          {/* Animated code blocks */}
          <div className="absolute inset-0 flex items-center justify-center pt-20">
            <div className="relative flex h-[100px] w-[200px] flex-col items-center justify-center gap-2">
              {/* Code blocks animation */}
              {[
                { width: 75, margin: 5 },
                { width: 90, margin: 10 },
                { width: 65, margin: 15 },
                { width: 85, margin: 8 },
                { width: 70, margin: 12 },
                { width: 95, margin: 3 },
              ].map((block, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-3 w-full rounded-sm',
                    'bg-gradient-to-r from-[var(--primary)]/20 via-[var(--primary)]/30 to-[var(--primary)]/20',
                    'animate-[slideIn_2s_ease-in-out_infinite]',
                    'opacity-0',
                  )}
                  style={{
                    width: `${block.width}%`,
                    animationDelay: `${i * 0.2}s`,
                    marginLeft: `${block.margin}%`,
                  }}
                />
              ))}

              {/* Central icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    'h-12 w-12 rounded-xl',
                    'bg-gradient-to-br from-[var(--primary)] via-[var(--primary)]/90 to-[var(--primary)]/80',
                    'flex items-center justify-center',
                    'shadow-lg shadow-[var(--primary)]/25',
                    'animate-pulse',
                    'transition-all duration-500 group-hover:scale-110 group-hover:rotate-12',
                  )}
                >
                  {icon || <Rocket className="h-6 w-6 text-white" />}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom content */}
          <div className="absolute right-0 bottom-0 left-0 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <h3 className="text-lg leading-snug font-semibold tracking-tight text-white transition-all duration-500 ease-out group-hover:translate-y-[-4px]">
                  {title}
                </h3>
                <p className="line-clamp-2 text-sm tracking-tight text-zinc-300 transition-all delay-75 duration-500 ease-out group-hover:translate-y-[-4px]">
                  {subtitle}
                </p>
              </div>
              <div className="group/icon relative">
                <div
                  className={cn(
                    'absolute inset-[-8px] rounded-lg transition-opacity duration-300',
                    'bg-gradient-to-br from-[var(--primary)]/20 via-[var(--primary)]/10 to-transparent',
                    'opacity-0 group-hover/icon:opacity-100',
                  )}
                />
                <Zap className="relative z-10 h-5 w-5 text-[var(--primary)] transition-all duration-300 group-hover/icon:scale-110 group-hover/icon:rotate-12" />
              </div>
            </div>
          </div>
        </div>

        {/* Back of card */}
        <div
          className={cn(
            'absolute inset-0 h-full w-full',
            '[transform:rotateY(180deg)] [backface-visibility:hidden]',
            'rounded-2xl p-5',
            'bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-800',
            'border border-zinc-800',
            'shadow-xl',
            'flex flex-col',
            'transition-all duration-700',
            'group-hover:shadow-2xl',
            'group-hover:border-[var(--primary)]/30',
            !isFlipped ? 'opacity-0' : 'opacity-100',
          )}
        >
          {/* Background gradient */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-blue-500/10" />

          <div className="relative z-10 flex-1 space-y-5">
            <div className="space-y-2">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--primary)] via-[var(--primary)]/90 to-[var(--primary)]/80">
                  {icon || <Code2 className="h-4 w-4 text-white" />}
                </div>
                <h3 className="text-lg leading-snug font-semibold tracking-tight text-white transition-all duration-500 ease-out group-hover:translate-y-[-2px]">
                  {title}
                </h3>
              </div>
              <p className="line-clamp-2 text-sm tracking-tight text-zinc-400 transition-all duration-500 ease-out group-hover:translate-y-[-2px]">
                {description}
              </p>
            </div>

            <div className="space-y-2.5">
              {features.map((feature, index) => {
                const icons = [Copy, Code2, Rocket, Zap];
                const IconComponent = icons[index % icons.length];

                return (
                  <div
                    key={feature}
                    className="flex items-center gap-3 text-sm text-zinc-300 transition-all duration-500"
                    style={{
                      transform: isFlipped
                        ? 'translateX(0)'
                        : 'translateX(-10px)',
                      opacity: isFlipped ? 1 : 0,
                      transitionDelay: `${index * 100 + 200}ms`,
                    }}
                  >
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-[var(--primary)]/20">
                      <IconComponent className="h-3 w-3 text-[var(--primary)]" />
                    </div>
                    <span className="font-medium">{feature}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative z-10 mt-auto border-t border-zinc-800 pt-4">
            <div
              onClick={handleClick}
              className={cn(
                'group/start relative',
                'flex items-center justify-between',
                'rounded-lg p-2.5',
                'transition-all duration-300',
                'bg-gradient-to-r from-zinc-800 via-zinc-800 to-zinc-800',
                'hover:from-[var(--primary)]/20 hover:via-[var(--primary)]/10 hover:to-transparent',
                'hover:scale-[1.02] hover:cursor-pointer',
                'hover:border-[var(--primary)]/20 border border-transparent',
              )}
            >
              <span className="text-sm font-semibold text-white transition-colors duration-300 group-hover/start:text-[var(--primary)]">
                Try Demo
              </span>
              <div className="group/icon relative">
                <div
                  className={cn(
                    'absolute inset-[-6px] rounded-lg transition-all duration-300',
                    'bg-gradient-to-br from-[var(--primary)]/20 via-[var(--primary)]/10 to-transparent',
                    'scale-90 opacity-0 group-hover/start:scale-100 group-hover/start:opacity-100',
                  )}
                />
                <ArrowRight className="relative z-10 h-4 w-4 text-[var(--primary)] transition-all duration-300 group-hover/start:translate-x-1 group-hover/start:scale-110" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideIn {
          0% {
            transform: translateX(-100px);
            opacity: 0;
          }
          50% {
            transform: translateX(0);
            opacity: 0.8;
          }
          100% {
            transform: translateX(100px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
