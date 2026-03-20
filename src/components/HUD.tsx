"use client";

interface HUDProps {
  speed: number;
  maxSpeed: number;
  lap: number;
  totalLaps: number;
  raceTime: number;
  isBoosting?: boolean;
  isDrifting?: boolean;
  roomCode?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function HUD({ speed, maxSpeed, lap, totalLaps, raceTime, isBoosting, isDrifting, roomCode }: HUDProps) {
  const speedKmh = Math.round((speed / 42) * 220);
  const speedPercent = Math.min((speed / maxSpeed) * 100, 100);
  const rpmNeedle = Math.min(speedPercent * 2.7, 270); // 0-270 degrees for gauge

  return (
    <>
      {/* Scanlines */}
      <div className="scanlines absolute inset-0 pointer-events-none z-40" />

      {/* Speed lines overlay */}
      <div className={`speed-lines ${speedPercent > 70 ? "active" : ""}`} />

      {/* ─── TOP LEFT: Title ─── */}
      <div className="absolute top-4 left-4 z-30 select-none pointer-events-none animate-slideDown">
        <div className="bg-[#c41e1e] px-5 py-2.5 inline-block shadow-[5px_5px_0px_#000]">
          <h1 className="text-xs sm:text-base text-white uppercase tracking-[0.35em] leading-none">
            REDKART
          </h1>
        </div>
        {roomCode && (
          <div className="bg-black/80 border border-[#d4a017] px-3 py-1 mt-1.5 inline-block">
            <span className="text-[7px] text-[#d4a017] uppercase tracking-[0.3em]">
              Комната: {roomCode}
            </span>
          </div>
        )}
      </div>

      {/* ─── TOP RIGHT: Lap + Timer ─── */}
      <div className="absolute top-4 right-4 z-30 select-none pointer-events-none animate-slideDown">
        <div className="bg-black/85 border-2 border-[#c41e1e] px-5 py-3.5 shadow-[5px_5px_0px_#000]">
          <div className="text-right mb-3">
            <div className="text-[7px] text-[#666] uppercase tracking-[0.3em] mb-1">Круг</div>
            <div className="text-xl sm:text-3xl text-white leading-none tabular-nums tracking-wider">
              <span className="text-[#c41e1e]">{lap}</span>
              <span className="text-[#444]"> / {totalLaps}</span>
            </div>
          </div>
          <div className="text-right border-t border-[#2a2a2a] pt-2.5">
            <div className="text-[7px] text-[#666] uppercase tracking-[0.3em] mb-1">Время</div>
            <div className="text-base sm:text-xl text-[#d4a017] leading-none tabular-nums tracking-wide">
              {formatTime(raceTime)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM CENTER: Speedometer ─── */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 select-none pointer-events-none">
        <div className={`bg-black/85 border-2 px-7 py-4 flex items-end gap-5 shadow-[5px_5px_0px_#000] transition-all duration-150 ${
          isBoosting ? "border-[#d4a017] boost-glow" : isDrifting ? "border-[#ff6644] animate-shakeX" : "border-[#333]"
        }`}>
          <div className="text-right">
            <div className="text-[7px] uppercase tracking-[0.3em] mb-1.5">
              {isBoosting ? (
                <span className="text-[#d4a017] animate-pulse tracking-[0.4em]">⚡ УСКОРЕНИЕ</span>
              ) : isDrifting ? (
                <span className="text-[#ff6644] tracking-[0.4em]">↻ ДРИФТ</span>
              ) : (
                <span className="text-[#666]">Скорость</span>
              )}
            </div>
            <div className="text-3xl sm:text-5xl text-white leading-none tabular-nums">
              {speedKmh}
              <span className="text-[9px] text-[#c41e1e] ml-1.5 align-middle">КМ/Ч</span>
            </div>
          </div>
          {/* Speed bar with segments */}
          <div className="flex flex-col gap-0.5">
            <div className="w-36 sm:w-52 h-4 bg-[#1a1a1a] border border-[#444] overflow-hidden flex">
              {Array.from({ length: 20 }, (_, i) => {
                const segPercent = (i + 1) * 5;
                const filled = speedPercent >= segPercent;
                let segColor = "#4a8c4a";
                if (segPercent > 80) segColor = "#c41e1e";
                else if (segPercent > 55) segColor = "#d4a017";
                if (isBoosting) segColor = "#ffd700";

                return (
                  <div
                    key={i}
                    className="flex-1 transition-colors duration-75"
                    style={{
                      backgroundColor: filled ? segColor : "#111",
                      marginRight: i < 19 ? "1px" : "0",
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[6px] text-[#555] tabular-nums px-0.5">
              <span>0</span>
              <span>110</span>
              <span>220</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM LEFT: Controls ─── */}
      <div className="absolute bottom-5 left-4 z-30 select-none pointer-events-none hidden sm:block animate-fadeIn">
        <div className="bg-black/60 border border-[#2a2a2a] px-3.5 py-2.5">
          <div className="text-[7px] text-[#555] uppercase tracking-[0.3em] mb-2">Управление</div>
          <div className="text-[7px] text-[#999] leading-[1.8]">
            <div>W A S D — Движение</div>
            <div className="text-[#c41e1e]">SPACE — Дрифт</div>
          </div>
        </div>
      </div>
    </>
  );
}
