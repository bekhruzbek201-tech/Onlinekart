/* eslint-disable @typescript-eslint/no-require-imports */
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const SPAWN_POSITIONS = [
  [48, 1.5, 44],
  [52, 1.5, 44],
  [48, 1.5, 48],
  [52, 1.5, 48],
  [46, 1.5, 44],
  [54, 1.5, 44],
];

const KART_COLORS = ["#8b1a1a", "#1a5c8b", "#1a8b3d", "#8b6c1a", "#6b1a8b", "#1a8b8b"];
const MAX_ROOM_PLAYERS = 6;

function parseAllowedOrigins() {
  const raw = process.env.SOCKET_CORS_ORIGINS;
  if (!raw || !raw.trim()) return "*";

  const list = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return list.length > 0 ? list : "*";
}

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

function normalizeName(input) {
  const fallback = "Pilot";
  const name = String(input || "").trim();
  if (!name) return fallback;
  return name.slice(0, 20);
}

app.prepare().then(() => {
  const allowedOrigins = parseAllowedOrigins();

  const server = createServer((req, res) => {
    if (req.url && req.url.startsWith("/healthz")) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: true, now: Date.now() }));
      return;
    }

    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 20000,
  });

  const rooms = new Map();

  const removePlayerFromRoom = (socket) => {
    if (!socket.roomCode) return;

    const roomCode = socket.roomCode;
    const room = rooms.get(roomCode);
    if (!room) {
      delete socket.roomCode;
      return;
    }

    room.players = room.players.filter((player) => player.id !== socket.id);
    socket.leave(roomCode);

    if (room.players.length === 0) {
      rooms.delete(roomCode);
      console.log(`[ROOM] Deleted empty room ${roomCode}`);
    } else {
      if (room.host === socket.id) {
        room.host = room.players[0].id;
      }
      io.to(roomCode).emit("room-update", room);
      console.log(
        `[ROOM] Player left ${roomCode}. Remaining players: ${room.players.length}`
      );
    }

    delete socket.roomCode;
  };

  io.on("connection", (socket) => {
    console.log(`[SOCKET] Connected: ${socket.id}`);

    socket.on("create-room", (payload = {}, ack) => {
      const { playerName, avatarUrl } = payload;
      removePlayerFromRoom(socket);

      const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
      const player = {
        id: socket.id,
        name: normalizeName(playerName),
        avatarUrl,
        position: SPAWN_POSITIONS[0],
        rotation: [0, 0, 0, 1],
        speed: 0,
        color: KART_COLORS[0],
        lap: 0,
        finished: false,
      };

      rooms.set(roomCode, {
        players: [player],
        state: "waiting",
        host: socket.id,
        raceStartTime: null,
        totalLaps: 3,
      });

      socket.join(roomCode);
      socket.roomCode = roomCode;

      const room = rooms.get(roomCode);
      socket.emit("room-created", { roomCode, player, room });
      safeAck(ack, { ok: true, roomCode });
      console.log(`[ROOM] Created ${roomCode} by ${player.name}`);
    });

    socket.on("join-room", (payload = {}, ack) => {
      const { roomCode: incomingRoomCode, playerName, avatarUrl } = payload;
      removePlayerFromRoom(socket);

      const roomCode = String(incomingRoomCode || "").trim().toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        socket.emit("join-error", "Room not found");
        safeAck(ack, { ok: false, code: "ROOM_NOT_FOUND" });
        return;
      }

      if (room.players.length >= MAX_ROOM_PLAYERS) {
        socket.emit("join-error", "Room is full");
        safeAck(ack, { ok: false, code: "ROOM_FULL" });
        return;
      }

      if (room.state !== "waiting") {
        socket.emit("join-error", "Race already started");
        safeAck(ack, { ok: false, code: "RACE_STARTED" });
        return;
      }

      const idx = room.players.length;
      const player = {
        id: socket.id,
        name: normalizeName(playerName),
        avatarUrl,
        position: SPAWN_POSITIONS[idx] || SPAWN_POSITIONS[0],
        rotation: [0, 0, 0, 1],
        speed: 0,
        color: KART_COLORS[idx] || KART_COLORS[0],
        lap: 0,
        finished: false,
      };

      room.players.push(player);
      socket.join(roomCode);
      socket.roomCode = roomCode;

      socket.emit("joined-room", { roomCode, player, room });
      io.to(roomCode).emit("room-update", room);
      safeAck(ack, { ok: true, roomCode });
      console.log(`[ROOM] ${player.name} joined ${roomCode} (${room.players.length} players)`);
    });

    socket.on("start-race", (_payload, ack) => {
      if (!socket.roomCode) {
        safeAck(ack, { ok: false, code: "NO_ROOM" });
        return;
      }

      const room = rooms.get(socket.roomCode);
      if (!room || room.host !== socket.id) {
        safeAck(ack, { ok: false, code: "NOT_HOST" });
        return;
      }

      if (room.players.length < 2) {
        safeAck(ack, { ok: false, code: "NOT_ENOUGH_PLAYERS" });
        return;
      }

      room.state = "countdown";
      io.to(socket.roomCode).emit("race-countdown");
      safeAck(ack, { ok: true });
      console.log(`[RACE] Countdown started in ${socket.roomCode}`);

      setTimeout(() => {
        room.state = "racing";
        room.raceStartTime = Date.now();
        io.to(socket.roomCode).emit("race-start", { startTime: room.raceStartTime });
        console.log(`[RACE] Started in ${socket.roomCode}`);
      }, 4000);
    });

    socket.on("player-update", (data) => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      const player = room.players.find((item) => item.id === socket.id);
      if (!player) return;

      player.position = data.position;
      player.rotation = data.rotation;
      player.speed = data.speed;
      player.lap = data.lap || 0;

      socket.to(socket.roomCode).emit("players-state", room.players);
    });

    socket.on("player-finished", ({ time }) => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      const player = room.players.find((item) => item.id === socket.id);
      if (player) {
        player.finished = true;
        player.finishTime = time;
      }

      io.to(socket.roomCode).emit("player-finish", {
        playerId: socket.id,
        name: player?.name,
        time,
      });

      if (room.players.every((item) => item.finished)) {
        room.state = "finished";
        const results = [...room.players]
          .filter((item) => item.finishTime)
          .sort((a, b) => a.finishTime - b.finishTime);
        io.to(socket.roomCode).emit("race-results", results);
      }
    });

    socket.on("leave-room", (_payload, ack) => {
      removePlayerFromRoom(socket);
      safeAck(ack, { ok: true });
    });

    socket.on("quick-join", (payload = {}, ack) => {
      const { playerName, avatarUrl } = payload;
      removePlayerFromRoom(socket);

      // Find an available room that is in waiting state and not full
      let foundRoomCode = null;
      for (const [code, r] of rooms.entries()) {
        if (r.state === "waiting" && r.players.length < MAX_ROOM_PLAYERS) {
          foundRoomCode = code;
          break;
        }
      }

      if (foundRoomCode) {
        // Use existing join logic
        const room = rooms.get(foundRoomCode);
        const idx = room.players.length;
        const player = {
          id: socket.id,
          name: normalizeName(playerName),
          avatarUrl,
          position: SPAWN_POSITIONS[idx] || SPAWN_POSITIONS[0],
          rotation: [0, 0, 0, 1],
          speed: 0,
          color: KART_COLORS[idx] || KART_COLORS[0],
          lap: 0,
          finished: false,
        };

        room.players.push(player);
        socket.join(foundRoomCode);
        socket.roomCode = foundRoomCode;

        socket.emit("joined-room", { roomCode: foundRoomCode, player, room });
        io.to(foundRoomCode).emit("room-update", room);
        safeAck(ack, { ok: true, roomCode: foundRoomCode });
        console.log(`[ROOM] ${player.name} quick-joined ${foundRoomCode}`);
      } else {
        // Create a new room if none found
        const roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        const player = {
          id: socket.id,
          name: normalizeName(playerName),
          avatarUrl,
          position: SPAWN_POSITIONS[0],
          rotation: [0, 0, 0, 1],
          speed: 0,
          color: KART_COLORS[0],
          lap: 0,
          finished: false,
        };

        rooms.set(roomCode, {
          players: [player],
          state: "waiting",
          host: socket.id,
          raceStartTime: null,
          totalLaps: 3,
        });

        socket.join(roomCode);
        socket.roomCode = roomCode;

        const room = rooms.get(roomCode);
        socket.emit("room-created", { roomCode, player, room });
        safeAck(ack, { ok: true, roomCode });
        console.log(`[ROOM] Quick join created ${roomCode} for ${player.name}`);
      }
    });

    socket.on("disconnect", () => {
      removePlayerFromRoom(socket);
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[SERVER] Ready on port ${PORT}`);
    console.log(`[SERVER] CORS origins: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(",") : "*"}`);
  });
});
