'use client';

/// <reference types="@react-three/fiber" />

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Points, PointMaterial, Preload } from '@react-three/drei';
import * as THREE from 'three';

// Seeded pseudo-random number generator for deterministic rendering
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Particle field component - creates Matrix-like floating particles
function ParticleField({ count = 3000 }: { count?: number }) {
  const points = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribute particles in a sphere around the center using deterministic random
      const theta = seededRandom(i * 3) * Math.PI * 2;
      const phi = Math.acos(2 * seededRandom(i * 3 + 1) - 1);
      const r = 8 + seededRandom(i * 3 + 2) * 12; // Between 8 and 20 units from center

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
    }
    return pos;
  }, [count]);

  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.02;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
    }
  });

  return (
    <Points ref={points} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#00ffff"
        size={0.05}
        sizeAttenuation
        depthWrite={false}
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

// Central abstract shape - represents the "proof" or "verification"
function CentralGeometry() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.1;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
      <Sphere ref={meshRef} args={[1.2, 64, 64]}>
        <MeshDistortMaterial
          color="#00ffff"
          attach="material"
          distort={0.4}
          speed={2}
          roughness={0.1}
          metalness={0.9}
          emissive="#00ffff"
          emissiveIntensity={0.15}
          transparent
          opacity={0.85}
        />
      </Sphere>
    </Float>
  );
}

// Orbiting rings - represent cryptographic operations
function OrbitingRings() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring1.current) {
      ring1.current.rotation.x = t * 0.5;
      ring1.current.rotation.z = t * 0.3;
    }
    if (ring2.current) {
      ring2.current.rotation.y = t * 0.4;
      ring2.current.rotation.z = -t * 0.2;
    }
    if (ring3.current) {
      ring3.current.rotation.x = -t * 0.3;
      ring3.current.rotation.y = t * 0.25;
    }
  });

  return (
    <>
      <mesh ref={ring1}>
        <torusGeometry args={[2, 0.015, 16, 100]} />
        <meshBasicMaterial color="#9945ff" transparent opacity={0.7} />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[2.5, 0.015, 16, 100]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ring3}>
        <torusGeometry args={[3, 0.01, 16, 100]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.3} />
      </mesh>
    </>
  );
}

// Floating particles around center
function FloatingDots() {
  const groupRef = useRef<THREE.Group>(null);

  const dots = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      position: [
        (seededRandom(i * 5) - 0.5) * 6,
        (seededRandom(i * 5 + 1) - 0.5) * 6,
        (seededRandom(i * 5 + 2) - 0.5) * 6,
      ] as [number, number, number],
      scale: 0.02 + seededRandom(i * 5 + 3) * 0.03,
      speed: 0.5 + seededRandom(i * 5 + 4) * 1,
    }));
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {dots.map((dot, i) => (
        <Float key={i} speed={dot.speed} floatIntensity={0.5}>
          <mesh position={dot.position}>
            <sphereGeometry args={[dot.scale, 8, 8]} />
            <meshBasicMaterial color="#00ffff" transparent opacity={0.8} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

// Main scene composition
function Scene() {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.1} />

      {/* Colored point lights for neon effect */}
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#00ffff" />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#9945ff" />
      <pointLight position={[0, -10, 5]} intensity={0.2} color="#00ff88" />

      {/* Scene elements */}
      <ParticleField count={2500} />
      <CentralGeometry />
      <OrbitingRings />
      <FloatingDots />
    </>
  );
}

// Exported component for use in hero-canvas.tsx
export function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 8], fov: 60 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: 'transparent' }}
    >
      <Scene />
      <Preload all />
    </Canvas>
  );
}
