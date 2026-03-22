"use client";

export function KartShowcase({ color = "#8b1a1a" }: { color?: string }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
      {/* Lightweight CSS-only background instead of heavy 3D Canvas */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `
            radial-gradient(ellipse at 50% 60%, ${color}22 0%, transparent 50%),
            radial-gradient(ellipse at 30% 40%, ${color}11 0%, transparent 40%),
            radial-gradient(ellipse at 70% 30%, ${color}11 0%, transparent 40%),
            linear-gradient(180deg, transparent 0%, #0d0d0d 100%)
          `,
        }}
      />
      {/* Animated grid lines for retro feel */}
      <div 
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(${color}33 1px, transparent 1px),
            linear-gradient(90deg, ${color}33 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          animation: 'gridScroll 20s linear infinite',
        }} 
      />
      {/* Glowing orb effect */}
      <div
        className="absolute w-64 h-64 rounded-full opacity-10 animate-pulse"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  );
}
