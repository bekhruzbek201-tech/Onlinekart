"use client";

import * as THREE from "three";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

interface OpponentKartProps {
  position: [number, number, number];
  rotation: [number, number, number, number];
  color: string;
  name: string;
}

export const OpponentKart = memo(function OpponentKart({
  position,
  rotation,
  color,
}: OpponentKartProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetQuat = useRef(new THREE.Quaternion(...rotation));

  // Smoothly interpolate opponent position for butter-smooth networking
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    targetPos.current.set(...position);
    targetQuat.current.set(...rotation);

    groupRef.current.position.lerp(targetPos.current, 8 * delta);
    groupRef.current.quaternion.slerp(targetQuat.current, 8 * delta);
  });

  return (
    <group ref={groupRef}>
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
        <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.6, 0.3, -1.78]}>
        <boxGeometry args={[0.3, 0.2, 0.08]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={0.5} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-0.6, 0.3, 1.78]}>
        <boxGeometry args={[0.25, 0.15, 0.08]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.6, 0.3, 1.78]}>
        <boxGeometry args={[0.25, 0.15, 0.08]} />
        <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.4} />
      </mesh>
      {/* Wheels */}
      {[[-0.95, -0.02, -1.15], [0.95, -0.02, -1.15], [-0.95, -0.02, 1.15], [0.95, -0.02, 1.15]].map((pos, i) => (
        <mesh key={i} castShadow position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[i < 2 ? 0.32 : 0.35, i < 2 ? 0.32 : 0.35, i < 2 ? 0.22 : 0.26, 10]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
        </mesh>
      ))}
      {/* Roll bar */}
      <mesh castShadow position={[0, 1.05, 0.2]}>
        <boxGeometry args={[1.6, 0.08, 0.08]} />
        <meshStandardMaterial color="#333" metalness={0.5} />
      </mesh>
      {/* Name tag above kart */}
      {/* We can't render text in 3D easily without a component, so skip for now */}
    </group>
  );
});
