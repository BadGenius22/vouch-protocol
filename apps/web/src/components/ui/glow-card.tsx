'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: 'cyan' | 'purple' | 'green';
  hover?: boolean;
  children: React.ReactNode;
}

const glowColorMap = {
  cyan: {
    border: 'border-cyan-500/20',
    borderHover: 'hover:border-cyan-500/40',
    glow: 'hover:shadow-[0_0_30px_rgba(0,255,255,0.15)]',
    gradient: 'from-cyan-500/5',
    dot: 'bg-cyan-500',
  },
  purple: {
    border: 'border-purple-500/20',
    borderHover: 'hover:border-purple-500/40',
    glow: 'hover:shadow-[0_0_30px_rgba(153,69,255,0.15)]',
    gradient: 'from-purple-500/5',
    dot: 'bg-purple-500',
  },
  green: {
    border: 'border-green-500/20',
    borderHover: 'hover:border-green-500/40',
    glow: 'hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]',
    gradient: 'from-green-500/5',
    dot: 'bg-green-500',
  },
};

const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, glowColor = 'cyan', hover = false, children, ...props }, ref) => {
    const colors = glowColorMap[glowColor];

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-xl border bg-card/50 backdrop-blur-sm transition-all duration-300',
          colors.border,
          hover && colors.borderHover,
          hover && colors.glow,
          hover && 'hover:-translate-y-1',
          className
        )}
        {...props}
      >
        {/* Corner accent */}
        <div
          className={cn(
            'absolute top-0 right-0 w-20 h-20 opacity-50',
            `bg-gradient-to-bl ${colors.gradient} to-transparent`,
            'rounded-tr-xl pointer-events-none'
          )}
          aria-hidden="true"
        />

        {/* Scan line effect */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(transparent_50%,rgba(0,255,255,0.1)_50%)] bg-[length:100%_4px]" />
        </div>

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    );
  }
);
GlowCard.displayName = 'GlowCard';

// Card sub-components for consistency with shadcn pattern
const GlowCardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  )
);
GlowCardHeader.displayName = 'GlowCardHeader';

const GlowCardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-display font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
GlowCardTitle.displayName = 'GlowCardTitle';

const GlowCardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
GlowCardDescription.displayName = 'GlowCardDescription';

const GlowCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
GlowCardContent.displayName = 'GlowCardContent';

export { GlowCard, GlowCardHeader, GlowCardTitle, GlowCardDescription, GlowCardContent };
