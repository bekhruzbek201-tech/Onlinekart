"use client";

import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { memo, useRef } from "react";
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
function Wall({
  position,
  size,
  color,
  visible = true,
  stripeColor,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  visible?: boolean;
  stripeColor?: string;
}) {
  const stripeThickness = Math.max(0.12, size[1] * 0.1);

  return (
    <RigidBody type="fixed" position={position} friction={0} restitution={0.1}>
      <mesh castShadow={visible} receiveShadow={visible}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.92} transparent={!visible} opacity={visible ? 1 : 0} />
      </mesh>
      {stripeColor && (
        <mesh castShadow={visible} receiveShadow={visible} position={[0, size[1] / 2 - stripeThickness / 2, 0]}>
          <boxGeometry args={[size[0], stripeThickness, size[2]]} />
          <meshStandardMaterial
            color={stripeColor}
            emissive={stripeColor}
            emissiveIntensity={0.45}
            roughness={0.65}
            metalness={0.25}
            transparent={!visible}
            opacity={visible ? 0.95 : 0}
          />
        </mesh>
      )}
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
      <mesh ref={glowRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 9]} />
        <meshStandardMaterial color="#ffd700" transparent opacity={0.35} emissive="#ffd700" emissiveIntensity={0.6} />
      </mesh>
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
        <meshStandardMaterial color="#ffffdd" emissive="#ffeeaa" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ── Brutalist building ── */
function Building({ position, size, color }: { position: [number, number, number]; size: [number, number, number]; color: string }) {
  // Deterministic glow choice (eslint blocks Math.random during render).
  const hasGlow = (Math.abs(Math.round(position[0] * 13 + position[2] * 7 + size[0] * 0.5)) % 2) === 0;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      
      {/* Horizontal glowing band replaces heavy individual window draws */}
      {hasGlow && (
        <mesh position={[0, size[1] / 6, 0]}>
          <boxGeometry args={[size[0] + 0.2, 2, size[2] + 0.2]} />
          <meshStandardMaterial color="#ffeeaa" emissive="#ffeeaa" emissiveIntensity={0.6} />
        </mesh>
      )}
    </group>
  );
}

/* ── Guard rail segment (aesthetic barrier) ── */
function GuardRail({ position, rotation = [0, 0, 0], length = 20 }: { position: [number, number, number]; rotation?: [number, number, number]; length?: number }) {
  const railPalette = ["#00d1ff", "#d4a017", "#c41e1e", "#7c4dff", "#2ecc71", "#ff7a00"];
  const postPalette = ["#ff2d55", "#ffd700", "#00d1ff", "#c41e1e"];
  const seed = Math.abs(Math.round(position[0] * 0.3 + position[2] * 0.7 + length)) % railPalette.length;
  const railColor = railPalette[seed];
  const stripeColor = railPalette[(seed + 2) % railPalette.length];
  const postColorA = postPalette[seed % postPalette.length];
  const postColorB = postPalette[(seed + 1) % postPalette.length];

  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders={false} friction={0} restitution={0.1}>
      <CuboidCollider args={[length / 2, 1.5, 0.25]} />
      <group>
        {/* Metal rail */}
        <mesh castShadow position={[0, 0.6, 0]}>
          <boxGeometry args={[length, 0.15, 0.3]} />
          <meshStandardMaterial color={railColor} emissive={railColor} emissiveIntensity={0.25} metalness={0.65} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.2, 0]}>
          <boxGeometry args={[length, 0.1, 0.2]} />
          <meshStandardMaterial color={stripeColor} emissive={stripeColor} emissiveIntensity={0.18} metalness={0.45} roughness={0.55} />
        </mesh>
        {/* Neon stripe */}
        <mesh castShadow position={[0, 0.68, 0]}>
          <boxGeometry args={[length, 0.06, 0.26]} />
          <meshStandardMaterial
            color={stripeColor}
            emissive={stripeColor}
            emissiveIntensity={0.6}
            roughness={0.35}
            metalness={0.2}
            transparent
            opacity={0.9}
          />
        </mesh>
        {/* Posts */}
        {Array.from({ length: Math.floor(length / 4) + 1 }, (_, i) => (
          <mesh key={i} castShadow position={[-length / 2 + i * 4, 0.4, 0]}>
            <boxGeometry args={[0.15, 0.8, 0.15]} />
            <meshStandardMaterial color={i % 2 === 0 ? postColorA : postColorB} emissive={(i % 2 === 0 ? postColorA : postColorB)} emissiveIntensity={0.15} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}

/* ── Tire barrier (corner protection) ── */
function TireBarrier({ position, rotation = [0, 0, 0], count = 5 }: { position: [number, number, number]; rotation?: [number, number, number]; count?: number }) {
  const tirePalette = ["#2ecc71", "#00d1ff", "#d4a017", "#ff2d55", "#7c4dff", "#ff7a00"];
  const stripePalette = ["#c41e1e", "#d4a017", "#00d1ff", "#ff2d55"];

  return (
    <RigidBody type="fixed" position={position} rotation={rotation} colliders={false} friction={0} restitution={0.1}>
      <CuboidCollider args={[(count * 1.2) / 2, 1, 0.6]} />
      <group>
        {Array.from({ length: count }, (_, i) => (
          <group key={i} position={[i * 1.2 - (count * 0.6) + 0.6, 0.4, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.8, 8]} />
              {(() => {
                const tireColor = tirePalette[i % tirePalette.length];
                return <meshStandardMaterial color={tireColor} roughness={0.9} metalness={0.1} emissive={tireColor} emissiveIntensity={0.08} />;
              })()}
            </mesh>
            {/* Red stripe on tire */}
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.46, 0.46, 0.2, 8]} />
              {(() => {
                const stripeColor = stripePalette[(i + 1) % stripePalette.length];
                return (
                  <meshStandardMaterial
                    color={stripeColor}
                    emissive={stripeColor}
                    emissiveIntensity={0.35}
                    roughness={0.35}
                    metalness={0.25}
                  />
                );
              })()}
            </mesh>
          </group>
        ))}
      </group>
    </RigidBody>
  );
}

/* ── Traffic Cone ── */
function TrafficCone({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} friction={0} restitution={0.1}>
      <group>
        <mesh castShadow position={[0, 0.4, 0]}>
          <coneGeometry args={[0.25, 0.8, 8]} />
          <meshStandardMaterial color="#ff6600" />
        </mesh>
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.27, 0.27, 0.08, 8]} />
          <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} />
        </mesh>
        <mesh receiveShadow position={[0, 0.02, 0]}>
          <boxGeometry args={[0.5, 0.04, 0.5]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </RigidBody>
  );
}

export const Track = memo(function Track() {
  const tw = 20; // track width
  const sl = 120; // straight length
  const wh = 4.5; // wall height (taller to prevent jumping over)
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

      {/* ══════════ TRACK SHOULDER ASPHALT (fills gaps at corners) ══════════ */}
      {/* Top-right corner fill */}
      <mesh receiveShadow position={[50, 0.008, -60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tw + 4, tw + 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
      </mesh>
      {/* Top-left corner fill */}
      <mesh receiveShadow position={[-50, 0.008, -60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tw + 4, tw + 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
      </mesh>
      {/* Bottom-right corner fill */}
      <mesh receiveShadow position={[50, 0.008, 60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tw + 4, tw + 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
      </mesh>
      {/* Bottom-left corner fill */}
      <mesh receiveShadow position={[-50, 0.008, 60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[tw + 4, tw + 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
      </mesh>

      {/* ══════════ CENTER LINE (dashed) ══════════ */}
      {Array.from({ length: 20 }, (_, i) => (
        <mesh key={`cl-r-${i}`} position={[50, 0.015, -55 + i * 5.5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 2.5]} />
          <meshStandardMaterial color="#666" />
        </mesh>
      ))}
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

      {/* ══════════ OUTER WALLS (fully sealed perimeter) ══════════ */}
      <Wall position={[60.5, wh / 2, 0]} size={[wt, wh, sl + 22]} color="#c41e1e" stripeColor="#d4a017" />
      <Wall position={[-60.5, wh / 2, 0]} size={[wt, wh, sl + 22]} color="#c41e1e" stripeColor="#00d1ff" />
      <Wall position={[0, wh / 2, -71.5]} size={[123, wh, wt]} color="#c41e1e" stripeColor="#ff2d55" />
      <Wall position={[0, wh / 2, 71.5]} size={[123, wh, wt]} color="#c41e1e" stripeColor="#d4a017" />

      {/* ══════════ INNER WALLS (fully sealed - NO GAPS) ══════════ */}
      {/* Right inner wall - broken into segments connecting to corners */}
      <Wall position={[39.5, wh / 2, -25]} size={[wt, wh, 50]} color="#00d1ff" stripeColor="#ff2d55" />
      <Wall position={[39.5, wh / 2, 25]} size={[wt, wh, 50]} color="#7c4dff" stripeColor="#d4a017" />
      {/* Left inner wall */}
      <Wall position={[-39.5, wh / 2, -25]} size={[wt, wh, 50]} color="#2ecc71" stripeColor="#00d1ff" />
      <Wall position={[-39.5, wh / 2, 25]} size={[wt, wh, 50]} color="#ff7a00" stripeColor="#ff2d55" />
      {/* Top inner wall */}
      <Wall position={[0, wh / 2, -49.5]} size={[81, wh, wt]} color="#d4a017" stripeColor="#00d1ff" />
      {/* Bottom inner wall */}
      <Wall position={[0, wh / 2, 49.5]} size={[81, wh, wt]} color="#00d1ff" stripeColor="#c41e1e" />

      {/* ══════════ CORNER BARRIERS (closes all gaps!) ══════════ */}
      {/* Top-right corner - tire barriers */}
      <TireBarrier position={[45, 0, -52]} rotation={[0, Math.PI / 4, 0]} count={6} />
      <TireBarrier position={[55, 0, -52]} rotation={[0, -Math.PI / 4, 0]} count={6} />
      {/* Top-left corner */}
      <TireBarrier position={[-45, 0, -52]} rotation={[0, -Math.PI / 4, 0]} count={6} />
      <TireBarrier position={[-55, 0, -52]} rotation={[0, Math.PI / 4, 0]} count={6} />
      {/* Bottom-right corner */}
      <TireBarrier position={[45, 0, 52]} rotation={[0, -Math.PI / 4, 0]} count={6} />
      <TireBarrier position={[55, 0, 52]} rotation={[0, Math.PI / 4, 0]} count={6} />
      {/* Bottom-left corner */}
      <TireBarrier position={[-45, 0, 52]} rotation={[0, Math.PI / 4, 0]} count={6} />
      <TireBarrier position={[-55, 0, 52]} rotation={[0, -Math.PI / 4, 0]} count={6} />

      {/* ══════════ GUARD RAILS along straights ══════════ */}
      <GuardRail position={[60, 0, -35]} length={15} />
      <GuardRail position={[60, 0, 35]} length={15} />
      <GuardRail position={[-60, 0, -35]} length={15} />
      <GuardRail position={[-60, 0, 35]} length={15} />

      {/* ══════════ TRAFFIC CONES at key points ══════════ */}
      <TrafficCone position={[42, 0, -48]} />
      <TrafficCone position={[58, 0, -48]} />
      <TrafficCone position={[42, 0, 48]} />
      <TrafficCone position={[58, 0, 48]} />
      <TrafficCone position={[-42, 0, -48]} />
      <TrafficCone position={[-58, 0, -48]} />
      <TrafficCone position={[-42, 0, 48]} />
      <TrafficCone position={[-58, 0, 48]} />

      {/* ══════════ UNDERGROUND SAFETY NET (kart respawn if falls) ══════════ */}
      <Wall position={[0, -8, 0]} size={[400, 1, 400]} color="#000" visible={false} />

      {/* ══════════ BOOST PADS ══════════ */}
      {BOOST_PAD_POSITIONS.map((p, i) => (
        <BoostPad key={i} position={[p[0], 0, p[1]]} rotationY={p[2]} />
      ))}

      {/* ══════════ CENTRAL MONUMENT ══════════ */}
      <RigidBody type="fixed" position={[0, 0, 0]} friction={0} restitution={0.1}>
        <group>
          <mesh castShadow receiveShadow position={[0, 2.5, 0]}>
            <boxGeometry args={[16, 5, 16]} />
            <meshStandardMaterial color="#444" roughness={0.85} />
          </mesh>
          <mesh receiveShadow position={[0, 0.15, 0]}>
            <boxGeometry args={[20, 0.3, 20]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 14, 0]}>
            <boxGeometry args={[5, 18, 5]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 24.5, 0]}>
            <boxGeometry args={[3.5, 3, 3.5]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh castShadow position={[0, 27, 0]}>
            <boxGeometry args={[2.5, 2.5, 2.5]} />
            <meshStandardMaterial color="#c41e1e" emissive="#ff2222" emissiveIntensity={0.6} />
          </mesh>
          <pointLight position={[0, 27, 0]} color="#ff3333" intensity={3} distance={40} />
          <mesh position={[0, 7, 0]}>
            <boxGeometry args={[5.2, 1, 5.2]} />
            <meshStandardMaterial color="#c41e1e" />
          </mesh>
        </group>
      </RigidBody>

      {/* ══════════ START ARCHWAY ══════════ */}
      <RigidBody type="fixed" friction={0} restitution={0.1}>
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
});
