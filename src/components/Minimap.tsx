"use client";

interface MinimapProps {
  kartX: number;
  kartZ: number;
  kartRotation: number;
  opponents?: { x: number; z: number; color: string }[];
}

export function Minimap({ kartX, kartZ, kartRotation, opponents = [] }: MinimapProps) {
  const scale = 0.55;
  const offsetX = 75;
  const offsetZ = 75;

  const toMapX = (x: number) => (x + offsetX) * scale;
  const toMapY = (z: number) => (z + offsetZ) * scale;

  return (
    <div className="absolute bottom-4 right-4 z-30 select-none pointer-events-none hidden sm:block">
      <div className="bg-black/80 border border-[#333] p-2 shadow-[4px_4px_0px_#000]">
        <div className="text-[7px] text-[#666] uppercase tracking-widest mb-1 text-center">Карта</div>
        <svg width="82" height="82" viewBox="0 0 82 82" className="block">
          {/* Track outline */}
          {/* Right straight */}
          <rect x={toMapX(40)} y={toMapY(-60)} width={20 * scale} height={120 * scale} fill="#333" rx="1" />
          {/* Left straight */}
          <rect x={toMapX(-60)} y={toMapY(-60)} width={20 * scale} height={120 * scale} fill="#333" rx="1" />
          {/* Top connector */}
          <rect x={toMapX(-60)} y={toMapY(-70)} width={120 * scale} height={20 * scale} fill="#333" rx="1" />
          {/* Bottom connector */}
          <rect x={toMapX(-60)} y={toMapY(50)} width={120 * scale} height={20 * scale} fill="#333" rx="1" />

          {/* Start/finish */}
          <line x1={toMapX(40)} y1={toMapY(40)} x2={toMapX(60)} y2={toMapY(40)} stroke="#c41e1e" strokeWidth="2" />

          {/* Central monument */}
          <rect x={toMapX(-4)} y={toMapY(-4)} width={8 * scale} height={8 * scale} fill="#c41e1e" rx="1" />

          {/* Opponents */}
          {opponents.map((op, i) => (
            <circle key={i} cx={toMapX(op.x)} cy={toMapY(op.z)} r="2.5" fill={op.color} stroke="#000" strokeWidth="0.5" />
          ))}

          {/* Player kart */}
          <circle cx={toMapX(kartX)} cy={toMapY(kartZ)} r="3" fill="#ffffff" stroke="#c41e1e" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}
