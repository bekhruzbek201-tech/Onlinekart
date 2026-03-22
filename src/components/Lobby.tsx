"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  connectSocket,
  ensureSocketConnected,
  getSocket,
  getSocketUrl,
} from "@/lib/socket";
import { useAuth } from "@/lib/AuthProvider";
import { DetailedRankings } from "@/components/DetailedRankings";
import { KartShowcase } from "@/components/KartShowcase";

interface LobbyPlayer {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

interface ServerRoom {
  players: LobbyPlayer[];
  host: string;
}

interface RoomPayload {
  roomCode: string;
  player: LobbyPlayer;
  room: ServerRoom;
}

interface LobbyProps {
  onEnterGame: (data: {
    roomCode: string;
    playerId: string;
    playerName: string;
    players: LobbyPlayer[];
    isHost: boolean;
    color: string;
  }) => void;
  onSinglePlayer: () => void;
  initialRoomCode?: string;
}

interface WaitingRoomState {
  roomCode: string;
  players: LobbyPlayer[];
  host: string;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout")) {
      return "Connection timeout. Server may be cold-starting, please retry";
    }
    return error.message;
  }
  return "Connection failed. Please check internet and multiplayer server.";
}

function readInviteCode(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("room") || params.get("code") || "").slice(0, 6).toUpperCase();
}

interface SocketAck {
  ok?: boolean;
  code?: string;
  roomCode?: string;
}

function mapJoinErrorCode(code?: string): string {
  switch (code) {
    case "ROOM_NOT_FOUND":
      return "Room code not found. Check code and try again.";
    case "ROOM_FULL":
      return "Room is full.";
    case "RACE_STARTED":
      return "Race in this room already started.";
    case "SERVER_ERROR":
      return "Internal server error. Please try again later.";
    default:
      return "Could not join room. Is the connection stable?";
    }
}

function mapCreateErrorCode(code?: string): string {
  switch (code) {
    case "NO_ROOM":
      return "Could not prepare lobby. Retry once.";
    case "SERVER_ERROR":
      return "Internal server error while creating room.";
    default:
      return "Could not create lobby. Connection may be weak.";
    }
}

function mapStartErrorCode(code?: string): string {
  switch (code) {
    case "NOT_HOST":
      return "Only host can start race.";
    case "NOT_ENOUGH_PLAYERS":
      return "Need at least 2 players.";
    case "NO_ROOM":
      return "Room not found. Rejoin lobby.";
    default:
      return "Could not start race.";
  }
}

function emitWithAck(
  socket: ReturnType<typeof getSocket>,
  event: string,
  payload: unknown,
  timeoutMs = 15000
): Promise<SocketAck> {
  return new Promise<SocketAck>((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (error: unknown, response: SocketAck) => {
      if (error) {
        reject(new Error("Request timed out"));
        return;
      }
      resolve(response ?? { ok: true });
    });
  });
}

export function Lobby({ onEnterGame, onSinglePlayer, initialRoomCode }: LobbyProps) {
  const [screen, setScreen] = useState<"main" | "create" | "join">("main");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [waitingRoom, setWaitingRoom] = useState<WaitingRoomState | null>(null);
  const [error, setError] = useState("");
  const [connectionHint, setConnectionHint] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState("");
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Custom stable callback hook to replace useEffectEvent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useStableCallback = <T extends (...args: any[]) => any>(callback: T): T => {
    const callbackRef = useRef<T>(callback);
    callbackRef.current = callback;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return useCallback((...args: any[]) => callbackRef.current(...args), []) as T;
  };

  const roomSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinedRef = useRef(false);

  const { session, signInWithGoogle, signOut, displayName, avatarUrl } = useAuth();

  const inviteLink = useMemo(() => {
    if (!waitingRoom || typeof window === "undefined") return "";
    return `${window.location.origin}?room=${waitingRoom.roomCode}`;
  }, [waitingRoom]);

  useEffect(() => {
    const inviteCode = initialRoomCode || readInviteCode();
    if (!inviteCode) return;

    const frame = requestAnimationFrame(() => {
      setRoomCode(inviteCode);
      setScreen("join");
      if (initialRoomCode) {
        // Automatically attempt to join if returning
        handleJoin(inviteCode);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [initialRoomCode]);

  const clearRoomSyncTimer = () => {
    if (!roomSyncTimeoutRef.current) return;
    clearTimeout(roomSyncTimeoutRef.current);
    roomSyncTimeoutRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (roomSyncTimeoutRef.current) {
        clearTimeout(roomSyncTimeoutRef.current);
      }
    };
  }, []);

  const handleRoomCreated = useStableCallback((payload: RoomPayload) => {
    clearRoomSyncTimer();
    joinedRef.current = true;
    setMyId(payload.player.id);
    setIsHost(true);
    setIsConnecting(false);
    setError("");
    setConnectionHint("");
    setWaitingRoom({
      roomCode: payload.roomCode,
      players: payload.room.players,
      host: payload.room.host,
    });
  });

  const handleJoinedRoom = useStableCallback((payload: RoomPayload) => {
    clearRoomSyncTimer();
    joinedRef.current = true;
    setMyId(payload.player.id);
    setIsHost(payload.room.host === payload.player.id);
    setIsConnecting(false);
    setError("");
    setConnectionHint("");
    setWaitingRoom({
      roomCode: payload.roomCode,
      players: payload.room.players,
      host: payload.room.host,
    });
  });

  const handleRoomUpdate = useStableCallback((room: ServerRoom) => {
    setWaitingRoom((prev) => {
      if (!prev) return prev;
      return {
        roomCode: prev.roomCode,
        players: room.players,
        host: room.host,
      };
    });
    setIsHost(room.host === myId);
  });

  const handleJoinError = useStableCallback((message: string) => {
    clearRoomSyncTimer();
    setError(message || "Could not join room.");
    setConnectionHint("");
    setIsConnecting(false);
  });

  const handleSocketConnectError = useStableCallback((connectError: Error) => {
    clearRoomSyncTimer();
    setError(getErrorMessage(connectError));
    setConnectionHint("");
    setIsConnecting(false);
  });

  const handleSocketConnected = useStableCallback(() => {
    if (isConnecting) {
      setConnectionHint("Connected. Waiting for lobby...");
    }
    // Auto-rejoin if we were already in a room and just disconnected momentarily
    if (waitingRoom && !isConnecting) {
      setConnectionHint("Reconnecting to room...");
      const socket = getSocket();
      emitWithAck(socket, "join-room", {
        roomCode: waitingRoom.roomCode,
        playerName: playerName.trim() || displayName || "Pilot",
        avatarUrl,
      }, 10000).catch(() => {
        setConnectionHint("");
        setError("Reconnection failed. You might need to rejoin manually.");
      });
    }
  });

  const handleRaceCountdown = useStableCallback(() => {
    if (!waitingRoom) return;
    const me = waitingRoom.players.find((player) => player.id === myId);
    setConnectionHint("");

    onEnterGame({
      roomCode: waitingRoom.roomCode,
      playerId: myId,
      playerName: playerName.trim() || displayName || "Pilot",
      players: waitingRoom.players,
      isHost,
      color: me?.color || "#8b1a1a",
    });
  });

  useEffect(() => {
    const socket = connectSocket();

    socket.on("room-created", handleRoomCreated);
    socket.on("joined-room", handleJoinedRoom);
    socket.on("room-update", handleRoomUpdate);
    socket.on("join-error", handleJoinError);
    socket.on("race-countdown", handleRaceCountdown);
    socket.on("connect", handleSocketConnected);
    socket.on("connect_error", handleSocketConnectError);

    return () => {
      socket.off("room-created", handleRoomCreated);
      socket.off("joined-room", handleJoinedRoom);
      socket.off("room-update", handleRoomUpdate);
      socket.off("join-error", handleJoinError);
      socket.off("race-countdown", handleRaceCountdown);
      socket.off("connect", handleSocketConnected);
      socket.off("connect_error", handleSocketConnectError);
    };
  }, [
    handleRoomCreated,
    handleJoinedRoom,
    handleRoomUpdate,
    handleJoinError,
    handleRaceCountdown,
    handleSocketConnected,
    handleSocketConnectError,
  ]);

  const startRoomSyncWatchdog = () => {
    clearRoomSyncTimer();
    if (joinedRef.current) return;
    roomSyncTimeoutRef.current = setTimeout(() => {
      if (joinedRef.current) return;
      setIsConnecting(false);
      setConnectionHint("");
      setError("Server is busy syncing room state. Retry once.");
    }, 20000);
  };

  const runWithRetry = async <T,>(
    operation: () => Promise<T>,
    retries = 2
  ): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
        }
      }
    }

    throw lastError ?? new Error("Operation failed");
  };

  const prepareSocket = async () => {
    const socket = await ensureSocketConnected(15000, 4);
    await emitWithAck(socket, "leave-room", {}, 6000).catch(() => ({ ok: true }));
    return socket;
  };

  const handleCreate = async () => {
    const trimmedName = playerName.trim() || displayName || "Pilot";
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }

    setError("");
    setIsConnecting(true);
    setConnectionHint("Connecting...");
    joinedRef.current = false;

    try {
      const socket = await runWithRetry(prepareSocket, 2);
      setConnectionHint("Creating lobby...");
      const ack = await emitWithAck(
        socket,
        "create-room",
        { playerName: trimmedName, avatarUrl },
        20000
      );

      if (ack.ok === false) {
        throw new Error(mapCreateErrorCode(ack.code));
      }
      // Let handleRoomCreated clear everything naturally
      startRoomSyncWatchdog();
    } catch (connectError) {
      clearRoomSyncTimer();
      const socketUrl = getSocketUrl();
      setError(`${getErrorMessage(connectError)} (server: ${socketUrl})`);
      setConnectionHint("");
      setIsConnecting(false);
    }
  };

  const handleJoin = async (explicitCode?: string | React.MouseEvent) => {
    const trimmedName = playerName.trim() || displayName || "Pilot";
    const actualCode = typeof explicitCode === "string" ? explicitCode : roomCode;
    const normalizedCode = actualCode.trim().toUpperCase();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!normalizedCode) {
      setError("Please enter room code.");
      return;
    }

    setError("");
    setIsConnecting(true);
    setConnectionHint("Connecting...");
    joinedRef.current = false;

    try {
      const socket = await runWithRetry(prepareSocket, 2);
      setConnectionHint("Joining room...");
      const ack = await emitWithAck(
        socket,
        "join-room",
        {
          roomCode: normalizedCode,
          playerName: trimmedName,
          avatarUrl,
        },
        20000
      );

      if (ack.ok === false) {
        throw new Error(mapJoinErrorCode(ack.code));
      }
      // Let handleJoinedRoom clear everything naturally
      startRoomSyncWatchdog();
    } catch (connectError) {
      clearRoomSyncTimer();
      const socketUrl = getSocketUrl();
      setError(`${getErrorMessage(connectError)} (server: ${socketUrl})`);
      setConnectionHint("");
      setIsConnecting(false);
    }
  };

  const handleQuickJoin = async () => {
    const trimmedName = playerName.trim() || displayName || "Pilot";
    
    setError("");
    setIsConnecting(true);
    setConnectionHint("Finding session...");
    joinedRef.current = false;

    try {
      const socket = await runWithRetry(prepareSocket, 2);
      setConnectionHint("Queuing for match...");
      const ack = await emitWithAck(
        socket,
        "quick-join",
        { playerName: trimmedName, avatarUrl },
        20000
      );

      if (ack.ok === false) {
        throw new Error("Could not join any room.");
      }
      
      startRoomSyncWatchdog();
    } catch (connectError) {
      clearRoomSyncTimer();
      setError(getErrorMessage(connectError));
      setConnectionHint("");
      setIsConnecting(false);
    }
  };

  const handleStartRace = async () => {
    if (!waitingRoom || waitingRoom.players.length < 2) {
      setError("Need at least 2 players to start race.");
      return;
    }

    setError("");
    setConnectionHint("Starting race...");
    setIsConnecting(true); // Disable button immediately so user knows it was clicked
    try {
      const ack = await emitWithAck(getSocket(), "start-race", {}, 10000);
      if (ack.ok === false) {
        throw new Error(mapStartErrorCode(ack.code));
      }
      // We don't clear isConnecting here, we wait for race-countdown socket event to launch game
      setConnectionHint("Waiting for server...");
    } catch (error) {
      setConnectionHint("");
      setIsConnecting(false);
      setError(getErrorMessage(error));
    }
  };

  const copyInvite = async () => {
    if (!waitingRoom) return;
    const valueToCopy = inviteLink || waitingRoom.roomCode;
    try {
      await navigator.clipboard.writeText(valueToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access is blocked on this device.");
    }
  };

  if (waitingRoom) {
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] z-[100] flex items-center justify-center scanlines">
        <div className="max-w-lg w-full mx-4">
          <KartShowcase color="#c41e1e" />
          <div className="bg-[#c41e1e] px-6 py-4 mb-0 shadow-[8px_8px_0px_#111]">
            <div className="text-[10px] text-white/60 uppercase tracking-[0.4em] mb-1">
              Share room code with your friends
            </div>
            <div className="flex items-center justify-between mt-1 gap-3">
              <span className="text-3xl font-black text-white tracking-[0.4em]">
                {waitingRoom.roomCode}
              </span>
              <button
                onClick={copyInvite}
                className="text-[9px] bg-white/20 hover:bg-white/30 text-white px-4 py-2 uppercase tracking-widest transition-all cursor-pointer border border-white/10"
              >
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          </div>

          <div className="bg-black/80 border-2 border-[#333] border-t-0 p-4">
            <div className="text-[8px] text-[#888] uppercase tracking-widest mb-3">
              Players ({waitingRoom.players.length}/6)
            </div>
            <div className="space-y-2">
              {waitingRoom.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 bg-[#111] px-4 py-3 border border-white/5 shadow-[3px_3px_0px_#000]"
                >
                  {player.avatarUrl ? (
                    <div className="relative w-6 h-6 rounded-full overflow-hidden opacity-80">
                      <Image
                        src={player.avatarUrl}
                        alt="avatar"
                        fill
                        sizes="24px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                  ) : (
                    <div className="w-6 h-6 bg-[#333] flex items-center justify-center text-[8px] text-white/50">
                      ?
                    </div>
                  )}
                  <div className="w-4 h-4" style={{ backgroundColor: player.color }} />
                  <span className="text-xs text-white/90 flex-1 uppercase tracking-wider">
                    {player.name}
                  </span>
                  {player.id === waitingRoom.host && (
                    <div className="bg-[#d4a017] text-[#000] text-[6px] px-2 py-1 rounded-sm uppercase font-bold tracking-tighter">
                      HOST
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="text-[9px] text-[#c41e1e] mt-3 font-bold uppercase tracking-tight">
                {error}
              </div>
            )}
            {!error && connectionHint && (
              <div className="text-[9px] text-[#d4a017] mt-3 font-bold uppercase tracking-tight">
                {connectionHint}
              </div>
            )}

            {isHost && (
              <button
                onClick={handleStartRace}
                disabled={waitingRoom.players.length < 2 || isConnecting}
                className="w-full mt-4 bg-[#c41e1e] hover:bg-[#e02020] disabled:bg-[#444] text-white text-xs py-3 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer disabled:cursor-not-allowed"
              >
                {isConnecting ? "Starting..." : "Start Race"}
              </button>
            )}

            {!isHost && (
              <div className="mt-4 text-center text-[8px] text-[#888] uppercase tracking-widest animate-pulse">
                Waiting for host...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] z-50 flex flex-col items-center justify-center scanlines overflow-hidden">
      <div className="absolute top-6 left-6 z-[100] flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${waitingRoom ? "bg-green-500" : isConnecting ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
        <div className="text-[7px] text-white/30 uppercase tracking-[0.3em] font-bold">
          {waitingRoom ? "Multiplayer Active" : isConnecting ? "Stabilizing Comm-Link..." : "Disconnected from Command"}
        </div>
      </div>

      <KartShowcase color={session ? "#1a5c8b" : "#8b1a1a"} />

      <div className="text-center mb-12 relative z-[99] pointer-events-none drop-shadow-2xl">
        <div className="bg-[#c41e1e] inline-block px-10 py-6 shadow-[10px_10px_0px_#000] mb-6">
          <h1 className="text-3xl sm:text-5xl text-white uppercase tracking-[0.5em] leading-none font-black italic">
            REDKART
          </h1>
        </div>
        <div className="text-[9px] text-[#555] font-bold uppercase tracking-[0.8em]">
          ONLINE KARTING CIRCUIT
        </div>
      </div>

      {screen === "main" && (
        <>
          <div className="flex flex-col gap-6 items-center w-full max-w-sm px-6 relative z-[1000]">
            {!session ? (
              <div className="w-full flex flex-col gap-4 items-center mt-12">
                <div className="text-xs text-[#888] uppercase tracking-[0.2em] mb-2 text-center animate-pulse">
                  Sign in to play multiplayer
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-[#111] hover:bg-[#222] text-white text-sm sm:text-base py-6 uppercase tracking-[0.3em] border-2 border-[#c41e1e] transition-all shadow-[8px_8px_0px_#000] cursor-pointer flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
                >
                  Continue with Google
                </button>
              </div>
            ) : (
              <>
                <div className="w-full bg-[#111] border border-[#333] p-4 mb-2 flex items-center justify-between shadow-[6px_6px_0px_#000]">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <div className="relative w-10 h-10 border border-[#c41e1e] overflow-hidden">
                        <Image
                          src={avatarUrl}
                          alt="Avatar"
                          fill
                          sizes="40px"
                          style={{ objectFit: 'cover' }}
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-[#c41e1e] flex items-center justify-center text-white text-xs font-bold">
                        {(displayName || "P")[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] text-white uppercase tracking-[0.2em] font-black">
                        {displayName}
                      </div>
                      <div className="text-[7px] text-[#c41e1e] uppercase tracking-[0.4em] font-bold mt-0.5">
                        ONLINE PILOT
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={signOut}
                    className="text-[8px] text-[#444] hover:text-[#c41e1e] uppercase transition-all font-black tracking-widest px-2"
                  >
                    SIGN OUT
                  </button>
                </div>

                <button
                  onClick={onSinglePlayer}
                  className="w-full bg-[#222] hover:bg-[#333] text-white text-sm sm:text-base py-5 uppercase tracking-[0.4em] border border-[#444] transition-all shadow-[6px_6px_0px_#000] cursor-pointer active:translate-y-1 active:shadow-none"
                >
                  SOLO PRACTICE
                </button>

                <button
                  onClick={handleQuickJoin}
                  disabled={isConnecting}
                  className="w-full bg-[#d4a017] hover:bg-[#e4b027] text-black text-sm sm:text-base py-5 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] cursor-pointer disabled:opacity-50 active:translate-y-1 active:shadow-none font-black"
                >
                  {isConnecting ? "SEARCHING..." : "QUICK MATCH"}
                </button>

                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => {
                      if (!playerName) setPlayerName(displayName || "");
                      setError("");
                      setConnectionHint("");
                      setScreen("create");
                    }}
                    disabled={isConnecting}
                    className="flex-1 bg-[#c41e1e] hover:bg-[#e02020] text-white text-xs py-4 uppercase tracking-[0.2em] transition-all shadow-[6px_6px_0px_#000] cursor-pointer disabled:opacity-50 active:translate-y-1 active:shadow-none"
                  >
                    CREATE LOBBY
                  </button>

                  <button
                    onClick={() => {
                      if (!playerName) setPlayerName(displayName || "");
                      setError("");
                      setConnectionHint("");
                      setScreen("join");
                    }}
                    disabled={isConnecting}
                    className="flex-1 bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-xs py-4 uppercase tracking-[0.2em] transition-all shadow-[6px_6px_0px_#000] cursor-pointer disabled:opacity-50 active:translate-y-1 active:shadow-none"
                  >
                    JOIN LOBBY
                  </button>
                </div>
              </>
            )}
          </div>

          {session && (
            <div className="mt-8 relative z-50 w-full max-w-[700px] px-4 hidden sm:block">
              <DetailedRankings />
            </div>
          )}
        </>
      )}

      {screen === "create" && session && (
        <div className="w-80 relative z-[1000] bg-black/40 p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
          <div className="text-[10px] text-[#c41e1e] font-black uppercase tracking-[0.3em] mb-6 border-b border-[#c41e1e]/20 pb-2">
            Create Lobby
          </div>
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            Driver Name
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Pilot"
            maxLength={16}
            className="w-full bg-[#111] text-white text-xs px-4 py-4 border border-[#333] focus:border-[#c41e1e] outline-none mb-6 placeholder-[#333] tracking-widest uppercase"
          />
          {error && (
            <div className="text-[9px] text-[#c41e1e] mb-4 font-bold uppercase tracking-tight">
              {error}
            </div>
          )}
          {!error && connectionHint && (
            <div className="text-[9px] text-[#d4a017] mb-4 font-bold uppercase tracking-tight">
              {connectionHint}
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={isConnecting}
            className="w-full bg-[#c41e1e] hover:bg-[#e02020] text-white text-xs py-4 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] mb-4 cursor-pointer disabled:opacity-50 font-black active:translate-y-1 active:shadow-none"
          >
            {isConnecting ? "CONNECTING..." : "CREATE"}
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
              setConnectionHint("");
            }}
            className="w-full text-[8px] text-[#444] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer font-bold"
          >
            {"<- BACK"}
          </button>
        </div>
      )}

      {screen === "join" && (
        <div className="w-80 relative z-[1000] bg-black/40 p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
          <div className="text-[10px] text-[#1a5c8b] font-black uppercase tracking-[0.3em] mb-6 border-b border-[#1a5c8b]/20 pb-2">
            Join Lobby
          </div>
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            Driver Name
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Pilot"
            maxLength={16}
            className="w-full bg-[#111] text-white text-xs px-4 py-4 border border-[#333] focus:border-[#1a5c8b] outline-none mb-6 placeholder-[#333] tracking-widest uppercase"
          />
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            Room Code
          </div>
          <input
            type="text"
            value={roomCode}
            onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="w-full bg-[#111] text-white text-sm px-4 py-4 border border-[#333] focus:border-[#1a5c8b] outline-none mb-6 placeholder-[#333] uppercase tracking-[0.6em] text-center font-black"
          />
          {error && (
            <div className="text-[9px] text-[#c41e1e] mb-4 font-bold uppercase tracking-tight">
              {error}
            </div>
          )}
          {!error && connectionHint && (
            <div className="text-[9px] text-[#d4a017] mb-4 font-bold uppercase tracking-tight">
              {connectionHint}
            </div>
          )}
          <button
            onClick={handleJoin}
            disabled={isConnecting}
            className="w-full bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-xs py-4 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] mb-4 cursor-pointer disabled:opacity-50 font-black active:translate-y-1 active:shadow-none"
          >
            {isConnecting ? "CONNECTING..." : "JOIN"}
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
              setConnectionHint("");
            }}
            className="w-full text-[8px] text-[#444] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer font-bold"
          >
            {"<- BACK"}
          </button>
        </div>
      )}

      <div className="absolute bottom-6 text-[7px] text-[#333] uppercase tracking-[0.4em]">
        WASD - Drive | Space - Drift
      </div>
    </div>
  );
}
