"use client";

import { useState, useEffect, useCallback } from "react";

interface CountdownProps {
  onComplete: () => void;
}

export function Countdown({ onComplete }: CountdownProps) {
  const [count, setCount] = useState(3);
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (count > 0) {
      const timer = setTimeout(() => setCount(count - 1), 1000);
      return () => clearTimeout(timer);
    } else if (count === 0) {
      const timer = setTimeout(() => {
        setShow(false);
        onComplete();
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [count, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        {count > 0 ? (
          <div key={count} className="animate-countPop">
            <div className="text-[10rem] sm:text-[16rem] leading-none text-[#c41e1e] drop-shadow-[0_0_60px_rgba(196,30,30,0.6)]">
              {count}
            </div>
            <div className="text-sm text-[#888] uppercase tracking-[0.5em] mt-2">
              Приготовьтесь
            </div>
          </div>
        ) : (
          <div className="animate-countPop">
            <div className="text-6xl sm:text-9xl text-[#d4a017] drop-shadow-[0_0_60px_rgba(212,160,23,0.6)] uppercase tracking-[0.3em]">
              Старт!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
