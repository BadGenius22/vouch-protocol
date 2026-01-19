'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';

// Dynamic import for Three.js scene (no SSR)
const HeroScene = dynamic(() => import('./hero-scene').then((mod) => mod.HeroScene), {
  ssr: false,
  loading: () => <HeroFallback />,
});

// Pre-generated particle positions for deterministic rendering
const PARTICLE_POSITIONS = Array.from({ length: 20 }, (_, i) => ({
  left: ((i * 37 + 13) % 100),
  top: ((i * 53 + 7) % 100),
  delay: (i * 0.25) % 5,
  duration: 4 + (i % 4),
}));

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
      {PARTICLE_POSITIONS.map((pos, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/50 animate-float"
          style={{
            left: `${pos.left}%`,
            top: `${pos.top}%`,
            animationDelay: `${pos.delay}s`,
            animationDuration: `${pos.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export function HeroCanvas() {
  const [canRender, setCanRender] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Sync React state with external browser capabilities (WebGL, reduced motion preference)
  // This effect correctly runs once on mount to read browser state
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      const hasWebGL = !!gl;
      const isLowEnd = window.innerWidth < 768 && /Android|iPhone/i.test(navigator.userAgent);

      setPrefersReducedMotion(mediaQuery.matches);
      setCanRender(hasWebGL && !mediaQuery.matches && !isLowEnd);
    } catch {
      setCanRender(false);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
