"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type ControlAction = "forward" | "backward" | "left" | "right" | "drift";

interface TouchControlsProps {
  enabled?: boolean;
}

const ACTION_TO_KEY_EVENT: Record<ControlAction, { key: string; code: string }> = {
  forward: { key: "ArrowUp", code: "ArrowUp" },
  backward: { key: "ArrowDown", code: "ArrowDown" },
  left: { key: "ArrowLeft", code: "ArrowLeft" },
  right: { key: "ArrowRight", code: "ArrowRight" },
  drift: { key: " ", code: "Space" },
};

function dispatchKeyboard(action: ControlAction, type: "keydown" | "keyup") {
  const keyEvent = ACTION_TO_KEY_EVENT[action];
  const event = new KeyboardEvent(type, {
    key: keyEvent.key,
    code: keyEvent.code,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

export function TouchControls({ enabled = false }: TouchControlsProps) {
  const pressedActionsRef = useRef<Set<ControlAction>>(new Set());
  const [pressedActions, setPressedActions] = useState<Set<ControlAction>>(new Set());

  useEffect(() => {
    if (!enabled) return;

    const releaseAll = () => {
      pressedActionsRef.current.forEach((action) => dispatchKeyboard(action, "keyup"));
      pressedActionsRef.current.clear();
      setPressedActions(new Set());
    };

    const handleVisibilityChange = () => {
      if (document.hidden) releaseAll();
    };

    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      releaseAll();
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled]);

  if (!enabled) return null;

  const press = (action: ControlAction) => {
    if (pressedActionsRef.current.has(action)) return;
    pressedActionsRef.current.add(action);
    dispatchKeyboard(action, "keydown");
    setPressedActions(new Set(pressedActionsRef.current));
  };

  const release = (action: ControlAction) => {
    if (!pressedActionsRef.current.has(action)) return;
    pressedActionsRef.current.delete(action);
    dispatchKeyboard(action, "keyup");
    setPressedActions(new Set(pressedActionsRef.current));
  };

  const bindControl = (action: ControlAction) => ({
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      press(action);
    },
    onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      release(action);
    },
    onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      release(action);
    },
    onPointerLeave: () => {
      release(action);
    },
  });

  const baseButtonClass =
    "w-14 h-14 rounded-xl border text-white text-lg font-bold select-none touch-none " +
    "active:scale-95 transition-transform duration-75";

  return (
    <div className="absolute inset-0 z-50 pointer-events-none sm:hidden">
      <div className="absolute left-4 bottom-4 pointer-events-auto grid grid-cols-3 grid-rows-3 gap-2">
        <div />
        <button
          type="button"
          className={`${baseButtonClass} ${
            pressedActions.has("forward")
              ? "bg-[#c41e1e] border-[#ff9d9d]"
              : "bg-black/70 border-[#444]"
          }`}
          {...bindControl("forward")}
        >
          ^
        </button>
        <div />
        <button
          type="button"
          className={`${baseButtonClass} ${
            pressedActions.has("left")
              ? "bg-[#c41e1e] border-[#ff9d9d]"
              : "bg-black/70 border-[#444]"
          }`}
          {...bindControl("left")}
        >
          {"<"}
        </button>
        <div />
        <button
          type="button"
          className={`${baseButtonClass} ${
            pressedActions.has("right")
              ? "bg-[#c41e1e] border-[#ff9d9d]"
              : "bg-black/70 border-[#444]"
          }`}
          {...bindControl("right")}
        >
          {">"}
        </button>
        <div />
        <button
          type="button"
          className={`${baseButtonClass} ${
            pressedActions.has("backward")
              ? "bg-[#c41e1e] border-[#ff9d9d]"
              : "bg-black/70 border-[#444]"
          }`}
          {...bindControl("backward")}
        >
          v
        </button>
        <div />
      </div>

      <div className="absolute right-4 bottom-6 pointer-events-auto flex items-end gap-3">
        <button
          type="button"
          className={`w-20 h-20 rounded-full border text-xs font-bold tracking-[0.2em] text-white select-none touch-none active:scale-95 transition-transform duration-75 ${
            pressedActions.has("drift")
              ? "bg-[#d4a017] border-[#ffe39d]"
              : "bg-black/70 border-[#444]"
          }`}
          {...bindControl("drift")}
        >
          DRIFT
        </button>
      </div>
    </div>
  );
}
