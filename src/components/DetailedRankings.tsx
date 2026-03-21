"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface PlayerStats {
  id: string;
  display_name: string;
  avatar_url: string;
  total_races: number;
  total_wins: number;
  best_time_ms: number;
  rank_title: string;
}

export function DetailedRankings() {
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"speed" | "wins">("speed");

  const getRankTitle = (timeMs: number) => {
    if (!timeMs) return "Recruit";
    if (timeMs < 45000) return "General Secretary";
    if (timeMs < 55000) return "Hero of Union";
    if (timeMs < 70000) return "Master Driver";
    if (timeMs < 90000) return "Stakhanovite";
    return "Veteran";
  };

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const query = supabase
          .from("players")
          .select("id, display_name, avatar_url, total_races, total_wins, best_time_ms");

        if (activeTab === "speed") {
          query.not("best_time_ms", "is", null).order("best_time_ms", { ascending: true });
        } else {
          query.order("total_wins", { ascending: false });
        }

        const { data, error } = await query.limit(20);

        if (error) {
          console.error("Supabase error fetching rankings:", error);
          setPlayers([]);
        } else if (data) {
          setPlayers((data as { id: string; display_name: string | null; avatar_url: string | null; total_races: number | null; total_wins: number | null; best_time_ms: number | null }[]).map((d) => ({
            id: d.id,
            display_name: d.display_name || "Unknown",
            avatar_url: d.avatar_url || "",
            total_races: d.total_races || 0,
            total_wins: d.total_wins || 0,
            best_time_ms: d.best_time_ms || 0,
            rank_title: getRankTitle(d.best_time_ms || 0)
          })));
        }
      } catch (err) {
        console.error("Network error fetching rankings", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [activeTab]);

  const formatTime = (ms: number) => {
    if (!ms) return "--:--.--";
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const millis = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-black/60 border-2 border-[#1a1a1a] shadow-[10px_10px_0px_#000] overflow-hidden flex flex-col h-[400px]">
      {/* Header with Soviet tabs */}
      <div className="flex border-b-2 border-[#1a1a1a] bg-[#0a0a0a]">
        <button
          onClick={() => setActiveTab("speed")}
          className={`px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black transition-all ${activeTab === "speed" ? "bg-[#c41e1e] text-white" : "text-[#555] hover:text-[#888]"}`}
        >
          Fastest Laps
        </button>
        <button
          onClick={() => setActiveTab("wins")}
          className={`px-6 py-4 text-[10px] uppercase tracking-[0.3em] font-black transition-all ${activeTab === "wins" ? "bg-[#c41e1e] text-white" : "text-[#555] hover:text-[#888]"}`}
        >
          Victories
        </button>
        <div className="flex-1" />
        <div className="px-4 py-4 text-[8px] text-[#222] uppercase tracking-widest font-black hidden sm:block">
          Central Command Records
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#080808]">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[10px] text-[#333] uppercase tracking-[0.5em] animate-pulse">
              Retrieving Archives...
            </div>
          </div>
        ) : players.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-[10px] text-[#333] uppercase tracking-[0.5em]">
              No records found
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#151515]">
            {players.map((p, i) => (
              <div 
                key={p.id} 
                className="group/row flex items-center px-6 py-4 hover:bg-[#111] transition-all duration-200"
              >
                {/* Ranking Number */}
                <div className="w-8 text-[11px] font-black italic">
                  {i === 0 ? <span className="text-[#d4a017]">1</span>
                   : i === 1 ? <span className="text-[#aaa]">2</span>
                   : i === 2 ? <span className="text-[#cd7f32]">3</span>
                   : <span className="text-[#444] group-hover/row:text-[#666] transition-colors">{i + 1}</span>}
                </div>

                {/* Player Profile */}
                <div className="flex-1 flex items-center gap-3 overflow-hidden">
                  {p.avatar_url ? (
                    <div className="relative w-7 h-7 sm:w-9 sm:h-9 overflow-hidden grayscale opacity-70 group-hover/row:grayscale-0 group-hover/row:opacity-100 transition-all duration-300">
                      <Image 
                        src={p.avatar_url} 
                        alt={p.display_name} 
                        fill
                        sizes="(max-width: 640px) 28px, 36px"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
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

                {/* Performance Stats */}
                <div className="flex items-center gap-8 sm:gap-12">
                  <div className="text-right hidden sm:block">
                    <div className="text-[7px] text-[#444] uppercase tracking-widest font-bold">Races</div>
                    <div className="text-[10px] text-[#888] tabular-nums">{p.total_races}</div>
                  </div>
                  
                  {activeTab === "speed" ? (
                    <div className="text-right w-20">
                      <div className="text-[7px] text-[#444] uppercase tracking-widest font-bold">Best Time</div>
                      <div className={`text-[11px] tabular-nums font-black ${i === 0 ? "text-[#d4a017]" : "text-white/80"}`}>
                        {formatTime(p.best_time_ms)}
                      </div>
                    </div>
                  ) : (
                    <div className="text-right w-20">
                      <div className="text-[7px] text-[#444] uppercase tracking-widest font-bold">Wins</div>
                      <div className={`text-[14px] tabular-nums font-black ${i === 0 ? "text-[#d4a017]" : "text-white/80"}`}>
                        {p.total_wins}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] px-6 py-2 flex items-center justify-between">
        <div className="text-[6px] text-[#333] uppercase tracking-[0.4em] font-bold">
           Updated in Real-Time via Central Command
        </div>
        <div className="w-1.5 h-1.5 bg-[#c41e1e] animate-pulse rounded-full" />
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #222;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #c41e1e;
        }
      `}</style>
    </div>
  );
}
