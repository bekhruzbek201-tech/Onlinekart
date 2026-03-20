"use client";

import { RigidBody } from "@react-three/rapier";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Boost pad world positions [x, z, rotation-y]
export const BOOST_PAD_POSITIONS: [number, number, number][] = [
  [50, -25, 0],
  [-50, 15, 0],
  [15, -60, Math.PI / 2],
  [-15, 60, Math.PI / 2],
];

// Checkpoint positions [x, z, radius]
export const CHECKPOINTS: [number, number, number][] = [
  [50, -20, 15],
  [0, -60, 15],
  [-50, 0, 15],
  [0, 60, 15],
];

export const FINISH_LINE: [number, number, number] = [50, 40, 15];

/* ── Reusable wall segment ── */
function Wall({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <RigidBody type="fixed" position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.92} />
      </mesh>
    </RigidBody>
  );
}

/* ── Animated boost pad ── */
function BoostPad({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const glowRef = useRef<THREE.Mesh>(null);
  const arrowRefs = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.35 + Math.sin(Date.now() * 0.006) * 0.2;
    }
    // Animate arrows flowing forward
    arrowRefs.current.forEach((arrow, i) => {
      if (arrow) {
        const offset = ((Date.now() * 0.003 + i * 1.2) % 3) - 1.5;
        arrow.position.z = offset * 2;
        (arrow.material as THREE.MeshStandardMaterial).opacity = 1 - Math.abs(offset / 1.5) * 0.7;
      }
    });
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh receiveShadow position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 9]} />
        <meshStandardMaterial color="#b8860b" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh ref={glowRef as any} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 9]} />
        <meshStandardMaterial color="#ffd700" transparent opacity={0.35} emissive="#ffd700" emissiveIntensity={0.6} />
      </mesh>
      {/* Flowing arrow indicators */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) arrowRefs.current[i] = el; }}
          position={[0, 0.06, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[2, 0.4]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.7} emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <pointLight position={[0, 1.5, 0]} color="#ffd700" intensity={1} distance={12} />
    </group>
  );
}

/* ── Street lamp ── */
function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.15, 0.2, 6, 6]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.3} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[0.8, 0.3, 0.8]} />
        <meshStandardMaterial color="#555" />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <boxGeometry args={[0.5, 0.15, 0.5]} />
        <meshStandardMaterial color="#ffffaa" emissive="#ffeeaa" emissiveIntensity={1} />
      </mesh>
      <pointLight position={[0, 2.5, 0]} color="#ffe8aa" intensity={2} distance={20} decay={2} />
    </group>
  );
}

/* ── Brutalist building ── */
function Building({ position, size, color, windows = true }: { position: [number, number, number]; size: [number, number, number]; color: string; windows?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Optimized Window grid: Only show few windows to save performance */}
      {windows && Array.from({ length: Math.floor(size[1] / 12) }, (_, row) =>
        Array.from({ length: Math.floor(size[0] / 8) }, (_, col) => (
          <mesh
            key={`${row}-${col}`}
            position={[
              -size[0] / 2 + 3 + col * 8,
              -size[1] / 2 + 6 + row * 12,
              size[2] / 2 + 0.1,
            ]}
          >
            <planeGeometry args={[2.5, 4]} />
            <meshStandardMaterial
              color={Math.random() > 0.7 ? "#ffeeaa" : "#1a1a1a"}
              emissive={Math.random() > 0.7 ? "#ffeeaa" : "#000"}
              emissiveIntensity={0.4}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

export function Track() {
  const tw = 20; // track width
  const sl = 120; // straight length
  const wh = 3.5; // wall height
  const wt = 2;  // wall thickness

  return (
    <group>
      {/* ══════════ GROUND ══════════ */}
      <RigidBody type="fixed" friction={0.8}>
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[350, 0.5, 350]} />
          <meshStandardMaterial color="#181818" roughness={1} />
        </mesh>
      </RigidBody>

      {/* ══════════ TRACK ASPHALT ══════════ */}
      {[
        { pos: [50, 0.01, 0] as [number, number, number], size: [tw, sl] as [number, number] },
        { pos: [-50, 0.01, 0] as [number, number, number], size: [tw, sl] as [number, number] },
        { pos: [0, 0.01, -60] as [number, number, number], size: [120, tw] as [number, number] },
        { pos: [0, 0.01, 60] as [number, number, number], size: [120, tw] as [number, number] },
      ].map((s, i) => (
        <mesh key={`road-${i}`} receiveShadow position={s.pos} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={s.size} />
          <meshStandardMaterial color="#333" roughness={0.9} />
        </mesh>
      ))}

      {/* ══════════ CENTER LINE (dashed) ══════════ */}
      {/* Right straight center line */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`cl-r-${i}`} position={[50, 0.015, -55 + i * 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 2.5]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      ))}
      {/* Left straight center line */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`cl-l-${i}`} position={[-50, 0.015, -55 + i * 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 2.5]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      ))}

      {/* ══════════ KERB STRIPES ══════════ */}
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={`kr-${i}`} position={[40.5, 0.018, -55 + i * 3.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#c41e1e" : "#fff"} />
        </mesh>
      ))}
      {Array.from({ length: 30 }, (_, i) => (
        <mesh key={`kl-${i}`} position={[-40.5, 0.018, -55 + i * 3.7]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 1.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#c41e1e" : "#fff"} />
        </mesh>
      ))}

      {/* ══════════ CHECKERBOARD FINISH ══════════ */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={`fin-${i}`} position={[42 + i * 1.8, 0.02, 40]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.9, 2.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#fff" : "#111"} />
        </mesh>
      ))}

      {/* ══════════ WALLS ══════════ */}
      <Wall position={[60.5, wh / 2, 0]} size={[wt, wh, sl]} color="#c41e1e" />
      <Wall position={[39.5, wh / 2, 0]} size={[wt, wh, sl]} color="#555" />
      <Wall position={[-60.5, wh / 2, 0]} size={[wt, wh, sl]} color="#c41e1e" />
      <Wall position={[-39.5, wh / 2, 0]} size={[wt, wh, sl]} color="#555" />
      <Wall position={[0, wh / 2, -70.5]} size={[123, wh, wt]} color="#c41e1e" />
      <Wall position={[0, wh / 2, -49.5]} size={[79, wh, wt]} color="#555" />
      <Wall position={[0, wh / 2, 70.5]} size={[123, wh, wt]} color="#c41e1e" />
      <Wall position={[0, wh / 2, 49.5]} size={[79, wh, wt]} color="#555" />

      {/* ══════════ BOOST PADS ══════════ */}
      {BOOST_PAD_POSITIONS.map((p, i) => (
        <BoostPad key={i} position={[p[0], 0, p[1]]} rotationY={p[2]} />
      ))}

      {/* ══════════ CENTRAL MONUMENT ══════════ */}
      <RigidBody type="fixed" position={[0, 0, 0]}>
        <group>
          {/* Massive pedestal */}
          <mesh castShadow receiveShadow position={[0, 2.5, 0]}>
            <boxGeometry args={[16, 5, 16]} />
            <meshStandardMaterial color="#444" roughness={0.85} />
          </mesh>
          {/* Steps */}
          <mesh receiveShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[20, 0.3, 20]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          {/* Obelisk */}
          <mesh castShadow receiveShadow position={[0, 14, 0]}>
            <boxGeometry args={[5, 18, 5]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          {/* Obelisk taper */}
          <mesh castShadow position={[0, 24.5, 0]}>
            <boxGeometry args={[3.5, 3, 3.5]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          {/* Red star */}
          <mesh castShadow position={[0, 27, 0]}>
            <boxGeometry args={[2.5, 2.5, 2.5]} />
            <meshStandardMaterial color="#c41e1e" emissive="#ff2222" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, 27, 0]} color="#ff3333" intensity={3} distance={40} />
          {/* Decorative red band */}
          <mesh position={[0, 7, 0]}>
            <boxGeometry args={[5.2, 1, 5.2]} />
            <meshStandardMaterial color="#c41e1e" />
          </mesh>
        </group>
      </RigidBody>

      {/* ══════════ START ARCHWAY ══════════ */}
      <RigidBody type="fixed">
        <group position={[50, 0, 40]}>
          <mesh castShadow position={[-11, 7, 0]}>
            <boxGeometry args={[2.5, 14, 2.5]} />
            <meshStandardMaterial color="#444" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[11, 7, 0]}>
            <boxGeometry args={[2.5, 14, 2.5]} />
            <meshStandardMaterial color="#444" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 15, 0]}>
            <boxGeometry args={[25, 2.5, 3.5]} />
            <meshStandardMaterial color="#c41e1e" emissive="#c41e1e" emissiveIntensity={0.15} />
          </mesh>
          {/* Arch lights */}
          <pointLight position={[-5, 14, 2]} color="#ff6666" intensity={1} distance={15} />
          <pointLight position={[5, 14, 2]} color="#ff6666" intensity={1} distance={15} />
        </group>
      </RigidBody>

      {/* ══════════ STREET LAMPS ══════════ */}
      {[
        [62, 3, -40], [62, 3, -10], [62, 3, 20], [62, 3, 50],
        [-62, 3, -40], [-62, 3, -10], [-62, 3, 20], [-62, 3, 50],
        [20, 3, -72], [-20, 3, -72],
        [20, 3, 72], [-20, 3, 72],
      ].map((pos, i) => (
        <Lamp key={i} position={pos as [number, number, number]} />
      ))}

      {/* ══════════ BUILDINGS ══════════ */}
      <Building position={[85, 18, -35]} size={[22, 36, 18]} color="#2e2e2e" />
      <Building position={[-85, 24, -15]} size={[28, 48, 20]} color="#2a2a2a" />
      <Building position={[85, 14, 30]} size={[20, 28, 22]} color="#333" />
      <Building position={[-85, 10, 45]} size={[18, 20, 14]} color="#353535" />
      <Building position={[25, 30, -95]} size={[16, 60, 16]} color="#252525" />
      <Building position={[-30, 22, -95]} size={[20, 44, 18]} color="#2d2d2d" />
      <Building position={[0, 12, 95]} size={[35, 24, 12]} color="#303030" />

      {/* ══════════ DEBRIS / PUSHABLE CRATES ══════════ */}
      {[
        { pos: [-50, 1.5, -30] as [number, number, number], size: 3, mass: 2000, color: "#8b6c1a" },
        { pos: [50, 1, 10] as [number, number, number], size: 2, mass: 1000, color: "#666" },
        { pos: [30, 1, -60] as [number, number, number], size: 2.5, mass: 1500, color: "#555" },
      ].map((crate, i) => (
        <RigidBody key={`crate-${i}`} mass={crate.mass} position={crate.pos} restitution={0.3}>
          <mesh castShadow>
            <boxGeometry args={[crate.size, crate.size, crate.size]} />
            <meshStandardMaterial color={crate.color} roughness={0.85} />
          </mesh>
        </RigidBody>
      ))}

      {/* ══════════ CHECKPOINT MARKERS ══════════ */}
      {CHECKPOINTS.map((cp, i) => (
        <group key={`cp-${i}`} position={[cp[0], 0, cp[1]]}>
          <mesh castShadow position={[-8, 1.5, 0]}>
            <boxGeometry args={[0.4, 3, 0.4]} />
            <meshStandardMaterial color="#c41e1e" emissive="#c41e1e" emissiveIntensity={0.2} />
          </mesh>
          <mesh castShadow position={[8, 1.5, 0]}>
            <boxGeometry args={[0.4, 3, 0.4]} />
            <meshStandardMaterial color="#c41e1e" emissive="#c41e1e" emissiveIntensity={0.2} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
