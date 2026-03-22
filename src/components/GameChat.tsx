"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";

interface ChatMessage {
  playerId: string;
  name: string;
  text: string;
  timestamp: number;
}

interface GameChatProps {
  roomCode?: string;
  myId: string;
}

export const GameChat = memo(function GameChat({ roomCode, myId }: GameChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!roomCode) return;

    const socket = getSocket();
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-30), msg]); // Keep last 30 messages
    };

    socket.on("chat-message", handler);
    return () => { socket.off("chat-message", handler); };
  }, [roomCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !roomCode) return;
    const socket = getSocket();
    socket.emit("chat-message", { text: inputText.trim() });
    setInputText("");
  }, [inputText, roomCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation(); // Prevent game controls from triggering
    if (e.key === "Enter") {
      sendMessage();
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }, [sendMessage]);

  if (!roomCode) return null;

  return (
    <div className="absolute top-16 left-4 z-40 select-none">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="bg-black/70 border border-[#333] text-[8px] text-white/60 px-3 py-1.5 uppercase tracking-widest hover:text-white hover:border-[#555] transition-all cursor-pointer mb-1"
      >
        {isOpen ? "✕ Close Chat" : `💬 Chat ${messages.length > 0 ? `(${messages.length})` : ""}`}
      </button>

      {isOpen && (
        <div className="bg-black/85 border border-[#333] w-64 shadow-[4px_4px_0px_#000] animate-fadeIn">
          {/* Messages */}
          <div className="h-32 overflow-y-auto p-2 space-y-1 scrollbar-thin">
            {messages.length === 0 && (
              <div className="text-[8px] text-[#555] text-center py-4 uppercase tracking-widest">
                No messages yet
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="text-[9px] leading-tight">
                <span className={`font-bold uppercase tracking-wider ${msg.playerId === myId ? "text-[#d4a017]" : "text-[#c41e1e]"}`}>
                  {msg.name}:
                </span>{" "}
                <span className="text-white/80">{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#333] p-1.5 flex gap-1">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type message..."
              maxLength={120}
              className="flex-1 bg-[#111] text-white text-[10px] px-2 py-1.5 border border-[#333] focus:border-[#c41e1e] outline-none placeholder-[#444] pointer-events-auto"
            />
            <button
              type="button"
              onClick={sendMessage}
              className="bg-[#c41e1e] hover:bg-[#e02020] text-white text-[8px] px-2 uppercase tracking-wider cursor-pointer pointer-events-auto"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
