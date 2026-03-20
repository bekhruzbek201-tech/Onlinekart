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

const KART_COLORS = [
  "#8b1a1a", "#1a5c8b", "#1a8b3d", "#8b6c1a", "#6b1a8b", "#1a8b8b"
];

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 2000,
    pingTimeout: 5000,
  });

  const rooms = new Map();

  io.on("connection", (socket) => {
    console.log(`[СОЮЗ] Player connected: ${socket.id}`);

    socket.on("create-room", (playerName) => {
      const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const player = {
        id: socket.id,
        name: playerName || "Товарищ",
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
      socket.emit("room-created", { roomCode, player, room: rooms.get(roomCode) });
      console.log(`[СОЮЗ] Room ${roomCode} created by ${playerName}`);
    });

    socket.on("join-room", ({ roomCode, playerName }) => {
      const code = roomCode.toUpperCase();
      const room = rooms.get(code);

      if (!room) {
        socket.emit("join-error", "Комната не найдена");
        return;
      }
      if (room.players.length >= 6) {
        socket.emit("join-error", "Комната заполнена");
        return;
      }
      if (room.state !== "waiting") {
        socket.emit("join-error", "Гонка уже началась");
        return;
      }

      const idx = room.players.length;
      const player = {
        id: socket.id,
        name: playerName || "Товарищ",
        position: SPAWN_POSITIONS[idx] || SPAWN_POSITIONS[0],
        rotation: [0, 0, 0, 1],
        speed: 0,
        color: KART_COLORS[idx] || KART_COLORS[0],
        lap: 0,
        finished: false,
      };

      room.players.push(player);
      socket.join(code);
      socket.roomCode = code;

      socket.emit("joined-room", { roomCode: code, player, room });
      io.to(code).emit("room-update", room);
      console.log(`[СОЮЗ] ${playerName} joined room ${code} (${room.players.length} players)`);
    });

    socket.on("start-race", () => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room || room.host !== socket.id) return;

      room.state = "countdown";
      io.to(socket.roomCode).emit("race-countdown");
      console.log(`[СОЮЗ] Race countdown in room ${socket.roomCode}`);

      // 3-2-1-GO countdown
      setTimeout(() => {
        room.state = "racing";
        room.raceStartTime = Date.now();
        io.to(socket.roomCode).emit("race-start", { startTime: room.raceStartTime });
        console.log(`[СОЮЗ] Race started in room ${socket.roomCode}!`);
      }, 4000);
    });

    socket.on("player-update", (data) => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
        player.speed = data.speed;
        player.lap = data.lap || 0;
      }

      // Broadcast to OTHER players only
      socket.to(socket.roomCode).emit("players-state", room.players);
    });

    socket.on("player-finished", ({ time }) => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (player) {
        player.finished = true;
        player.finishTime = time;
      }

      io.to(socket.roomCode).emit("player-finish", { playerId: socket.id, name: player?.name, time });

      // Check if all finished
      if (room.players.every((p) => p.finished)) {
        room.state = "finished";
        const results = [...room.players]
          .filter((p) => p.finishTime)
          .sort((a, b) => a.finishTime - b.finishTime);
        io.to(socket.roomCode).emit("race-results", results);
      }
    });

    socket.on("disconnect", () => {
      if (!socket.roomCode) return;
      const room = rooms.get(socket.roomCode);
      if (!room) return;

      room.players = room.players.filter((p) => p.id !== socket.id);
      console.log(`[СОЮЗ] Player disconnected from room ${socket.roomCode} (${room.players.length} remaining)`);

      if (room.players.length === 0) {
        rooms.delete(socket.roomCode);
        console.log(`[СОЮЗ] Room ${socket.roomCode} deleted (empty)`);
      } else {
        if (room.host === socket.id) {
          room.host = room.players[0].id;
        }
        io.to(socket.roomCode).emit("room-update", room);
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`\n  ╔══════════════════════════════════════╗`);
    console.log(`  ║   СОЮЗ КАРТ — Soviet Kart Racing     ║`);
    console.log(`  ║   Server ready on port ${PORT}           ║`);
    console.log(`  ║   http://localhost:${PORT}               ║`);
    console.log(`  ╚══════════════════════════════════════╝\n`);
  });
});
