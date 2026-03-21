"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;

function resolveSocketUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const explicitUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl.trim();
  }

  return window.location.origin;
}

export function getSocketUrl(): string {
  return resolveSocketUrl();
}

async function wakeSocketHost(socketUrl: string): Promise<void> {
  if (!socketUrl || typeof window === "undefined") return;

  const sameOrigin = socketUrl === window.location.origin;
  if (sameOrigin) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(`${socketUrl.replace(/\/+$/, "")}/healthz`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    // Ignore wake-up failures; actual socket connect may still succeed.
  } finally {
    clearTimeout(timeout);
  }
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 700,
      reconnectionDelayMax: 4000,
      timeout: 15000,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

function waitForSocketConnect(s: Socket, timeoutMs: number): Promise<Socket> {
  if (s.connected) return Promise.resolve(s);

  return new Promise<Socket>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Socket connection timeout"));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve(s);
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const cleanup = () => {
      clearTimeout(timer);
      s.off("connect", onConnect);
      s.off("connect_error", onError);
    };

    s.on("connect", onConnect);
    s.on("connect_error", onError);
  });
}

export async function ensureSocketConnected(
  timeoutMs = 12000,
  retries = 3
): Promise<Socket> {
  const s = getSocket();
  if (s.connected) return s;

  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    await wakeSocketHost(getSocketUrl());

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        if (!s.connected) {
          s.connect();
        }
        await waitForSocketConnect(s, timeoutMs);
        return s;
      } catch (error) {
        lastError =
          error instanceof Error ? error : new Error("Socket connection failed");

        if (attempt < retries - 1) {
          const backoffMs = 700 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError ?? new Error("Socket connection failed");
  })();

  try {
    return await connectPromise;
  } finally {
    connectPromise = null;
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    connectPromise = null;
  }
}
