"use client";

import { useState, useEffect } from "react";
import { connectSocket, getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/AuthProvider";
import { DetailedRankings } from "@/components/DetailedRankings";
import { KartShowcase } from "@/components/KartShowcase";

interface LobbyProps {
  onEnterGame: (data: {
    roomCode: string;
    playerId: string;
    playerName: string;
    players: any[];
    isHost: boolean;
    color: string;
  }) => void;
  onSinglePlayer: () => void;
}

export function Lobby({ onEnterGame, onSinglePlayer }: LobbyProps) {
  const [screen, setScreen] = useState<"main" | "create" | "join">("main");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [waitingRoom, setWaitingRoom] = useState<any>(null);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [myId, setMyId] = useState("");
  const [copied, setCopied] = useState(false);

  // Supabase Auth
  const { session, signInWithGoogle, signOut, displayName, avatarUrl } = useAuth();

  useEffect(() => {
    const socket = connectSocket();

    socket.on("room-created", ({ roomCode, player, room }) => {
      setMyId(player.id);
      setIsHost(true);
      setWaitingRoom({ roomCode, players: room.players });
    });

    socket.on("joined-room", ({ roomCode, player, room }) => {
      setMyId(player.id);
      setIsHost(false);
      setWaitingRoom({ roomCode, players: room.players });
    });

    socket.on("room-update", (room) => {
      setWaitingRoom((prev: any) =>
        prev ? { ...prev, players: room.players } : prev
      );
    });

    socket.on("join-error", (msg) => {
      setError(msg);
    });

    socket.on("race-countdown", () => {
      if (waitingRoom) {
        const wr = waitingRoom;
        const me = wr.players.find((p: any) => p.id === myId);
        onEnterGame({
          roomCode: wr.roomCode,
          playerId: myId,
          playerName: playerName || "Товарищ",
          players: wr.players,
          isHost,
          color: me?.color || "#8b1a1a",
        });
      }
    });

    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("room-update");
      socket.off("join-error");
      socket.off("race-countdown");
    };
  }, [waitingRoom, myId, isHost, playerName, onEnterGame]);

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError("Введите имя");
      return;
    }
    setError("");
    const socket = getSocket();
    socket.emit("create-room", playerName.trim());
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError("Введите имя");
      return;
    }
    if (!roomCode.trim()) {
      setError("Введите код комнаты");
      return;
    }
    setError("");
    const socket = getSocket();
    socket.emit("join-room", {
      roomCode: roomCode.trim(),
      playerName: playerName.trim(),
    });
  };

  const handleStartRace = () => {
    const socket = getSocket();
    socket.emit("start-race");
  };

  const copyCode = () => {
    if (waitingRoom) {
      navigator.clipboard.writeText(waitingRoom.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Waiting room screen
  if (waitingRoom) {
    return (
      <div className="fixed inset-0 bg-[#0d0d0d] z-50 flex items-center justify-center scanlines">
        <div className="max-w-lg w-full mx-4">
          {/* Room header */}
          <div className="bg-[#c41e1e] px-6 py-3 mb-0 shadow-[6px_6px_0px_#000]">
            <div className="text-[10px] text-white/60 uppercase tracking-[0.4em]">
              Комната
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl text-white tracking-[0.5em]">
                {waitingRoom.roomCode}
              </span>
              <button
                onClick={copyCode}
                className="text-[8px] bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 uppercase tracking-widest transition-colors cursor-pointer"
              >
                {copied ? "СКОПИРОВАНО ✓" : "КОПИРОВАТЬ"}
              </button>
            </div>
          </div>

          {/* Players list */}
          <div className="bg-black/80 border-2 border-[#333] border-t-0 p-4">
            <div className="text-[8px] text-[#888] uppercase tracking-widest mb-3">
              Игроки ({waitingRoom.players.length}/6)
            </div>
            <div className="space-y-2">
              {waitingRoom.players.map((p: any, i: number) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-[#1a1a1a] px-3 py-2 border border-[#333]"
                >
                  <div
                    className="w-4 h-4 border border-white/20"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-[10px] text-white flex-1">
                    {p.name}
                  </span>
                  {p.id === waitingRoom.players[0]?.id && (
                    <span className="text-[7px] text-[#d4a017] uppercase tracking-wider">
                      Хост
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Start button (host only) */}
            {isHost && (
              <button
                onClick={handleStartRace}
                disabled={waitingRoom.players.length < 1}
                className="w-full mt-4 bg-[#c41e1e] hover:bg-[#e02020] disabled:bg-[#444] text-white text-xs py-3 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer"
              >
                НАЧАТЬ ГОНКУ
              </button>
            )}

            {!isHost && (
              <div className="mt-4 text-center text-[8px] text-[#888] uppercase tracking-widest animate-pulse">
                Ожидание хоста...
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0d0d0d] z-50 flex flex-col items-center justify-center scanlines overflow-hidden">
      <KartShowcase color={session ? "#1a5c8b" : "#8b1a1a"} />
      
      {/* Title */}
      <div className="text-center mb-12">
        <div className="bg-[#c41e1e] inline-block px-8 py-4 shadow-[8px_8px_0px_#000] mb-4">
          <h1 className="text-2xl sm:text-4xl text-white uppercase tracking-[0.4em] leading-none">
            REDKART
          </h1>
        </div>
        <div className="text-[8px] text-[#888] uppercase tracking-[0.5em]">
          REDKART v1.0
        </div>
      </div>

      {/* Main menu */}
      {screen === "main" && (
        <div className="flex flex-col gap-3 items-center w-72">
          {session ? (
            <div className="w-full bg-[#1a1a1a] border border-[#333] p-3 mb-2 flex items-center justify-between shadow-[4px_4px_0px_#000]">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-8 h-8 opacity-80" />
                ) : (
                  <div className="w-8 h-8 bg-[#c41e1e] flex items-center justify-center text-white text-[10px]">
                    {displayName[0]}
                  </div>
                )}
                <div>
                  <div className="text-[10px] text-white uppercase tracking-wider">{displayName}</div>
                  <div className="text-[7px] text-[#888] uppercase tracking-[0.3em]">Пилот</div>
                </div>
              </div>
              <button
                onClick={signOut}
                className="text-[7px] text-[#888] hover:text-white uppercase transition-colors p-2"
              >
                ВЫЙТИ
              </button>
            </div>
          ) : (
            <div className="w-full mb-2">
              <button
                onClick={signInWithGoogle}
                className="w-full bg-[#111] hover:bg-[#222] text-white text-[10px] py-4 uppercase tracking-[0.2em] border border-[#333] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer flex items-center justify-center gap-3"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                ВХОД ЧЕРЕЗ GOOGLE
              </button>
            </div>
          )}

          <button
            onClick={onSinglePlayer}
            className="w-full bg-[#333] hover:bg-[#444] text-white text-[10px] py-4 uppercase tracking-[0.3em] border border-[#555] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer"
          >
            ОДИНОЧНАЯ ИГРА
          </button>
          
          <button
            onClick={() => {
              if (!session) return signInWithGoogle();
              setPlayerName(displayName);
              setScreen("create");
            }}
            className="w-full bg-[#c41e1e] hover:bg-[#e02020] text-white text-[10px] py-4 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer relative"
          >
            СОЗДАТЬ КОМНАТУ
            {!session && <span className="absolute top-1 right-2 text-[7px] text-white/50">🔒</span>}
          </button>
          
          <button
            onClick={() => {
              if (!session) return signInWithGoogle();
              setPlayerName(displayName);
              setScreen("join");
            }}
            className="w-full bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-[10px] py-4 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] cursor-pointer relative"
          >
            ВОЙТИ В КОМНАТУ
            {!session && <span className="absolute top-1 right-2 text-[7px] text-white/50">🔒</span>}
          </button>

          <div className="mt-8 w-full hidden sm:block">
            <DetailedRankings />
          </div>
        </div>
      )}

      {/* Create room */}
      {screen === "create" && session && (
        <div className="w-72">
          <div className="text-[8px] text-[#888] uppercase tracking-widest mb-2">
            Ваше имя
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Товарищ"
            maxLength={16}
            className="w-full bg-[#1a1a1a] text-white text-[10px] px-4 py-3 border border-[#444] focus:border-[#c41e1e] outline-none mb-3 placeholder-[#555]"
          />
          {error && (
            <div className="text-[8px] text-[#c41e1e] mb-2">{error}</div>
          )}
          <button
            onClick={handleCreate}
            className="w-full bg-[#c41e1e] hover:bg-[#e02020] text-white text-[10px] py-3 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] mb-2 cursor-pointer"
          >
            СОЗДАТЬ
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
            }}
            className="w-full text-[8px] text-[#888] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer"
          >
            ← НАЗАД
          </button>
        </div>
      )}

      {/* Join room */}
      {screen === "join" && (
        <div className="w-72">
          <div className="text-[8px] text-[#888] uppercase tracking-widest mb-2">
            Ваше имя
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Товарищ"
            maxLength={16}
            className="w-full bg-[#1a1a1a] text-white text-[10px] px-4 py-3 border border-[#444] focus:border-[#c41e1e] outline-none mb-3 placeholder-[#555]"
          />
          <div className="text-[8px] text-[#888] uppercase tracking-widest mb-2">
            Код комнаты
          </div>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="w-full bg-[#1a1a1a] text-white text-[10px] px-4 py-3 border border-[#444] focus:border-[#1a5c8b] outline-none mb-3 placeholder-[#555] uppercase tracking-[0.5em] text-center"
          />
          {error && (
            <div className="text-[8px] text-[#c41e1e] mb-2">{error}</div>
          )}
          <button
            onClick={handleJoin}
            className="w-full bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-[10px] py-3 uppercase tracking-[0.3em] transition-colors shadow-[4px_4px_0px_#000] mb-2 cursor-pointer"
          >
            ВОЙТИ
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
            }}
            className="w-full text-[8px] text-[#888] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer"
          >
            ← НАЗАД
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="absolute bottom-6 text-[7px] text-[#333] uppercase tracking-[0.4em]">
        WASD — Drive • Space — Drift
      </div>
    </div>
  );
}
