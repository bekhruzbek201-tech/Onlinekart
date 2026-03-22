"use client";

import { RigidBody } from "@react-three/rapier";
import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Bridge ── */
function Bridge({ position, rotation = [0, 0, 0], length = 40, width = 12 }: {
  position: [number, number, number];
  rotation?: [number, number, number];
  length?: number;
  width?: number;
}) {
  return (
    <RigidBody type="fixed" position={position} rotation={rotation}>
      <group>
        {/* Bridge deck */}
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[length, 0.5, width]} />
          <meshStandardMaterial color="#4a4a4a" roughness={0.85} />
        </mesh>
        {/* Railing left */}
        <mesh castShadow position={[0, 1, width / 2 - 0.2]}>
          <boxGeometry args={[length, 2, 0.3]} />
          <meshStandardMaterial color="#c41e1e" roughness={0.7} />
        </mesh>
        {/* Railing right */}
        <mesh castShadow position={[0, 1, -width / 2 + 0.2]}>
          <boxGeometry args={[length, 2, 0.3]} />
          <meshStandardMaterial color="#c41e1e" roughness={0.7} />
        </mesh>
        {/* Support pillars */}
        {Array.from({ length: Math.floor(length / 10) + 1 }, (_, i) => (
          <mesh key={i} castShadow position={[-length / 2 + i * 10, -5, 0]}>
            <boxGeometry args={[2, 10, 2]} />
            <meshStandardMaterial color="#3a3a3a" roughness={0.9} />
          </mesh>
        ))}
        {/* Bridge surface lines */}
        {Array.from({ length: Math.floor(length / 3) }, (_, i) => (
          <mesh key={`line-${i}`} position={[-length / 2 + 1.5 + i * 3, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.5, 0.2]} />
            <meshStandardMaterial color="#666" />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}

/* ── City building ── */
function CityBuilding({ position, size, color, lit = false }: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  lit?: boolean;
}) {
  const windowData = useRef(
    Array.from({ length: Math.max(1, Math.floor(size[1] / 8)) }, () =>
      Array.from({ length: Math.max(1, Math.floor(size[0] / 5)) }, () => Math.random() > 0.5)
    )
  ).current;

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.95} />
      </mesh>
      {/* Windows on front face */}
      {windowData.map((row, ri) =>
        row.map((isLit, ci) => (
          <mesh
            key={`${ri}-${ci}`}
            position={[
              -size[0] / 2 + 2.5 + ci * 5,
              -size[1] / 2 + 4 + ri * 8,
              size[2] / 2 + 0.08,
            ]}
          >
            <planeGeometry args={[2, 3]} />
            <meshStandardMaterial
              color={isLit || lit ? "#ffeeaa" : "#111"}
              emissive={isLit || lit ? "#ffeeaa" : "#000"}
              emissiveIntensity={0.5}
            />
          </mesh>
        ))
      )}
      {/* Roof details */}
      <mesh position={[0, size[1] / 2 + 0.25, 0]}>
        <boxGeometry args={[size[0] + 0.5, 0.5, size[2] + 0.5]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  );
}

/* ── Animated fountain ── */
function Fountain({ position }: { position: [number, number, number] }) {
  const waterRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (waterRef.current) {
      waterRef.current.scale.y = 1 + Math.sin(Date.now() * 0.004) * 0.3;
      (waterRef.current.material as THREE.MeshStandardMaterial).opacity = 0.5 + Math.sin(Date.now() * 0.003) * 0.2;
    }
  });

  return (
    <RigidBody type="fixed" position={position}>
      <group>
        {/* Basin */}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[6, 7, 2, 16]} />
          <meshStandardMaterial color="#555" roughness={0.8} />
        </mesh>
        {/* Water */}
        <mesh position={[0, 0.6, 0]}>
          <cylinderGeometry args={[5.5, 5.5, 0.4, 16]} />
          <meshStandardMaterial color="#1a4466" transparent opacity={0.7} />
        </mesh>
        {/* Center spout */}
        <mesh castShadow position={[0, 2, 0]}>
          <cylinderGeometry args={[0.4, 0.6, 3, 8]} />
          <meshStandardMaterial color="#444" metalness={0.4} />
        </mesh>
        {/* Water spray */}
        <mesh ref={waterRef} position={[0, 4.5, 0]}>
          <coneGeometry args={[0.8, 3, 8]} />
          <meshStandardMaterial color="#4488bb" transparent opacity={0.5} emissive="#2266aa" emissiveIntensity={0.3} />
        </mesh>
        <pointLight position={[0, 3, 0]} color="#4488aa" intensity={2} distance={15} />
      </group>
    </RigidBody>
  );
}

/* ── Street lamp ── */
function Lamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <cylinderGeometry args={[0.12, 0.18, 5, 6]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <boxGeometry args={[0.5, 0.12, 0.5]} />
        <meshStandardMaterial color="#ffffdd" emissive="#ffeeaa" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ── Park bench ── */
function ParkBench({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <RigidBody type="fixed" position={position} rotation={rotation}>
      <group>
        {/* Seat */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[3, 0.15, 0.8]} />
          <meshStandardMaterial color="#8b5e3c" roughness={0.9} />
        </mesh>
        {/* Backrest */}
        <mesh castShadow position={[0, 1, -0.35]}>
          <boxGeometry args={[3, 0.8, 0.1]} />
          <meshStandardMaterial color="#8b5e3c" roughness={0.9} />
        </mesh>
        {/* Legs */}
        {[-1.2, 1.2].map((x, i) => (
          <mesh key={i} castShadow position={[x, 0.25, 0]}>
            <boxGeometry args={[0.15, 0.5, 0.8]} />
            <meshStandardMaterial color="#333" metalness={0.5} />
          </mesh>
        ))}
      </group>
    </RigidBody>
  );
}

export const HangoutTrack = memo(function HangoutTrack() {
  return (
    <group>
      {/* ══════════ MASSIVE GROUND ══════════ */}
      <RigidBody type="fixed" friction={0.8}>
        <mesh receiveShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[500, 0.5, 500]} />
          <meshStandardMaterial color="#1a1a1a" roughness={1} />
        </mesh>
      </RigidBody>

      {/* ══════════ CITY ROADS ══════════ */}
      {/* Main boulevard (North-South) */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 300]} />
        <meshStandardMaterial color="#333" roughness={0.9} />
      </mesh>
      {/* Cross avenue (East-West) */}
      <mesh receiveShadow position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[20, 300]} />
        <meshStandardMaterial color="#333" roughness={0.9} />
      </mesh>
      {/* Diagonal road */}
      <mesh receiveShadow position={[60, 0.01, 60]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <planeGeometry args={[14, 120]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.9} />
      </mesh>
      {/* Ring road */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={`ring-${i}`} receiveShadow position={[
          Math.cos(i * Math.PI / 2) * 80,
          0.01,
          Math.sin(i * Math.PI / 2) * 80
        ]} rotation={[-Math.PI / 2, 0, i * Math.PI / 2]}>
          <planeGeometry args={[14, 160]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.95} />
        </mesh>
      ))}

      {/* ══════════ ROAD CENTER LINES ══════════ */}
      {Array.from({ length: 40 }, (_, i) => (
        <mesh key={`cl-ns-${i}`} position={[0, 0.02, -100 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.3, 2.5]} />
          <meshStandardMaterial color="#d4a017" />
        </mesh>
      ))}
      {Array.from({ length: 40 }, (_, i) => (
        <mesh key={`cl-ew-${i}`} position={[-100 + i * 5, 0.02, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[0.3, 2.5]} />
          <meshStandardMaterial color="#d4a017" />
        </mesh>
      ))}

      {/* ══════════ SIDEWALKS ══════════ */}
      {[
        [11, 0.15, 0, 2, 0.3, 300],
        [-11, 0.15, 0, 2, 0.3, 300],
        [0, 0.15, 11, 300, 0.3, 2],
        [0, 0.15, -11, 300, 0.3, 2],
      ].map(([x, y, z, sx, sy, sz], i) => (
        <RigidBody key={`sidewalk-${i}`} type="fixed" position={[x, y, z] as [number, number, number]}>
          <mesh receiveShadow>
            <boxGeometry args={[sx, sy, sz] as [number, number, number]} />
            <meshStandardMaterial color="#444" roughness={0.95} />
          </mesh>
        </RigidBody>
      ))}

      {/* ══════════ BRIDGES ══════════ */}
      <Bridge position={[0, 4, 50]} length={30} width={14} />
      <Bridge position={[60, 4, 0]} rotation={[0, Math.PI / 2, 0]} length={30} width={14} />
      {/* Ramp up to bridge 1 */}
      <RigidBody type="fixed" position={[-18, 2, 50]} rotation={[0, 0, 0.15]}>
        <mesh receiveShadow>
          <boxGeometry args={[12, 0.5, 14]} />
          <meshStandardMaterial color="#3d3d3d" roughness={0.9} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[18, 2, 50]} rotation={[0, 0, -0.15]}>
        <mesh receiveShadow>
          <boxGeometry args={[12, 0.5, 14]} />
          <meshStandardMaterial color="#3d3d3d" roughness={0.9} />
        </mesh>
      </RigidBody>
      {/* Ramp up to bridge 2 */}
      <RigidBody type="fixed" position={[60, 2, -18]} rotation={[0.15, Math.PI / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[12, 0.5, 14]} />
          <meshStandardMaterial color="#3d3d3d" roughness={0.9} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[60, 2, 18]} rotation={[-0.15, Math.PI / 2, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[12, 0.5, 14]} />
          <meshStandardMaterial color="#3d3d3d" roughness={0.9} />
        </mesh>
      </RigidBody>

      {/* ══════════ CENTRAL PLAZA ══════════ */}
      <mesh receiveShadow position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#3a3a3a" roughness={0.85} />
      </mesh>
      <Fountain position={[0, 0, 0]} />

      {/* ══════════ PARK AREA ══════════ */}
      {/* Green ground */}
      <mesh receiveShadow position={[-60, 0.005, -60]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#1a3a1a" roughness={0.95} />
      </mesh>
      {/* Trees (simple green cones) */}
      {[
        [-50, -50], [-55, -55], [-65, -45], [-45, -65], [-70, -55], [-55, -70],
        [-60, -48], [-48, -60], [-68, -68], [-52, -52],
      ].map(([x, z], i) => (
        <RigidBody key={`tree-${i}`} type="fixed" position={[x, 0, z]}>
          <group>
            <mesh castShadow position={[0, 2, 0]}>
              <cylinderGeometry args={[0.2, 0.3, 4, 6]} />
              <meshStandardMaterial color="#5c3a1a" roughness={0.9} />
            </mesh>
            <mesh castShadow position={[0, 5, 0]}>
              <coneGeometry args={[2.5, 5, 8]} />
              <meshStandardMaterial color="#1a5c2a" roughness={0.85} />
            </mesh>
            <mesh castShadow position={[0, 7, 0]}>
              <coneGeometry args={[1.8, 3.5, 8]} />
              <meshStandardMaterial color="#2a6c3a" roughness={0.85} />
            </mesh>
          </group>
        </RigidBody>
      ))}
      <ParkBench position={[-55, 0, -52]} rotation={[0, Math.PI / 4, 0]} />
      <ParkBench position={[-65, 0, -58]} rotation={[0, -Math.PI / 3, 0]} />

      {/* ══════════ CITY BUILDINGS ══════════ */}
      {/* Block 1 - Northeast */}
      <CityBuilding position={[50, 15, -50]} size={[20, 30, 18]} color="#2e2e2e" />
      <CityBuilding position={[80, 22, -50]} size={[18, 44, 16]} color="#2a2a2a" />
      <CityBuilding position={[50, 10, -80]} size={[22, 20, 14]} color="#333" />

      {/* Block 2 - Southeast */}
      <CityBuilding position={[50, 18, 80]} size={[24, 36, 20]} color="#252525" />
      <CityBuilding position={[80, 12, 80]} size={[16, 24, 18]} color="#2d2d2d" />

      {/* Block 3 - Northwest */}
      <CityBuilding position={[-50, 25, -80]} size={[20, 50, 16]} color="#282828" lit />
      <CityBuilding position={[-80, 14, -50]} size={[18, 28, 20]} color="#303030" />

      {/* Block 4 - Southwest */}
      <CityBuilding position={[-80, 20, 50]} size={[22, 40, 18]} color="#2c2c2c" />
      <CityBuilding position={[-50, 8, 80]} size={[30, 16, 14]} color="#353535" />

      {/* Skyscrapers in the distance */}
      <CityBuilding position={[120, 35, 0]} size={[16, 70, 16]} color="#222" lit />
      <CityBuilding position={[-120, 28, 30]} size={[20, 56, 18]} color="#1e1e1e" />
      <CityBuilding position={[0, 40, -120]} size={[18, 80, 14]} color="#252525" lit />
      <CityBuilding position={[0, 20, 120]} size={[40, 40, 16]} color="#2a2a2a" />

      {/* ══════════ STREET LAMPS ══════════ */}
      {[
        [12, 0, -30], [12, 0, 0], [12, 0, 30], [12, 0, 60], [12, 0, 90],
        [-12, 0, -30], [-12, 0, 0], [-12, 0, 30], [-12, 0, 60], [-12, 0, 90],
        [30, 0, 12], [60, 0, 12], [90, 0, 12],
        [30, 0, -12], [60, 0, -12], [90, 0, -12],
        [-30, 0, 12], [-60, 0, 12], [-90, 0, 12],
        [-30, 0, -12], [-60, 0, -12], [-90, 0, -12],
      ].map((pos, i) => (
        <Lamp key={i} position={pos as [number, number, number]} />
      ))}

      {/* ══════════ PERIMETER WALLS (invisible) ══════════ */}
      <RigidBody type="fixed" position={[0, 2, -150]}>
        <mesh visible={false}><boxGeometry args={[350, 8, 2]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[0, 2, 150]}>
        <mesh visible={false}><boxGeometry args={[350, 8, 2]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[-150, 2, 0]}>
        <mesh visible={false}><boxGeometry args={[2, 8, 350]} /></mesh>
      </RigidBody>
      <RigidBody type="fixed" position={[150, 2, 0]}>
        <mesh visible={false}><boxGeometry args={[2, 8, 350]} /></mesh>
      </RigidBody>
      {/* Floor safety net */}
      <RigidBody type="fixed" position={[0, -8, 0]}>
        <mesh visible={false}><boxGeometry args={[400, 1, 400]} /></mesh>
      </RigidBody>

      {/* ══════════ AMBIENT/DIRECTIONAL LIGHTS ══════════ */}
      {/* Warm sunset/city glow from one side */}
      <directionalLight position={[100, 50, -50]} intensity={1.5} color="#ffd4a3" shadow-bias={-0.0001} />
      {/* Cool moon/street reflection from the other */}
      <directionalLight position={[-100, 30, 50]} intensity={0.5} color="#90b0d0" />
      {/* Center plaza highlight */}
      <pointLight position={[0, 30, 0]} color="#ffffff" intensity={1.5} distance={150} decay={1.5} />
    </group>
  );
});
