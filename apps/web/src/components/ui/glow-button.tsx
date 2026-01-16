'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glowButtonVariants = cva(
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 overflow-hidden group',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border bg-transparent hover:bg-primary/10',
        ghost: 'hover:bg-primary/10',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-9 rounded-md px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
      glowColor: {
        cyan: '',
        purple: '',
        green: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      glowColor: 'cyan',
    },
  }
);

const glowStyles = {
  cyan: {
    shadow: 'shadow-[0_0_15px_rgba(0,255,255,0.3)] hover:shadow-[0_0_25px_rgba(0,255,255,0.5)]',
    border: 'border-cyan-400/50 hover:border-cyan-400/80',
    shimmer: 'via-cyan-400/30',
  },
  purple: {
    shadow: 'shadow-[0_0_15px_rgba(153,69,255,0.3)] hover:shadow-[0_0_25px_rgba(153,69,255,0.5)]',
    border: 'border-purple-400/50 hover:border-purple-400/80',
    shimmer: 'via-purple-400/30',
  },
  green: {
    shadow: 'shadow-[0_0_15px_rgba(0,255,136,0.3)] hover:shadow-[0_0_25px_rgba(0,255,136,0.5)]',
    border: 'border-green-400/50 hover:border-green-400/80',
    shimmer: 'via-green-400/30',
  },
};

export interface GlowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glowButtonVariants> {
  asChild?: boolean;
}

const GlowButton = React.forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ className, variant, size, glowColor = 'cyan', asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const glow = glowStyles[glowColor || 'cyan'];

    return (
      <Comp
        className={cn(
          glowButtonVariants({ variant, size, glowColor, className }),
          glow.shadow,
          variant === 'outline' && glow.border
        )}
        ref={ref}
        {...props}
      >
        {/* Shimmer effect on hover */}
        <span
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
            'bg-gradient-to-r from-transparent to-transparent',
            glow.shimmer,
            '-translate-x-full group-hover:translate-x-full transition-transform duration-700'
          )}
          aria-hidden="true"
        />

        {/* Content */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {children}
        </span>
      </Comp>
    );
  }
);
GlowButton.displayName = 'GlowButton';

export { GlowButton, glowButtonVariants };
