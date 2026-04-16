import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createRoom, joinRoom, leaveRoom, getRoomBySocket } from './rooms.js';
import { startTimer, STATIONS, TOTAL_TIME } from './timer.js';
import { createGameState } from './gameState.js';
import {
  validatePuzzleAction,
  getCar1Hints,
  getCar2Hints,
  handleCar1Disconnect,
  handleCar2Disconnect,
} from './validation.js';

// Car bounds for movement validation (must match client/src/train.js)
const CAR_HALF_WIDTH = 1.3;
const CAR_HALF_LENGTH = 9;
const PLAYER_RADIUS = 0.25;
const SEAT_DEPTH = 0.44;
const MOVE_BOUNDS = {
  minX: -(CAR_HALF_WIDTH - PLAYER_RADIUS - SEAT_DEPTH),
  maxX: CAR_HALF_WIDTH - PLAYER_RADIUS - SEAT_DEPTH,
  minZ: -(CAR_HALF_LENGTH - PLAYER_RADIUS),
  maxZ: CAR_HALF_LENGTH - PLAYER_RADIUS,
  minY: 0.5,
  maxY: 2.5,
};

// Simple per-socket rate limiter
function createRateLimiter() {
  const buckets = new Map();
  return {
    check(socketId, event, maxPerWindow, windowMs = 1000) {
      const key = `${socketId}:${event}`;
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || now - bucket.start > windowMs) {
        bucket = { start: now, count: 0 };
        buckets.set(key, bucket);
      }
      bucket.count++;
      return bucket.count <= maxPerWindow;
    },
    remove(socketId) {
      for (const key of buckets.keys()) {
        if (key.startsWith(`${socketId}:`)) buckets.delete(key);
      }
    },
  };
}
const rateLimiter = createRateLimiter();

const app = express();
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: allowedOrigin }));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: allowedOrigin } });

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-room', ({ username }) => {
    if (!rateLimiter.check(socket.id, 'create-room', 3, 10000)) {
      socket.emit('err', { message: 'Too many requests, slow down' });
      return;
    }
    if (typeof username !== 'string') {
      socket.emit('err', { message: 'Invalid username' });
      return;
    }
    const trimmedName = username.trim();
    if (trimmedName.length === 0 || trimmedName.length > 16) {
      socket.emit('err', { message: 'Invalid username' });
      return;
    }
    if (getRoomBySocket(socket.id)) {
      socket.emit('err', { message: 'Already in a room' });
      return;
    }
    const room = createRoom(socket.id, trimmedName);
    socket.join(room.code);
    socket.emit('room-created', {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
    });
    console.log(`Room ${room.code} created by ${username}`);
  });

  socket.on('join-room', ({ code, username }) => {
    if (typeof username !== 'string') {
      socket.emit('err', { message: 'Invalid username' });
      return;
    }
    const trimmedJoinName = username.trim();
    if (trimmedJoinName.length === 0 || trimmedJoinName.length > 16) {
      socket.emit('err', { message: 'Invalid username' });
      return;
    }
    if (typeof code !== 'string' || code.length !== 4) {
      socket.emit('err', { message: 'Invalid room code' });
      return;
    }
    if (getRoomBySocket(socket.id)) {
      socket.emit('err', { message: 'Already in a room' });
      return;
    }
    const result = joinRoom(code, socket.id, trimmedJoinName);
    if (result.error) {
      socket.emit('err', { message: result.error });
      return;
    }
    const { room, player } = result;
    socket.join(room.code);

    socket.emit('room-joined', {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
    });

    socket.to(room.code).emit('player-joined', { player });
    console.log(`${username} joined room ${room.code}`);
  });

  socket.on('start-game', () => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.hostId !== socket.id || room.state !== 'waiting') return;
    if (room.players.length < 1) return;

    room.state = 'playing';
    room.seed = Math.floor(Math.random() * 2147483647);
    room.soloMode = room.players.length === 1;
    room.gameState = createGameState(room.seed, { soloMode: room.soloMode });

    startTimer(room, io);

    io.to(room.code).emit('game-started', {
      players: room.players,
      soloMode: room.soloMode,
      timerState: {
        totalTime: TOTAL_TIME,
        stations: STATIONS,
        elapsed: 0,
        stationIndex: 0,
      },
      puzzleLayout: room.gameState.puzzleLayout,
    });
    console.log(`Game started in room ${room.code}`);
  });

  socket.on('player-move', ({ position, rotation }) => {
    if (!rateLimiter.check(socket.id, 'move', 20)) return;
    const room = getRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    if (!position || !rotation) return;
    const px = Number(position.x), py = Number(position.y), pz = Number(position.z);
    const ry = Number(rotation.y);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) || !Number.isFinite(ry)) return;
    // Clamp to car bounds (reject teleport hacks)
    const cx = Math.max(MOVE_BOUNDS.minX, Math.min(MOVE_BOUNDS.maxX, px));
    const cy = Math.max(MOVE_BOUNDS.minY, Math.min(MOVE_BOUNDS.maxY, py));
    const cz = Math.max(MOVE_BOUNDS.minZ, Math.min(MOVE_BOUNDS.maxZ, pz));
    socket.to(room.code).emit('player-moved', {
      socketId: socket.id,
      position: { x: cx, y: cy, z: cz },
      rotation: { y: ry },
    });
  });

  // --- Puzzle actions ---
  socket.on('puzzle-action', (action) => {
    if (!rateLimiter.check(socket.id, 'puzzle', 5)) return;
    const room = getRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    if (!action || typeof action.type !== 'string') return;

    const result = validatePuzzleAction(room, action, socket.id);
    if (!result.valid) {
      socket.emit('puzzle-error', { message: result.reason });
      return;
    }

    for (const evt of result.events) {
      const target = evt.to;
      const { to: _, ...payload } = evt; // strip 'to' from payload
      if (target) {
        io.to(target).emit('puzzle-update', { car: action.car || 1, ...payload });
      } else {
        io.to(room.code).emit('puzzle-update', { car: action.car || 1, ...payload });
      }
    }
  });

  // --- Hint system ---
  socket.on('hint-request', ({ car }) => {
    if (!rateLimiter.check(socket.id, 'hint', 3, 5000)) return;
    const carNum = Number(car);
    if (!Number.isInteger(carNum) || carNum < 1 || carNum > 8) return;

    const room = getRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;

    const gs = room.gameState;

    // Only allow hints for the current car
    if (carNum !== gs.currentCar) {
      socket.emit('hint-response', { car: carNum, tier: 0, text: 'Hints only available for the current car.' });
      return;
    }

    const carKey = `car${carNum}`;
    const currentTier = (gs.hintsUsed[carKey] || 0) + 1;
    if (currentTier > 3) {
      socket.emit('hint-response', { car: carNum, tier: 0, text: 'No more hints available for this car.' });
      return;
    }

    let hintText = null;
    if (carNum === 1) {
      hintText = getCar1Hints(gs.puzzleConfigs.car1, gs.carStates.car1, currentTier, gs.soloMode);
    } else if (carNum === 2) {
      hintText = getCar2Hints(gs.puzzleConfigs.car2, gs.carStates.car2, currentTier, gs.soloMode);
    }
    if (!hintText) return;

    const penalties = [30, 60, 120];
    const penaltySeconds = penalties[currentTier - 1];
    gs.hintsUsed[carKey] = currentTier;
    gs.totalHintPenalty = (gs.totalHintPenalty || 0) + penaltySeconds;

    io.to(room.code).emit('hint-response', {
      car: carNum,
      tier: currentTier,
      text: hintText,
      penalty: penaltySeconds,
    });
  });

  socket.on('disconnect', () => {
    rateLimiter.remove(socket.id);
    const room = getRoomBySocket(socket.id);
    // Clean up puzzle state for disconnected player
    if (room && room.gameState) {
      handleCar1Disconnect(room, socket.id, io, room.code);
      handleCar2Disconnect(room, socket.id, io, room.code);
    }

    const result = leaveRoom(socket.id);
    if (!result) return;
    const { code, room: updatedRoom, wasHost } = result;
    if (!updatedRoom) return;
    io.to(code).emit('player-left', { socketId: socket.id });
    if (wasHost) {
      io.to(code).emit('host-changed', { hostId: updatedRoom.hostId });
    }
    console.log(`${socket.id} left room ${code}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
