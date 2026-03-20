"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface PlayerStat {
  id: string;
  display_name: string;
  avatar_url: string;
  total_races: number;
  total_wins: number;
  best_time_ms: number;
  rank_title: string;
}

const RANK_TITLES = [
  { max: 60000, title: "ГЕНСЕК" },     // < 1 min
  { max: 70000, title: "ГЕРОЙ ТРУДА" }, // < 1:10
  { max: 80000, title: "КОМАНДИР" },    // < 1:20
  { max: 90000, title: "ВЕТЕРАН" },     // < 1:30
  { max: 120000, title: "ПИЛОТ" },      // < 2:00
  { max: Infinity, title: "НОВИЧОК" },  // > 2:00
];

function getRankTitle(timeMs: number | null) {
  if (!timeMs) return "НОВИЧОК";
  for (const r of RANK_TITLES) {
    if (timeMs <= r.max) return r.title;
  }
  return "НОВИЧОК";
}

function formatTime(ms: number | null) {
  if (!ms) return "--:--.--";
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const millis = Math.floor((s % 1) * 100);
  return `${m}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
}

export function DetailedRankings() {
  const [activeTab, setActiveTab] = useState<"speed" | "wins">("speed");
  const [players, setPlayers] = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const orderBy = activeTab === "speed" ? "best_time_ms" : "total_wins";
      const ascending = activeTab === "speed";

      let query = supabase
        .from("players")
        .select("*")
        .order(orderBy, { ascending })
        .limit(20);

      // Only show people who actually finished a race if sorting by speed
      if (activeTab === "speed") {
        query = query.not("best_time_ms", "is", null);
      } else {
        query = query.gt("total_wins", 0);
      }

      const { data, error } = await query;

      if (!error && data) {
        setPlayers(data.map((d: any) => ({
          id: d.id,
          display_name: d.display_name,
          avatar_url: d.avatar_url,
          total_races: d.total_races || 0,
          total_wins: d.total_wins || 0,
          best_time_ms: d.best_time_ms,
          rank_title: getRankTitle(d.best_time_ms)
        })));
      }
      setLoading(false);
    }
    fetchStats();
  }, [activeTab]);

  return (
    <div className="bg-black/85 border border-[#333] shadow-[8px_8px_0px_transparent] hover:shadow-[8px_8px_0px_#000] hover:border-[#444] transition-all duration-300 w-full max-w-2xl mx-auto h-[400px] flex flex-col relative overflow-hidden group">
      {/* Decorative scanline glow behind rankings */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(196,30,30,0.1),transparent_70%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Header Tabs */}
      <div className="flex border-b border-[#333] relative z-10">
        <button
          onClick={() => setActiveTab("speed")}
          className={`flex-1 py-3 text-[10px] uppercase tracking-[0.3em] transition-colors ${
            activeTab === "speed" ? "bg-[#c41e1e] text-white" : "bg-transparent text-[#666] hover:text-[#aaa] hover:bg-white/5"
          }`}
        >
          Рекорды Времени
        </button>
        <button
          onClick={() => setActiveTab("wins")}
          className={`flex-1 py-3 text-[10px] uppercase tracking-[0.3em] transition-colors ${
            activeTab === "wins" ? "bg-[#d4a017] text-black font-bold" : "bg-transparent text-[#666] hover:text-[#aaa] hover:bg-white/5"
          }`}
        >
          Зал Славы (Победы)
        </button>
      </div>

      {/* List Header */}
      <div className="flex text-[8px] text-[#555] uppercase tracking-widest px-4 py-2 border-b border-[#222] bg-[#0d0d0d] font-bold">
        <div className="w-12 text-center">Ранг</div>
        <div className="flex-1">Пилот</div>
        <div className="w-24 text-center hidden sm:block">Гонки</div>
        <div className="w-24 text-center hidden sm:block">Победы</div>
        <div className="w-32 text-right">
          {activeTab === "speed" ? "Лучшее Время" : "Рейтинг"}
        </div>
      </div>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto no-scrollbar relative z-10">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="text-[10px] text-[#888] uppercase tracking-[0.4em] animate-pulse">
              Загрузка архивов...
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="flex justify-center items-center h-full text-[10px] text-[#555] uppercase tracking-widest">
            Нет данных для отображения
          </div>
        ) : (
          <div className="space-y-[1px] bg-[#1a1a1a]">
            {players.map((p, i) => (
              <div 
                key={p.id} 
                className={`flex items-center px-4 py-2.5 bg-[#0a0a0a] hover:bg-[#151515] transition-colors group/row ${i === 0 && activeTab === "speed" ? "border-l-2 border-[#d4a017]" : "border-l-2 border-transparent hover:border-[#444]"}`}
              >
                {/* Rank Number */}
                <div className="w-12 text-center text-xs tabular-nums font-bold">
                  {i === 0 ? <span className="text-[#d4a017] drop-shadow-[0_0_8px_rgba(212,160,23,0.5)]">1</span>
                   : i === 1 ? <span className="text-[#aaa]">2</span>
                   : i === 2 ? <span className="text-[#cd7f32]">3</span>
                   : <span className="text-[#444] group-hover/row:text-[#666] transition-colors">{i + 1}</span>}
                </div>

                {/* Player Profile */}
                <div className="flex-1 flex items-center gap-3 overflow-hidden">
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="w-7 h-7 sm:w-9 sm:h-9 object-cover grayscale opacity-70 group-hover/row:grayscale-0 group-hover/row:opacity-100 transition-all duration-300" />
                  ) : (
                    <div className="w-7 h-7 sm:w-9 sm:h-9 bg-[#222] text-[#555] flex items-center justify-center text-[10px] border border-[#333]">
                      {p.display_name[0]}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className={`text-[10px] sm:text-xs uppercase tracking-wide truncate ${i === 0 ? "text-white" : "text-[#aaa] group-hover/row:text-white transition-colors"}`}>
                      {p.display_name}
                    </div>
                    <div className="text-[7px] text-[#c41e1e] uppercase tracking-[0.3em] font-bold mt-0.5">
                      {p.rank_title}
                    </div>
                  </div>
                </div>

                {/* Desktop Stats */}
                <div className="w-24 text-center hidden sm:block text-[10px] text-[#555] tabular-nums group-hover/row:text-[#888] transition-colors">
                  {p.total_races}
                </div>
                <div className="w-24 text-center hidden sm:block text-[10px] text-[#555] tabular-nums group-hover/row:text-[#888] transition-colors">
                  {p.total_wins}
                </div>

                {/* Primary Stat (Time or Wins) */}
                <div className={`w-32 text-right text-sm sm:text-base tabular-nums tracking-wide ${
                  i === 0 
                    ? "text-[#d4a017] drop-shadow-[0_0_8px_rgba(212,160,23,0.3)]" 
                    : "text-[#888] group-hover/row:text-[#ccc] transition-colors"
                }`}>
                  {activeTab === "speed" ? formatTime(p.best_time_ms) : p.total_wins}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
