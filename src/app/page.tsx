"use client";

import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { KeyboardControls } from "@react-three/drei";
import { Kart } from "@/components/Kart";
import { Track } from "@/components/Track";
import { HUD } from "@/components/HUD";
import { Lobby } from "@/components/Lobby";
import { Countdown } from "@/components/Countdown";
import { Minimap } from "@/components/Minimap";
import { OpponentKart } from "@/components/OpponentKart";
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
  const [opponents, setOpponents] = useState<PlayerData[]>([]);
  const [roomCode, setRoomCode] = useState<string | undefined>();
  const [myId, setMyId] = useState("");
  const [kartColor, setKartColor] = useState("#8b1a1a");
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [finishResults, setFinishResults] = useState<any[] | null>(null);
  const totalLaps = 3;

  const raceStartTime = useRef(0);
  const raceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleSinglePlayer = useCallback(() => {
    setIsMultiplayer(false);
    setScreen("game");
    setShowCountdown(true);
    setRaceState("countdown");
  }, []);

  const handleEnterGame = useCallback((data: any) => {
    setIsMultiplayer(true);
    setRoomCode(data.roomCode);
    setMyId(data.playerId);
    setKartColor(data.color);
    setScreen("game");
    setShowCountdown(true);
    setRaceState("countdown");
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
      setOpponents(players.filter((p) => p.id !== myId));
    });

    socket.on("race-results", (results: any[]) => {
      setRaceState("finished");
      setFinishResults(results);
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    });

    return () => {
      socket.off("race-countdown");
      socket.off("race-start");
      socket.off("players-state");
      socket.off("race-results");
    };
  }, [myId]);

  // Race timer
  useEffect(() => {
    if (raceState === "racing") {
      raceStartTime.current = Date.now();
      raceTimerRef.current = setInterval(() => {
        setRaceTime((Date.now() - raceStartTime.current) / 1000);
      }, 50);
    }
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    };
  }, [raceState]);

  const handleCountdownComplete = useCallback(() => {
    setShowCountdown(false);
    setRaceState("racing");
  }, []);

  const handleSpeedChange = useCallback((s: number, ms: number, boosting: boolean, drifting: boolean) => {
    setSpeed(s);
    setMaxSpeed(ms);
    setIsBoosting(boosting);
    setIsDrifting(drifting);
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
          const timeMs = Math.floor(raceTime * 1000);
          
          try {
            // 1. Insert the race result
            await supabase.from("race_results").insert({
              player_id: userId,
              race_time_ms: timeMs,
              laps: totalLaps,
              track_name: "soviet_circuit",
              total_players: isMultiplayer ? (opponents.length + 1) : 1,
              position: isMultiplayer ? (finishResults ? finishResults.findIndex(r => r.id === myId) + 1 : null) : null
            });

            // 2. Fetch current best time to see if we should update it
            const { data: profile } = await supabase.from("players").select("best_time_ms, total_races, total_wins").eq("id", userId).single();
            
            if (profile) {
              const updates: any = {
                total_races: (profile.total_races || 0) + 1,
                updated_at: new Date().toISOString()
              };

              if (!profile.best_time_ms || timeMs < profile.best_time_ms) {
                updates.best_time_ms = timeMs;
              }

              // If multi-player and we were 1st place (this logic is simplified here as we don't have final ranking on every client yet)
              // But for now let's just increment races.
              await supabase.from("players").update(updates).eq("id", userId);
            }

            console.log("[СОЮЗ] Race stats synchronized with Central Command");
          } catch (e) {
            console.error("Failed to sync race data:", e);
          }
        }
      });

      if (isMultiplayer) {
        const socket = getSocket();
        socket.emit("player-finished", { time: raceTime });
      }
    }
  }, [isMultiplayer, raceTime, totalLaps]);

  const handlePositionUpdate = useCallback((position: number[], rotation: number[], spd: number, currentLap: number) => {
    setKartPos({ x: position[0], z: position[2] });
    if (isMultiplayer) {
      const socket = getSocket();
      socket.emit("player-update", { position, rotation, speed: spd, lap: currentLap });
    }
  }, [isMultiplayer]);

  const handleBackToLobby = useCallback(() => {
    setScreen("lobby");
    setRaceState("waiting");
    setLap(0);
    setRaceTime(0);
    setSpeed(0);
    setOpponents([]);
    setFinishResults(null);
    setShowCountdown(false);
  }, []);

  if (screen === "lobby") {
    return <Lobby onEnterGame={handleEnterGame} onSinglePlayer={handleSinglePlayer} />;
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
          shadows
          camera={{ fov: 62, near: 0.1, far: 500 }}
          gl={{
            antialias: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
          }}
          frameloop="always"
          dpr={1}
        >
          {/* Soviet overcast sky gradient */}
          <color attach="background" args={["#1a1b1e"]} />
          <fog attach="fog" args={["#1a1b1e", 70, 250]} />

          {/* Lighting rig: industrial harsh + atmospheric */}
          <ambientLight intensity={0.3} color="#b8b0a0" />

          {/* Main directional (sun) */}
          <directionalLight
            castShadow
            position={[60, 90, 40]}
            intensity={1.6}
            color="#ffeedd"
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-120}
            shadow-camera-right={120}
            shadow-camera-top={120}
            shadow-camera-bottom={-120}
            shadow-camera-near={0.1}
            shadow-camera-far={300}
            shadow-bias={-0.0004}
          />

          {/* Fill light (cold) from opposite side */}
          <directionalLight position={[-40, 30, -20]} intensity={0.4} color="#8899bb" />

          {/* Red atmosphere from monument */}
          <pointLight position={[0, 28, 0]} intensity={2} color="#ff3333" distance={50} />

          <Suspense fallback={null}>
            <Physics gravity={[0, -22, 0]}>
              <Track />
              <Kart
                onSpeedChange={handleSpeedChange}
                onLapChange={handleLapChange}
                onPositionUpdate={handlePositionUpdate}
                raceState={raceState}
                kartColor={kartColor}
              />
            </Physics>

            {/* Opponents */}
            {opponents.map((op) => (
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
      </KeyboardControls>

      {/* 2D Overlays */}
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

      <Minimap
        kartX={kartPos.x}
        kartZ={kartPos.z}
        kartRotation={0}
        opponents={opponents.map((op) => ({ x: op.position[0], z: op.position[2], color: op.color }))}
      />

      {showCountdown && <Countdown onComplete={handleCountdownComplete} />}

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
                  {finishResults.map((r: any, i: number) => (
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

              <div className="text-center">
                <button
                  onClick={handleBackToLobby}
                  className="bg-[#c41e1e] hover:bg-[#e02020] text-white text-[10px] px-8 py-3.5 uppercase tracking-[0.3em] transition-colors shadow-[5px_5px_0px_#000] cursor-pointer"
                >
                  Назад в лобби
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
