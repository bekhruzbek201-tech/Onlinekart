"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, RapierRigidBody } from "@react-three/rapier";
import { useKeyboardControls } from "@react-three/drei";
import * as THREE from "three";
import { BOOST_PAD_POSITIONS, CHECKPOINTS, FINISH_LINE } from "./Track";

interface KartProps {
  onSpeedChange?: (speed: number, maxSpeed: number, isBoosting: boolean, isDrifting: boolean) => void;
  onLapChange?: (lap: number) => void;
  onPositionUpdate?: (position: number[], rotation: number[], speed: number, lap: number) => void;
  raceState: "waiting" | "countdown" | "racing" | "finished";
  kartColor?: string;
}

export function Kart({ onSpeedChange, onLapChange, onPositionUpdate, raceState, kartColor = "#8b1a1a" }: KartProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const [, get] = useKeyboardControls();
  const groupRef = useRef<THREE.Group>(null);

  // Preallocate ALL math objects = zero garbage collection
  const v = useMemo(() => ({
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    vel: new THREE.Vector3(),
    camTarget: new THREE.Vector3(),
    camBehind: new THREE.Vector3(),
    cameraTargetPos: new THREE.Vector3(),
    lookTarget: new THREE.Vector3(),
    lookAhead: new THREE.Vector3(),
    tmpVec: new THREE.Vector3(),
    kartPos2D: new THREE.Vector2(),
    checkPos2D: new THREE.Vector2(),
  }), []);

  // ─── Finely tuned arcade physics ─────────────
  const MAX_SPEED = 45;
  const ACCEL = 72;
  // Slightly stronger reverse so the kart can back out of wall contact.
  const REVERSE = 34;
  const TURN_SPEED = 3.2;
  const DRIFT_TURN = 5.2;
  const GRIP = 0.82;         // High grip = tight cornering
  const DRIFT_GRIP = 0.96;   // Low grip = slide city
  const DRAG = 0.25;
  const BOOST_FORCE = 40;
  const BOOST_MAX = 65;
  // ──────────────────────────────────────────────

  const smoothCamPos = useRef(new THREE.Vector3(50, 6, 55));
  const yaw = useRef(0);
  const boostTimer = useRef(0);
  const checkpointsPassed = useRef(new Set<number>());
  const currentLap = useRef(0);
  const lastFinishCross = useRef(0);
  const syncTimer = useRef(0);
  const hudTimer = useRef(0);
  const isDrifting = useRef(false);
  const tiltAngle = useRef(0);
  const lastSafePos = useRef(new THREE.Vector3(50, 1.5, 44));
  const lastSafeYaw = useRef(0);
  const safePosSaveTimer = useRef(0);
  const respawnCooldown = useRef(0);

  // Wheel refs
  const wheelRefs = useRef<THREE.Mesh[]>([]);
  const frontWheelRefs = useRef<THREE.Group[]>([]);

  useFrame((state, delta) => {
    if (!bodyRef.current) return;
    const dt = Math.min(delta, 0.033);

    const pos = bodyRef.current.translation();
    const curVel = bodyRef.current.linvel();
    v.vel.set(curVel.x, 0, curVel.z);
    const speed = v.vel.length();

    // ─── Fall recovery / respawn ───
    respawnCooldown.current = Math.max(0, respawnCooldown.current - dt);
    if (pos.y < -3 && respawnCooldown.current <= 0) {
      // Kart fell off the track! Teleport back to last safe position
      bodyRef.current.setTranslation(
        { x: lastSafePos.current.x, y: lastSafePos.current.y + 1, z: lastSafePos.current.z },
        true
      );
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      yaw.current = lastSafeYaw.current;
      respawnCooldown.current = 2; // Prevent rapid respawning
    }

    // Save safe position periodically when on the track
    safePosSaveTimer.current += dt;
    if (safePosSaveTimer.current > 0.5 && pos.y > -1 && pos.y < 5) {
      safePosSaveTimer.current = 0;
      lastSafePos.current.set(pos.x, pos.y, pos.z);
      lastSafeYaw.current = yaw.current;
    }

    // ─── Controls ───
    const canDrive = raceState === "racing";
    const { forward, backward, left, right, drift } = canDrive
      ? get()
      : { forward: false, backward: false, left: false, right: false, drift: false };

    isDrifting.current = drift && speed > 4;

    // ─── Steering (speed-dependent) ───
    const speedFactor = Math.min(speed / 5, 1);
    // Keep steering responsive when nearly stopped (otherwise the kart can
    // "wedge" against a long barrier where reversing can't rotate it away).
    const steeringFactor = 0.25 + speedFactor * 0.75;
    const turnRate = isDrifting.current ? DRIFT_TURN : TURN_SPEED;
    let turnInput = 0;
    if (left) turnInput = 1;
    if (right) turnInput = -1;

    yaw.current += turnInput * turnRate * dt * steeringFactor;

    v.euler.set(0, yaw.current, 0);
    v.quat.setFromEuler(v.euler);
    v.forward.set(0, 0, -1).applyQuaternion(v.quat);
    v.right.set(1, 0, 0).applyQuaternion(v.quat);

    // ─── Boost pad detection ───
    boostTimer.current = Math.max(0, boostTimer.current - dt);
    v.kartPos2D.set(pos.x, pos.z);

    for (const [bx, bz] of BOOST_PAD_POSITIONS) {
      v.checkPos2D.set(bx, bz);
      if (v.kartPos2D.distanceTo(v.checkPos2D) < 5) {
        boostTimer.current = 0.6;
        break;
      }
    }

    const isBoosting = boostTimer.current > 0;
    const currentMaxSpeed = isBoosting ? BOOST_MAX : MAX_SPEED;

    // ─── Engine force ───
    const forwardComponent = v.vel.dot(v.forward);
    let engineForce = 0;
    if (forward) {
      const ratio = Math.abs(forwardComponent) / currentMaxSpeed;
      engineForce = ACCEL * (1 - ratio * 0.4);
    }
    if (backward) {
      // Brake hard when moving forward into an obstacle; otherwise push to reverse.
      if (forwardComponent > 1) {
        engineForce = -ACCEL * 0.8;
      } else {
        // Extra reverse kick when nearly stopped helps break contact.
        const stuckReverseMultiplier = speed < 2 ? 1.25 : 1;
        engineForce = -REVERSE * stuckReverseMultiplier;
      }
    }
    if (isBoosting) engineForce += BOOST_FORCE;

    // ─── Lateral grip (the magic of drifting) ───
    const lateralComponent = v.vel.dot(v.right);
    const grip = isDrifting.current ? DRIFT_GRIP : GRIP;
    // When nearly stopped, reduce sideways "locking" so the kart can pivot
    // away from a wall instead of sliding in place.
    const lowSpeedLateralScale = speed < 1.5 ? 0.6 : 1;
    const lateralCancel = -lateralComponent * (1 - grip) * 55 * dt * lowSpeedLateralScale;

    // ─── Assemble velocity ───
    const forceX = v.forward.x * engineForce + v.right.x * lateralCancel;
    const forceZ = v.forward.z * engineForce + v.right.z * lateralCancel;
    const dragX = -curVel.x * DRAG;
    const dragZ = -curVel.z * DRAG;

    const newVX = curVel.x + (forceX + dragX) * dt;
    const newVZ = curVel.z + (forceZ + dragZ) * dt;
    v.tmpVec.set(newVX, 0, newVZ);
    if (v.tmpVec.length() > currentMaxSpeed) v.tmpVec.clampLength(0, currentMaxSpeed);

    bodyRef.current.setLinvel({ x: v.tmpVec.x, y: curVel.y, z: v.tmpVec.z }, true);
    bodyRef.current.setRotation(v.quat, true);

    // ─── Kart body tilt while turning ───
    const targetTilt = -turnInput * speedFactor * 0.12;
    tiltAngle.current += (targetTilt - tiltAngle.current) * 8 * dt;
    if (groupRef.current) {
      groupRef.current.rotation.z = tiltAngle.current;
    }

    // ─── Front wheel visual steering ───
    for (const wg of frontWheelRefs.current) {
      if (wg) wg.rotation.y = turnInput * 0.4;
    }

    // ─── Wheel spin ───
    for (const wheel of wheelRefs.current) {
      if (wheel) wheel.rotation.x += speed * dt * 3;
    }

    // ─── Checkpoint & Lap ───
    if (canDrive) {
      for (let i = 0; i < CHECKPOINTS.length; i++) {
        const [cx, cz, cr] = CHECKPOINTS[i];
        v.checkPos2D.set(cx, cz);
        if (v.kartPos2D.distanceTo(v.checkPos2D) < cr) {
          checkpointsPassed.current.add(i);
        }
      }

      const [fx, fz, fr] = FINISH_LINE;
      v.checkPos2D.set(fx, fz);
      const now = Date.now();
      if (
        v.kartPos2D.distanceTo(v.checkPos2D) < fr &&
        checkpointsPassed.current.size === CHECKPOINTS.length &&
        now - lastFinishCross.current > 3000
      ) {
        currentLap.current++;
        checkpointsPassed.current.clear();
        lastFinishCross.current = now;
        onLapChange?.(currentLap.current);
      }
    }

    // ─── Callbacks ───
    hudTimer.current += dt;
    if (hudTimer.current > 0.05) {
      hudTimer.current = 0;
      onSpeedChange?.(v.tmpVec.length(), currentMaxSpeed, isBoosting, isDrifting.current);
    }

    syncTimer.current += dt;
    if (syncTimer.current > 0.066) {
      syncTimer.current = 0;
      onPositionUpdate?.(
        [pos.x, pos.y, pos.z],
        [v.quat.x, v.quat.y, v.quat.z, v.quat.w],
        speed,
        currentLap.current
      );
    }

    // ─── Camera ───
    const kartPos = v.camTarget.set(pos.x, pos.y, pos.z);
    const camDist = 8;
    const camHeight = 3.8;
    const camBehind = v.camBehind.copy(v.forward).multiplyScalar(-camDist);
    camBehind.y = camHeight;

    // Drift camera lean offset
    if (isDrifting.current && turnInput !== 0) {
      camBehind.addScaledVector(v.right, turnInput * 2.5);
      camBehind.y += 0.4;
    }

    const target = v.cameraTargetPos.copy(kartPos).add(camBehind);
    smoothCamPos.current.lerp(target, 6 * dt);
    state.camera.position.copy(smoothCamPos.current);

    v.lookTarget.set(pos.x, pos.y + 1.2, pos.z);
    v.lookAhead.copy(v.forward).multiplyScalar(8);
    v.lookTarget.add(v.lookAhead);
    state.camera.lookAt(v.lookTarget);

    // Dynamic FOV
    const targetFov = 62 + (speed / currentMaxSpeed) * 35;
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.fov += (targetFov - cam.fov) * 4 * dt;
    cam.updateProjectionMatrix();
  });

  return (
    <RigidBody
      ref={bodyRef}
      colliders="cuboid"
      position={[50, 1.5, 44]}
      mass={800}
      restitution={0.35}
      friction={0.4}
      linearDamping={0}
      angularDamping={5}
      lockRotations
      enabledRotations={[false, false, false]}
    >
      <group ref={groupRef}>
        {/* ─── CHASSIS ─── */}
        <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
          <boxGeometry args={[1.9, 0.45, 3.4]} />
          <meshStandardMaterial color="#5a5a5a" roughness={0.8} metalness={0.15} />
        </mesh>
        {/* Side panels with color stripe */}
        <mesh castShadow position={[0.85, 0.35, 0]}>
          <boxGeometry args={[0.22, 0.25, 2.8]} />
          <meshStandardMaterial color={kartColor} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[-0.85, 0.35, 0]}>
          <boxGeometry args={[0.22, 0.25, 2.8]} />
          <meshStandardMaterial color={kartColor} roughness={0.6} />
        </mesh>

        {/* ─── CABIN ─── */}
        <mesh castShadow position={[0, 0.72, -0.2]}>
          <boxGeometry args={[1.5, 0.55, 1.6]} />
          <meshStandardMaterial color={kartColor} roughness={0.65} metalness={0.08} />
        </mesh>
        {/* Windshield */}
        <mesh position={[0, 0.75, -1.05]}>
          <boxGeometry args={[1.3, 0.4, 0.08]} />
          <meshStandardMaterial color="#222" roughness={0.3} metalness={0.6} />
        </mesh>

        {/* ─── BUMPERS ─── */}
        <mesh castShadow position={[0, 0.12, -1.75]}>
          <boxGeometry args={[1.7, 0.25, 0.25]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, 0.12, 1.75]}>
          <boxGeometry args={[1.7, 0.25, 0.25]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
        </mesh>

        {/* ─── HEADLIGHTS ─── */}
        <mesh position={[-0.6, 0.3, -1.78]}>
          <boxGeometry args={[0.3, 0.2, 0.08]} />
          <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0.6, 0.3, -1.78]}>
          <boxGeometry args={[0.3, 0.2, 0.08]} />
          <meshStandardMaterial color="#ffffdd" emissive="#ffffcc" emissiveIntensity={0.8} />
        </mesh>
        {/* Headlight glow */}
        <pointLight position={[0, 0.3, -2.5]} color="#ffffcc" intensity={0.6} distance={8} />

        {/* ─── TAILLIGHTS ─── */}
        <mesh position={[-0.6, 0.3, 1.78]}>
          <boxGeometry args={[0.25, 0.15, 0.08]} />
          <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.6} />
        </mesh>
        <mesh position={[0.6, 0.3, 1.78]}>
          <boxGeometry args={[0.25, 0.15, 0.08]} />
          <meshStandardMaterial color="#ff2222" emissive="#ff0000" emissiveIntensity={0.6} />
        </mesh>

        {/* ─── FRONT WHEELS (Steerable) ─── */}
        {[[-0.95, -0.02, -1.15], [0.95, -0.02, -1.15]].map((pos, i) => (
          <group
            key={`fw-${i}`}
            ref={(el) => { if (el) frontWheelRefs.current[i] = el; }}
            position={pos as [number, number, number]}
          >
            <mesh
              ref={(el) => { if (el) wheelRefs.current[i] = el; }}
              castShadow
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.32, 0.32, 0.22, 10]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
            </mesh>
            {/* Wheel rim */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.18, 0.18, 0.24, 6]} />
              <meshStandardMaterial color="#444" metalness={0.4} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* ─── REAR WHEELS ─── */}
        {[[-0.95, -0.02, 1.15], [0.95, -0.02, 1.15]].map((pos, i) => (
          <group key={`rw-${i}`} position={pos as [number, number, number]}>
            <mesh
              ref={(el) => { if (el) wheelRefs.current[i + 2] = el; }}
              castShadow
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.35, 0.35, 0.26, 10]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.95} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.2, 0.2, 0.28, 6]} />
              <meshStandardMaterial color="#444" metalness={0.4} roughness={0.5} />
            </mesh>
          </group>
        ))}

        {/* ─── EXHAUSTS ─── */}
        <mesh position={[-0.5, 0.2, 1.9]}>
          <cylinderGeometry args={[0.07, 0.09, 0.35, 8]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.5, 0.2, 1.9]}>
          <cylinderGeometry args={[0.07, 0.09, 0.35, 8]} />
          <meshStandardMaterial color="#333" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* ─── NUMBER PLATE ─── */}
        <mesh position={[0, 0.5, 1.78]}>
          <boxGeometry args={[0.6, 0.3, 0.05]} />
          <meshStandardMaterial color="#e8dcc8" />
        </mesh>

        {/* ─── ROLL BAR ─── */}
        <mesh castShadow position={[0, 1.05, 0.2]}>
          <boxGeometry args={[1.6, 0.08, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.5} />
        </mesh>
        <mesh castShadow position={[-0.75, 0.88, 0.2]}>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.5} />
        </mesh>
        <mesh castShadow position={[0.75, 0.88, 0.2]}>
          <boxGeometry args={[0.08, 0.35, 0.08]} />
          <meshStandardMaterial color="#333" metalness={0.5} />
        </mesh>
      </group>
    </RigidBody>
  );
}
