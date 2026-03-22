"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import {
  Suspense,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { KeyboardControls } from "@react-three/drei";
import { Kart } from "@/components/Kart";
import { Track } from "@/components/Track";
import { HangoutTrack } from "@/components/HangoutTrack";
import { HUD } from "@/components/HUD";
import { Lobby } from "@/components/Lobby";
import { Countdown } from "@/components/Countdown";
import { Minimap } from "@/components/Minimap";
import { OpponentKart } from "@/components/OpponentKart";
import { TouchControls } from "@/components/TouchControls";
import { GameChat } from "@/components/GameChat";
import { getSocket } from "@/lib/socket";

type GameScreen = "lobby" | "game";
type RaceState = "waiting" | "countdown" | "racing" | "finished";

interface PlayerData {
  id: string;
  name: string;
  position: number[];
  rotation: number[];
  speed: number;
  color: string;
  lap: number;
}

interface RaceResult {
  id: string;
  name: string;
  color: string;
  finishTime: number;
}

export default function Home() {
  const [screen, setScreen] = useState<GameScreen>("lobby");
  const [raceState, setRaceState] = useState<RaceState>("waiting");
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(42);
  const [isBoosting, setIsBoosting] = useState(false);
  const [isDrifting, setIsDrifting] = useState(false);
  const [lap, setLap] = useState(0);
  const [raceTime, setRaceTime] = useState(0);
  const [kartPos, setKartPos] = useState({ x: 50, z: 44 });
  const [kartRotation, setKartRotation] = useState(0);
  const [opponents, setOpponents] = useState<PlayerData[]>([]);
  const [roomCode, setRoomCode] = useState<string | undefined>();
  const [myId, setMyId] = useState("");
  const [kartColor, setKartColor] = useState("#8b1a1a");
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [finishResults, setFinishResults] = useState<RaceResult[] | null>(null);
  const [isLowPowerDevice, setIsLowPowerDevice] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [gameMode, setGameMode] = useState<"race" | "hangout">("race");
  const totalLaps = 3;

  const raceStartTime = useRef(0);
  const raceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hudUpdateTimerRef = useRef(0);
  const minimapUpdateTimerRef = useRef(0);
  const raceTimeRef = useRef(0);
  const isMultiplayerRef = useRef(false);
  const opponentsCountRef = useRef(0);
  const finishResultsRef = useRef<RaceResult[] | null>(null);
  const myIdRef = useRef("");
  const hudSnapshotRef = useRef({
    speed: 0,
    maxSpeed: 42,
    isBoosting: false,
    isDrifting: false,
  });
  const deferredOpponents = useDeferredValue(opponents);

  useEffect(() => {
    raceTimeRef.current = raceTime;
  }, [raceTime]);

  useEffect(() => {
    isMultiplayerRef.current = isMultiplayer;
  }, [isMultiplayer]);

  useEffect(() => {
    opponentsCountRef.current = opponents.length;
  }, [opponents.length]);

  useEffect(() => {
    finishResultsRef.current = finishResults;
  }, [finishResults]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const nav = navigator as Navigator & { deviceMemory?: number };
    const memory = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency ?? 8;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setIsTouchDevice(coarsePointer);
    setIsLowPowerDevice(reducedMotion || memory <= 4 || cores <= 4);
  }, []);

  const handleSinglePlayer = useCallback(() => {
    setIsMultiplayer(false);
    setRoomCode(undefined);
    setMyId("");
    setKartColor("#8b1a1a");
    setGameMode("race");
    setLap(0);
    setRaceTime(0);
    setFinishResults(null);
    setOpponents([]);
    setSpeed(0);
    setMaxSpeed(42);
    setScreen("game");
    setShowCountdown(true);
    setRaceState("countdown");
  }, []);

  const handleEnterGame = useCallback((data: { roomCode: string; playerId: string; color: string; isHost?: boolean }) => {
    const isHangout = data.roomCode.startsWith("HG-");
    setIsMultiplayer(true);
    setRoomCode(data.roomCode);
    setMyId(data.playerId);
    setKartColor(data.color);
    setIsHost(!!data.isHost);
    setGameMode(isHangout ? "hangout" : "race");
    setLap(0);
    setRaceTime(0);
    setFinishResults(null);
    setSpeed(0);
    setMaxSpeed(42);
    setScreen("game");
    if (isHangout) {
      // In hangout mode, start driving immediately - no countdown needed
      setShowCountdown(false);
      setRaceState("racing");
    } else {
      setShowCountdown(true);
      setRaceState("countdown");
    }
  }, []);

  // Socket events
  useEffect(() => {
    const socket = getSocket();

    socket.on("race-countdown", () => {
      setShowCountdown(true);
      setRaceState("countdown");
    });

    socket.on("race-start", () => {
      setRaceState("racing");
    });

    socket.on("players-state", (players: PlayerData[]) => {
      startTransition(() => {
        setOpponents(players.filter((p) => p.id !== myId));
      });
    });

    socket.on("race-results", (results: RaceResult[]) => {
      setRaceState("finished");
      setFinishResults(results);
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    });

    socket.on("return-to-lobby", () => {
      setScreen("lobby");
      setRaceState("waiting");
      setLap(0);
      setRaceTime(0);
      setSpeed(0);
      setMaxSpeed(42);
      setIsBoosting(false);
      setIsDrifting(false);
      setKartRotation(0);
      setKartPos({ x: 50, z: 44 });
      setOpponents([]);
      setFinishResults(null);
      setShowCountdown(false);
      
      hudSnapshotRef.current = {
        speed: 0,
        maxSpeed: 42,
        isBoosting: false,
        isDrifting: false,
      };
    });

    return () => {
      socket.off("race-countdown");
      socket.off("race-start");
      socket.off("players-state");
      socket.off("race-results");
      socket.off("return-to-lobby");
    };
  }, [myId]);

  // Race timer
  useEffect(() => {
    if (raceState === "racing") {
      raceStartTime.current = Date.now();
      raceTimerRef.current = setInterval(() => {
        setRaceTime((Date.now() - raceStartTime.current) / 1000);
      }, 80);
    }
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    };
  }, [raceState]);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    if (!isMultiplayer) {
      setRaceState("racing");
    }
  }, [isMultiplayer]);

  const handleSpeedChange = useCallback((s: number, ms: number, boosting: boolean, drifting: boolean) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const previous = hudSnapshotRef.current;
    const shouldSkipUpdate =
      now - hudUpdateTimerRef.current < 70 &&
      Math.abs(previous.speed - s) < 1.2 &&
      Math.abs(previous.maxSpeed - ms) < 0.5 &&
      previous.isBoosting === boosting &&
      previous.isDrifting === drifting;

    if (shouldSkipUpdate) return;

    hudUpdateTimerRef.current = now;
    hudSnapshotRef.current = {
      speed: s,
      maxSpeed: ms,
      isBoosting: boosting,
      isDrifting: drifting,
    };

    startTransition(() => {
      setSpeed(s);
      setMaxSpeed(ms);
      setIsBoosting(boosting);
      setIsDrifting(drifting);
    });
  }, []);

  const handleLapChange = useCallback(async (newLap: number) => {
    setLap(newLap);
    if (newLap >= totalLaps) {
      setRaceState("finished");
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
      
      // Save race result to Supabase if authenticated
      import("@/lib/supabase").then(async ({ supabase }) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const userId = session.user.id;
          const timeMs = Math.floor(raceTimeRef.current * 1000);
          
          try {
            // 1. Insert the race result
            await supabase.from("race_results").insert({
              player_id: userId,
              race_time_ms: timeMs,
              laps: totalLaps,
              track_name: "soviet_circuit",
              total_players: isMultiplayerRef.current ? opponentsCountRef.current + 1 : 1,
              position: isMultiplayerRef.current
                ? finishResultsRef.current
                  ? finishResultsRef.current.findIndex((r) => r.id === myIdRef.current) + 1
                  : null
                : null
            });

            // 2. Fetch current best time to see if we should update it
            const { data: profile } = await supabase.from("players").select("best_time_ms, total_races, total_wins").eq("id", userId).single();
            
            if (profile) {
              const updates: { total_races: number; updated_at: string; best_time_ms?: number } = {
                total_races: (profile.total_races || 0) + 1,
                updated_at: new Date().toISOString()
              };

              if (!profile.best_time_ms || timeMs < profile.best_time_ms) {
                updates.best_time_ms = timeMs;
              }

              await supabase.from("players").update(updates).eq("id", userId);
            }

            console.log("[СОЮЗ] Race stats synchronized with Central Command");
          } catch (e) {
            console.error("Failed to sync race data:", e);
          }
        }
      });

      if (isMultiplayerRef.current) {
        const socket = getSocket();
        socket.emit("player-finished", { time: raceTimeRef.current });
      }
    }
  }, [totalLaps]);

  const handlePositionUpdate = useCallback((position: number[], rotation: number[], spd: number, currentLap: number) => {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - minimapUpdateTimerRef.current > 100) {
      minimapUpdateTimerRef.current = now;
      const [qx, qy, qz, qw] = rotation;
      const yaw = Math.atan2(2 * (qw * qy + qz * qx), 1 - 2 * (qy * qy + qz * qz));
      startTransition(() => {
        setKartPos({ x: position[0], z: position[2] });
        setKartRotation(yaw);
      });
    }
    if (isMultiplayer) {
      const socket = getSocket();
      socket.emit("player-update", { position, rotation, speed: spd, lap: currentLap });
    }
  }, [isMultiplayer]);

  const handleBackToLobby = useCallback(() => {
    if (isMultiplayer) {
      const socket = getSocket();
      socket.emit("leave-room");
    }

    setScreen("lobby");
    setRaceState("waiting");
    setLap(0);
    setRaceTime(0);
    setSpeed(0);
    setMaxSpeed(42);
    setIsBoosting(false);
    setIsDrifting(false);
    setKartRotation(0);
    setKartPos({ x: 50, z: 44 });
    setOpponents([]);
    setFinishResults(null);
    setShowCountdown(false);
    setRoomCode(undefined);
    setMyId("");
    setKartColor("#8b1a1a");
    setIsMultiplayer(false);
    setIsHost(false);
    setGameMode("race");
    hudSnapshotRef.current = {
      speed: 0,
      maxSpeed: 42,
      isBoosting: false,
      isDrifting: false,
    };
  }, [isMultiplayer]);

  const handlePlayAgain = useCallback(() => {
    if (isMultiplayer) {
      const socket = getSocket();
      socket.emit("play-again");
    } else {
      setScreen("lobby");
      setRaceState("waiting");
      setLap(0);
      setRaceTime(0);
      setSpeed(0);
      setMaxSpeed(42);
      setIsBoosting(false);
      setIsDrifting(false);
      setKartRotation(0);
      setKartPos({ x: 50, z: 44 });
      setOpponents([]);
      setFinishResults(null);
      setShowCountdown(false);
      
      hudSnapshotRef.current = {
        speed: 0,
        maxSpeed: 42,
        isBoosting: false,
        isDrifting: false,
      };
      
      // Auto-retrigger single player mode smoothly
      handleSinglePlayer();
    }
  }, [isMultiplayer, handleSinglePlayer]);

  if (screen === "lobby") {
    return <Lobby onEnterGame={handleEnterGame} onSinglePlayer={handleSinglePlayer} initialRoomCode={roomCode} />;
  }

  return (
    <div className="w-full h-screen relative bg-[#0d0d0d]">
      <KeyboardControls
        map={[
          { name: "forward", keys: ["ArrowUp", "w", "W"] },
          { name: "backward", keys: ["ArrowDown", "s", "S"] },
          { name: "left", keys: ["ArrowLeft", "a", "A"] },
          { name: "right", keys: ["ArrowRight", "d", "D"] },
          { name: "drift", keys: ["Space"] },
        ]}
      >
        <Canvas
          shadows={!isLowPowerDevice}
          camera={{ fov: 62, near: 0.1, far: 500 }}
          performance={{ min: isLowPowerDevice ? 0.45 : 0.7 }}
          gl={{
            antialias: !isLowPowerDevice,
            powerPreference: isLowPowerDevice ? "default" : "high-performance",
            stencil: false,
            depth: true,
          }}
          frameloop="always"
          dpr={isLowPowerDevice ? [0.75, 1] : [1, 1.4]}
        >
          {/* Soviet overcast sky gradient */}
          <color attach="background" args={["#1a1b1e"]} />
          <fog attach="fog" args={["#1a1b1e", 70, 250]} />

          {/* Lighting rig: industrial harsh + atmospheric */}
          <ambientLight intensity={gameMode === "hangout" ? 1.4 : 0.3} color="#ffffff" />

          {/* Main directional (sun) - shadows disabled in hangout for FPS */}
          <directionalLight
            castShadow={gameMode === "race"}
            position={[60, 90, 40]}
            intensity={gameMode === "hangout" ? 1.5 : 1.6}
            color="#ffffff"
            shadow-mapSize={[512, 512]}
            shadow-camera-left={-120}
            shadow-camera-right={120}
            shadow-camera-top={120}
            shadow-camera-bottom={-120}
            shadow-camera-near={0.1}
            shadow-camera-far={300}
            shadow-bias={-0.0004}
          />

          {/* Fill light (cold) from opposite side */}
          {!isLowPowerDevice && (
            <directionalLight position={[-40, 30, -20]} intensity={gameMode === "hangout" ? 0.3 : 0.4} color="#8899bb" />
          )}

          {/* Red atmosphere from monument - only in race track */}
          {!isLowPowerDevice && gameMode === "race" && (
            <pointLight position={[0, 28, 0]} intensity={2} color="#ff3333" distance={50} />
          )}

          <Suspense fallback={null}>
            <Physics gravity={[0, -22, 0]}>
              {gameMode === "hangout" ? <HangoutTrack /> : <Track />}
              <Kart
                onSpeedChange={handleSpeedChange}
                onLapChange={handleLapChange}
                onPositionUpdate={handlePositionUpdate}
                raceState={raceState}
                kartColor={kartColor}
              />
            </Physics>

            {/* Opponents */}
            {deferredOpponents.map((op) => (
              <OpponentKart
                key={op.id}
                position={op.position as [number, number, number]}
                rotation={op.rotation as [number, number, number, number]}
                color={op.color}
                name={op.name}
              />
            ))}
          </Suspense>
        </Canvas>
        <TouchControls enabled={isTouchDevice} />
      </KeyboardControls>

      {/* 2D Overlays */}
      {gameMode === "hangout" ? (
        <>
          {/* Scanlines */}
          <div className="scanlines absolute inset-0 pointer-events-none z-40" />
          {/* Hangout mode header */}
          <div className="absolute top-4 left-4 z-30 select-none pointer-events-none animate-slideDown">
            <div className="bg-[#2d5a3d] px-5 py-2.5 inline-block shadow-[5px_5px_0px_#000]">
              <h1 className="text-xs sm:text-base text-white uppercase tracking-[0.35em] leading-none">
                🏙️ HANGOUT
              </h1>
            </div>
            {roomCode && (
              <div className="bg-black/80 border border-[#4a8060] px-3 py-1 mt-1.5 inline-block">
                <span className="text-[7px] text-[#4a8060] uppercase tracking-[0.3em]">
                  Room: {roomCode}
                </span>
              </div>
            )}
          </div>
          {/* Speed display (minimal) */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none">
            <div className="bg-black/70 border border-[#333] px-6 py-3 shadow-[4px_4px_0px_#000]">
              <div className="text-2xl text-white tabular-nums text-center">
                {Math.round((speed / 42) * 220)}
                <span className="text-[8px] text-[#666] ml-1">KM/H</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <HUD
          speed={speed}
          maxSpeed={maxSpeed}
          lap={lap}
          totalLaps={totalLaps}
          raceTime={raceTime}
          isBoosting={isBoosting}
          isDrifting={isDrifting}
          roomCode={roomCode}
        />
      )}

      <Minimap
        kartX={kartPos.x}
        kartZ={kartPos.z}
        kartRotation={kartRotation}
        opponents={deferredOpponents.map((op) => ({
          x: op.position[0],
          z: op.position[2],
          color: op.color,
        }))}
      />

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

      {/* In-game Chat */}
      {isMultiplayer && <GameChat roomCode={roomCode} myId={myId} />}

      {/* Leave button for hangout mode */}
      {gameMode === "hangout" && (
        <div className="absolute top-4 right-4 z-40">
          <button
            type="button"
            onClick={handleBackToLobby}
            className="bg-black/70 border border-[#c41e1e] text-[8px] text-white/60 px-4 py-2 uppercase tracking-widest hover:text-white hover:bg-[#c41e1e]/20 transition-all cursor-pointer pointer-events-auto"
          >
            ← Leave Hangout
          </button>
        </div>
      )}

      {/* Leave button for multiplayer race */}
      {gameMode === "race" && isMultiplayer && raceState !== "finished" && (
        <div className="absolute top-14 right-4 z-30">
          <button
            type="button"
            onClick={handleBackToLobby}
            className="bg-black/50 border border-[#333] text-[7px] text-white/40 px-3 py-1.5 uppercase tracking-widest hover:text-white/70 hover:border-[#555] transition-all cursor-pointer pointer-events-auto"
          >
            ← Exit Race
          </button>
        </div>
      )}

      {/* ── Finish Screen ── */}
      {raceState === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 scanlines animate-fadeIn">
          <div className="max-w-md w-full mx-4 animate-slideDown">
            <div className="bg-[#c41e1e] px-6 py-5 text-center shadow-[8px_8px_0px_#000]">
              <div className="text-xs text-white/50 uppercase tracking-[0.5em] mb-1">Гонка завершена</div>
              <div className="text-3xl sm:text-5xl text-white uppercase tracking-[0.4em]">
                ФИНИШ!
              </div>
            </div>
            <div className="bg-[#0d0d0d] border-2 border-[#333] border-t-0 p-6">
              <div className="text-center mb-6">
                <div className="text-[8px] text-[#666] uppercase tracking-[0.3em] mb-2">Ваше время</div>
                <div className="text-4xl text-[#d4a017] tabular-nums tracking-wide">
                  {Math.floor(raceTime / 60)}:{Math.floor(raceTime % 60).toString().padStart(2, "0")}.
                  {Math.floor((raceTime % 1) * 100).toString().padStart(2, "0")}
                </div>
              </div>

              {finishResults && finishResults.length > 0 && (
                <div className="mb-6">
                  <div className="text-[8px] text-[#666] uppercase tracking-[0.3em] mb-3 text-center">Результаты</div>
                  {finishResults.map((r, i: number) => (
                    <div
                      key={r.id}
                      className="flex justify-between items-center bg-[#1a1a1a] border border-[#2a2a2a] px-4 py-2.5 mb-1"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${i === 0 ? "text-[#d4a017]" : "text-[#666]"}`}>#{i + 1}</span>
                        <div className="w-3 h-3 border border-white/10" style={{ backgroundColor: r.color }} />
                        <span className="text-[10px] text-white">{r.name}</span>
                      </div>
                      <span className="text-[9px] text-[#aaa] tabular-nums">
                        {(r.finishTime / 1000).toFixed(2)}s
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center flex flex-col sm:flex-row gap-4 justify-center">
                {(!isMultiplayer || isHost) && (
                  <button
                    onClick={handlePlayAgain}
                    className="bg-[#d4a017] hover:bg-[#e4b027] text-black text-[10px] px-8 py-3.5 uppercase tracking-[0.3em] font-black transition-colors shadow-[5px_5px_0px_#000] cursor-pointer"
                  >
                    Играть снова
                  </button>
                )}
                
                <button
                  onClick={handleBackToLobby}
                  className="bg-[#c41e1e] hover:bg-[#e02020] text-white text-[10px] px-8 py-3.5 uppercase tracking-[0.3em] transition-colors shadow-[5px_5px_0px_#000] cursor-pointer"
                >
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
