'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

// Dynamic import for Three.js scene (no SSR)
const HeroScene = dynamic(() => import('./hero-scene').then((mod) => mod.HeroScene), {
  ssr: false,
  loading: () => <HeroFallback />,
});

// Fallback for loading and low-end devices - CSS-only animated background
function HeroFallback() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Grid pattern background */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />

      {/* Animated glow orbs */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl animate-pulse-glow"
        style={{ background: 'radial-gradient(circle, rgba(0,255,255,0.15) 0%, transparent 70%)' }}
      />
      <div
        className="absolute top-1/3 left-1/3 w-64 h-64 rounded-full blur-3xl animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(153,69,255,0.1) 0%, transparent 70%)',
          animationDelay: '1s',
        }}
      />
      <div
        className="absolute bottom-1/3 right-1/3 w-48 h-48 rounded-full blur-3xl animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(0,255,136,0.1) 0%, transparent 70%)',
          animationDelay: '2s',
        }}
      />

      {/* Floating particles (CSS) */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/50 animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${4 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HeroCanvas() {
  const [canRender, setCanRender] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    // Check WebGL support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const hasWebGL = !!gl;

      // Check if device is likely low-end (mobile with small screen)
      const isLowEnd = window.innerWidth < 768 && /Android|iPhone/i.test(navigator.userAgent);

      setCanRender(hasWebGL && !mediaQuery.matches && !isLowEnd);
    } catch {
      setCanRender(false);
    }
  }, []);

  // Always show fallback for reduced motion or no WebGL
  if (!canRender || prefersReducedMotion) {
    return <HeroFallback />;
  }

  return (
    <div className="absolute inset-0 -z-10">
      <HeroScene />
    </div>
  );
}
