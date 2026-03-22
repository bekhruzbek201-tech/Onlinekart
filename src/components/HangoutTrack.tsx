"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Improved Bridge ── */
function Bridge({ position, rotation = [0, 0, 0], length = 40, width = 12 }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  width?: number;
}) {
  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders="cuboid">
      <group>
        <mesh>
          <boxGeometry args={[length, 0.5, width]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
        <mesh position={[0, 1, width / 2 - 0.2]}>
          <boxGeometry args={[length, 2, 0.3]} />
          <meshStandardMaterial color="#c41e1e" />
        </mesh>
        <mesh position={[0, 1, -width / 2 + 0.2]}>
          <boxGeometry args={[length, 2, 0.3]} />
          <meshStandardMaterial color="#c41e1e" />
        </mesh>
        <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[length, 0.2]} />
          <meshBasicMaterial color="#777" />
        </mesh>
      </group>
    </RigidBody>
  );
}

/* ── Highly Optimized Building ── */
function CityBuilding({ position, size, color, lit = false }: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  lit?: boolean;
}) {
  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <group>
        <mesh>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} roughness={0.9} />
        </mesh>
        {lit && (
          <mesh position={[0, size[1] / 3, 0]}>
            <boxGeometry args={[size[0] + 0.1, 1.2, size[2] + 0.1]} />
            <meshBasicMaterial color="#ffeeaa" />
          </mesh>
        )}
        <mesh position={[0, size[1] / 2 + 0.1, 0]}>
          <boxGeometry args={[size[0] + 0.4, 0.2, size[2] + 0.4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      </group>
    </RigidBody>
  );
}

/* ── Optimized Fountain ── */
function Fountain({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (waterRef.current) {
      waterRef.current.scale.y = 1 + Math.sin(Date.now() * 0.003) * 0.2;
    }
  });

  return (
    <RigidBody type="fixed" position={position} colliders="hull">
      <group>
        <mesh>
          <cylinderGeometry args={[6, 7, 1.5, 8]} />
          <meshStandardMaterial color="#555" />
        </mesh>
        <mesh position={[0, 0.4, 0]}>
          <cylinderGeometry args={[5.8, 5.8, 0.2, 8]} />
          <meshStandardMaterial color="#1a4466" transparent opacity={0.6} />
        </mesh>
        <mesh ref={waterRef} position={[0, 2, 0]}>
          <coneGeometry args={[0.5, 4, 6]} />
          <meshBasicMaterial color="#4488bb" transparent opacity={0.4} />
        </mesh>
      </group>
    </RigidBody>
  );
}

export const HangoutTrack = memo(function HangoutTrack() {
  return (
    <group>
      {/* ══════════ THE GROUND PLATFORM ══════════ */}
      {/* Merging main ground and roads into one RigidBody to save physics overhead */}
      <RigidBody type="fixed" friction={0.9}>
        {/* Main dark floor */}
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[1000, 1, 1000]} />
          <meshStandardMaterial color="#1f1f1f" />
        </mesh>
        
        {/* Road system (planes) */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[20, 600]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[20, 600]} />
          <meshStandardMaterial color="#2d2d2d" />
        </mesh>

        {/* Center Lines - Basic Material is cheaper */}
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 600]} />
          <meshBasicMaterial color="#d4a017" />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.3, 600]} />
          <meshBasicMaterial color="#d4a017" />
        </mesh>

        {/* Collision Sidewalks integrated into Ground RB */}
        <CuboidCollider args={[1, 0.1, 300]} position={[11, 0.1, 0]} />
        <CuboidCollider args={[1, 0.1, 300]} position={[-11, 0.1, 0]} />
        <CuboidCollider args={[300, 0.1, 1]} position={[0, 0.1, 11]} />
        <CuboidCollider args={[300, 0.1, 1]} position={[0, 0.1, -11]} />
      </RigidBody>

      {/* Visual Sidewalks - Basic meshes, no RB overhead */}
      {[
        [11, 0.05, 0, 2, 0.1, 600],
        [-11, 0.05, 0, 2, 0.1, 600],
        [0, 0.05, 11, 600, 0.1, 2],
        [0, 0.05, -11, 600, 0.1, 2],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <mesh key={`sw-${i}`} position={[x, y, z] as [number, number, number]}>
          <boxGeometry args={[sx, sy, sz] as [number, number, number]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}

      {/* ══════════ BRIDGES ══════════ */}
      <Bridge position={[0, 4, 120]} length={120} width={18} />
      <Bridge position={[120, 4, 0]} rotation={[0, Math.PI / 2, 0]} length={120} width={18} />

      {/* ══════════ CENTRAL PLAZA ══════════ */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[44, 44]} />
        <meshStandardMaterial color="#444" />
      </mesh>
      <Fountain position={[0, 0, 0]} />

      {/* ══════════ PARK & STATIC PROPS ══════════ */}
      <group position={[-60, 0, -60]}>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#1a2e1a" />
        </mesh>
        {/* Simple tree clump */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[(i % 3) * 10 - 10, 3, Math.floor(i / 3) * 10 - 10]}>
            <coneGeometry args={[2.5, 6, 6]} />
            <meshStandardMaterial color="#1a4d26" />
          </mesh>
        ))}
      </group>

      {/* ══════════ CITY BUILDINGS (Minimal set) ══════════ */}
      <CityBuilding position={[60, 20, -60]} size={[25, 40, 25]} color="#2e2e2e" lit />
      <CityBuilding position={[110, 30, -60]} size={[30, 60, 30]} color="#252525" lit />
      <CityBuilding position={[60, 25, 60]} size={[30, 50, 30]} color="#2c2c2c" lit />
      <CityBuilding position={[-60, 40, -120]} size={[40, 80, 40]} color="#222" lit />
      <CityBuilding position={[-120, 25, 120]} size={[50, 50, 50]} color="#1f1f1f" lit />

      {/* ══════════ PERIMETER ══════════ */}
      <RigidBody type="fixed">
        <CuboidCollider args={[500, 10, 2]} position={[0, 5, -250]} />
        <CuboidCollider args={[500, 10, 2]} position={[0, 5, 250]} />
        <CuboidCollider args={[2, 10, 500]} position={[-250, 5, 0]} />
        <CuboidCollider args={[2, 10, 500]} position={[250, 5, 0]} />
      </RigidBody>

      {/* ══════════ BRIGHT MULTI-POINT LIGHTING ══════════ */}
      {/* High overhead bright light for visibility */}
      <pointLight position={[0, 80, 0]} intensity={2.5} distance={400} />
      <pointLight position={[100, 40, 100]} color="#ffd4a3" intensity={1.5} distance={200} />
      <pointLight position={[-100, 40, -100]} color="#aaccff" intensity={1.2} distance={200} />
    </group>
  );
});
