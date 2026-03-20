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
  const [isConnecting, setIsConnecting] = useState(false);

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
    setIsConnecting(true);
    setError("");
    const socket = connectSocket();
    if (!socket.connected) {
      setError("ОШИБКА: НЕТ СВЯЗИ С СЕРВЕРОМ. ПРОВЕРЬТЕ, ЗАПУЩЕН ЛИ SERVER.JS");
      setIsConnecting(false);
      return;
    }
    socket.emit("create-room", { 
      playerName: playerName.trim(), 
      avatarUrl 
    });
    // Add a timeout fallback
    setTimeout(() => setIsConnecting(false), 3000);
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
    setIsConnecting(true);
    setError("");
    const socket = connectSocket();
    if (!socket.connected) {
      setError("ОШИБКА: НЕТ СВЯЗИ С СЕРВЕРОМ. ПРОВЕРЬТЕ, ЗАПУЩЕН ЛИ SERVER.JS");
      setIsConnecting(false);
      return;
    }
    socket.emit("join-room", {
      roomCode: roomCode.trim(),
      playerName: playerName.trim(),
      avatarUrl
    });
    // Add a timeout fallback
    setTimeout(() => setIsConnecting(false), 5000);
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
      <div className="fixed inset-0 bg-[#0d0d0d] z-[100] flex items-center justify-center scanlines">
        <div className="max-w-lg w-full mx-4">
          <KartShowcase color="#c41e1e" />
          {/* Room header */}
          <div className="bg-[#c41e1e] px-6 py-4 mb-0 shadow-[8px_8px_0px_#111]">
            <div className="text-[10px] text-white/50 uppercase tracking-[0.4em] mb-1">
              СКОПИРУЙТЕ КОД И ПЕРЕДАЙТЕ ДРУЗЬЯМ
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-3xl font-black text-white tracking-[0.4em]">
                {waitingRoom.roomCode}
              </span>
              <button
                onClick={copyCode}
                className="text-[9px] bg-white/20 hover:bg-white/30 text-white px-4 py-2 uppercase tracking-widest transition-all cursor-pointer border border-white/10"
              >
                {copied ? "ГОТОВО ✓" : "КОД"}
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
                  className="flex items-center gap-3 bg-[#111] px-4 py-3 border border-white/5 shadow-[3px_3px_0px_#000]"
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} className="w-6 h-6 rounded-full opacity-80" alt="avatar" />
                  ) : (
                    <div className="w-6 h-6 bg-[#333] flex items-center justify-center text-[8px] text-white/50">?</div>
                  )}
                  <div
                    className="w-4 h-4"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-xs text-white/90 flex-1 uppercase tracking-wider">
                    {p.name}
                  </span>
                  {p.id === waitingRoom.players[0]?.id && (
                    <div className="bg-[#d4a017] text-[#000] text-[6px] px-2 py-1 rounded-sm uppercase font-bold tracking-tighter">
                      ХОСТ
                    </div>
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

      {/* Main menu */}
      {screen === "main" && (
        <>
          <div className="flex flex-col gap-6 items-center w-full max-w-sm px-6 relative z-[1000]">
            {!session ? (
              <div className="w-full flex flex-col gap-4 items-center mt-12">
                <div className="text-xs text-[#888] uppercase tracking-[0.2em] mb-2 text-center animate-pulse">
                  АВТОРИЗАЦИЯ ОБЯЗАТЕЛЬНА
                </div>
                <button
                  onClick={signInWithGoogle}
                  className="w-full bg-[#111] hover:bg-[#222] text-white text-sm sm:text-base py-6 uppercase tracking-[0.3em] border-2 border-[#c41e1e] transition-all shadow-[8px_8px_0px_#000] cursor-pointer flex items-center justify-center gap-3 active:translate-y-1 active:shadow-none"
                >
                  <svg className="w-6 h-6 text-[#c41e1e]" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  ВХОД
                </button>
              </div>
            ) : (
              <>
                <div className="w-full bg-[#111] border border-[#333] p-4 mb-2 flex items-center justify-between shadow-[6px_6px_0px_#000]">
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-10 h-10 border border-[#c41e1e]" />
                    ) : (
                      <div className="w-10 h-10 bg-[#c41e1e] flex items-center justify-center text-white text-xs font-bold">
                        {displayName[0]}
                      </div>
                    )}
                    <div>
                      <div className="text-[11px] text-white uppercase tracking-[0.2em] font-black">{displayName}</div>
                      <div className="text-[7px] text-[#c41e1e] uppercase tracking-[0.4em] font-bold mt-0.5">ЭЛИТНЫЙ КУРСАНТ</div>
                    </div>
                  </div>
                  <button
                    onClick={signOut}
                    className="text-[8px] text-[#444] hover:text-[#c41e1e] uppercase transition-all font-black tracking-widest px-2"
                  >
                    ВЫЙТИ
                  </button>
                </div>

                <button
                  onClick={onSinglePlayer}
                  className="w-full bg-[#222] hover:bg-[#333] text-white text-sm sm:text-base py-5 uppercase tracking-[0.4em] border border-[#444] transition-all shadow-[6px_6px_0px_#000] cursor-pointer active:translate-y-1 active:shadow-none"
                >
                  ОДИНОЧНЫЙ ЗАЕЗД
                </button>
                
                <button
                  onClick={() => {
                    setPlayerName(displayName);
                    setScreen("create");
                  }}
                  disabled={isConnecting}
                  className="w-full bg-[#c41e1e] hover:bg-[#e02020] text-white text-sm sm:text-base py-5 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] cursor-pointer disabled:opacity-50 active:translate-y-1 active:shadow-none"
                >
                  {isConnecting ? "ПОДКЛЮЧЕНИЕ..." : "НОВАЯ КОМНАТА"}
                </button>
                
                <button
                  onClick={() => {
                    setPlayerName(displayName);
                    setScreen("join");
                  }}
                  disabled={isConnecting}
                  className="w-full bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-sm sm:text-base py-5 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] cursor-pointer disabled:opacity-50 active:translate-y-1 active:shadow-none"
                >
                  {isConnecting ? "ПОИСК..." : "ВОЙТИ В СТРОЙ"}
                </button>
              </>
            )}
          </div>

          {/* Leaderboard cleanly centered underneath everything */}
          {session && (
            <div className="mt-8 relative z-50 w-full max-w-[700px] px-4 hidden sm:block">
              <DetailedRankings />
            </div>
          )}
        </>
      )}

      {/* Create room */}
      {screen === "create" && session && (
        <div className="w-80 relative z-[1000] bg-black/40 p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
          <div className="text-[10px] text-[#c41e1e] font-black uppercase tracking-[0.3em] mb-6 border-b border-[#c41e1e]/20 pb-2">
            РЕГИСТРАЦИЯ ПОЗЫВНОГО
          </div>
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            ИМЯ ПИЛОТА
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Товарищ"
            maxLength={16}
            className="w-full bg-[#111] text-white text-xs px-4 py-4 border border-[#333] focus:border-[#c41e1e] outline-none mb-6 placeholder-[#333] tracking-widest uppercase"
          />
          {error && (
            <div className="text-[9px] text-[#c41e1e] mb-4 font-bold animate-shake uppercase tracking-tighter">! ERROR: {error}</div>
          )}
          <button
            onClick={handleCreate}
            disabled={isConnecting}
            className="w-full bg-[#c41e1e] hover:bg-[#e02020] text-white text-xs py-4 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] mb-4 cursor-pointer disabled:opacity-50 font-black active:translate-y-1 active:shadow-none"
          >
            {isConnecting ? "СВЯЗЬ..." : "УТВЕРДИТЬ"}
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
            }}
            className="w-full text-[8px] text-[#444] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer font-bold"
          >
            ← ОТМЕНА
          </button>
        </div>
      )}

      {/* Join room */}
      {screen === "join" && (
        <div className="w-80 relative z-[1000] bg-black/40 p-8 border border-white/5 shadow-2xl backdrop-blur-sm">
          <div className="text-[10px] text-[#1a5c8b] font-black uppercase tracking-[0.3em] mb-6 border-b border-[#1a5c8b]/20 pb-2">
            ВХОД В КООРДИНАТНУЮ СЕТЬ
          </div>
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            ИМЯ ПИЛОТА
          </div>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Товарищ"
            maxLength={16}
            className="w-full bg-[#111] text-white text-xs px-4 py-4 border border-[#333] focus:border-[#1a5c8b] outline-none mb-6 placeholder-[#333] tracking-widest uppercase"
          />
          <div className="text-[8px] text-[#666] uppercase tracking-widest mb-2 font-bold">
            ШИФРОВКА КОМНАТЫ
          </div>
          <input
            type="text"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="w-full bg-[#111] text-white text-sm px-4 py-4 border border-[#333] focus:border-[#1a5c8b] outline-none mb-6 placeholder-[#333] uppercase tracking-[0.6em] text-center font-black"
          />
          {error && (
            <div className="text-[9px] text-[#c41e1e] mb-4 font-bold animate-shake uppercase tracking-tighter">! ERROR: {error}</div>
          )}
          <button
            onClick={handleJoin}
            disabled={isConnecting}
            className="w-full bg-[#1a5c8b] hover:bg-[#2070a0] text-white text-xs py-4 uppercase tracking-[0.4em] transition-all shadow-[6px_6px_0px_#000] mb-4 cursor-pointer disabled:opacity-50 font-black active:translate-y-1 active:shadow-none"
          >
            {isConnecting ? "ПОИСК..." : "ПРИМКНУТЬ"}
          </button>
          <button
            onClick={() => {
              setScreen("main");
              setError("");
            }}
            className="w-full text-[8px] text-[#444] hover:text-white py-2 uppercase tracking-widest transition-colors cursor-pointer font-bold"
          >
            ← ОТМЕНА
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
