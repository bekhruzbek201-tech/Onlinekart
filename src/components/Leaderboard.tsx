"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface LeaderboardEntry {
  player_id: string;
  display_name: string;
  best_time_ms: number;
}

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      // Get top 10 fastest times from players table
      const { data, error } = await supabase
        .from("players")
        .select("id, display_name, best_time_ms")
        .not("best_time_ms", "is", null)
        .order("best_time_ms", { ascending: true })
        .limit(10);

      if (!error && data) {
        setEntries(data.map((d: any) => ({
          player_id: d.id,
          display_name: d.display_name,
          best_time_ms: d.best_time_ms,
        })));
      }
      setLoading(false);
    }
    fetchLeaderboard();
  }, []);

  const formatTime = (ms: number) => {
    const s = ms / 1000;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const millis = Math.floor((s % 1) * 100);
    return `${m}:${sec.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-black/80 border-2 border-[#333] p-4 w-full shadow-[4px_4px_0px_#000]">
      <div className="text-[10px] text-[#888] uppercase tracking-widest mb-3 text-center border-b border-[#333] pb-2">
        Мировой Рекорд
      </div>
      
      {loading ? (
        <div className="text-center text-[8px] text-[#555] py-4 animate-pulse">
          Загрузка данных...
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center text-[8px] text-[#555] py-4">
          Пока нет рекордов
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, i) => (
            <div key={entry.player_id} className="flex justify-between items-center text-[8px] py-1.5 px-2 bg-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <span className={`w-4 text-center ${i === 0 ? "text-[#d4a017]" : i === 1 ? "text-[#aaa]" : i === 2 ? "text-[#cd7f32]" : "text-[#555]"}`}>
                  #{i + 1}
                </span>
                <span className="text-white uppercase truncate max-w-[100px]">
                  {entry.display_name}
                </span>
              </div>
              <span className={`tabular-nums ${i === 0 ? "text-[#d4a017]" : "text-[#aaa]"}`}>
                {formatTime(entry.best_time_ms)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
