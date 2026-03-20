"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useRef } from "react";
import * as THREE from "three";

function RotatingKart({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (group.current) {
      group.current.rotation.y = state.clock.getElapsedTime() * 0.5;
      group.current.position.y = Math.sin(state.clock.getElapsedTime() * 2) * 0.1;
    }
  });

  return (
    <group ref={group}>
      {/* Chassis */}
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[1.9, 0.45, 3.4]} />
        <meshStandardMaterial color="#5a5a5a" roughness={0.8} metalness={0.15} />
      </mesh>
      {/* Side stripes */}
      <mesh castShadow position={[0.85, 0.35, 0]}>
        <boxGeometry args={[0.22, 0.25, 2.8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-0.85, 0.35, 0]}>
        <boxGeometry args={[0.22, 0.25, 2.8]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Cabin */}
      <mesh castShadow position={[0, 0.72, -0.2]}>
        <boxGeometry args={[1.5, 0.55, 1.6]} />
        <meshStandardMaterial color={color} roughness={0.65} metalness={0.08} />
      </mesh>
      {/* Windshield */}
      <mesh position={[0, 0.75, -1.05]}>
        <boxGeometry args={[1.3, 0.4, 0.08]} />
        <meshStandardMaterial color="#222" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Bumpers */}
      <mesh castShadow position={[0, 0.12, -1.75]}>
        <boxGeometry args={[1.7, 0.25, 0.25]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh castShadow position={[0, 0.12, 1.75]}>
        <boxGeometry args={[1.7, 0.25, 0.25]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      {/* Headlights */}
      <mesh position={[-0.6, 0.3, -1.78]}>
        <boxGeometry args={[0.3, 0.2, 0.08]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[0.6, 0.3, -1.78]}>
        <boxGeometry args={[0.3, 0.2, 0.08]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.6, 0.3, 1.78]}>
        <boxGeometry args={[0.25, 0.15, 0.08]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.6, 0.3, 1.78]}>
        <boxGeometry args={[0.25, 0.15, 0.08]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={1} />
      </mesh>
      {/* Wheels */}
      {[[-0.95, -0.02, -1.15], [0.95, -0.02, -1.15], [-0.95, -0.02, 1.15], [0.95, -0.02, 1.15]].map((pos, i) => (
        <mesh key={i} castShadow position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[i < 2 ? 0.32 : 0.35, i < 2 ? 0.32 : 0.35, i < 2 ? 0.22 : 0.26, 16]} />
          <meshStandardMaterial color="#111" roughness={0.9} />
        </mesh>
      ))}
      {/* Roll bar */}
      <mesh castShadow position={[0, 1.05, 0.2]}>
        <boxGeometry args={[1.6, 0.08, 0.08]} />
        <meshStandardMaterial color="#333" metalness={0.5} />
      </mesh>
    </group>
  );
}

export function KartShowcase({ color = "#8b1a1a" }: { color?: string }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen overflow-hidden">
      <Canvas
        camera={{ position: [5, 3, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} color="#ffffff" />
        <directionalLight position={[10, 10, 5]} intensity={2} color="#ffddaa" />
        <directionalLight position={[-10, 5, -5]} intensity={1} color="#aaaaff" />
        
        <Suspense fallback={null}>
          <RotatingKart color={color} />
        </Suspense>
      </Canvas>
    </div>
  );
}
