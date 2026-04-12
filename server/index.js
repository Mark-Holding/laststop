import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createRoom, joinRoom, leaveRoom, getRoomBySocket } from './rooms.js';
import { startTimer, STATIONS, TOTAL_TIME } from './timer.js';
import { createGameState } from './gameState.js';
import { validatePuzzleAction, getCar1Hints, handleCar1Disconnect } from './validation.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('create-room', ({ username }) => {
    if (typeof username !== 'string' || username.trim().length === 0 || username.length > 16) {
      socket.emit('err', { message: 'Invalid username' });
      return;
    }
    if (getRoomBySocket(socket.id)) {
      socket.emit('err', { message: 'Already in a room' });
      return;
    }
    const room = createRoom(socket.id, username.trim());
    socket.join(room.code);
    socket.emit('room-created', {
      code: room.code,
      players: room.players,
      hostId: room.hostId,
    });
    console.log(`Room ${room.code} created by ${username}`);
  });

  socket.on('join-room', ({ code, username }) => {
    if (typeof username !== 'string' || username.trim().length === 0 || username.length > 16) {
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
    const result = joinRoom(code, socket.id, username.trim());
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
    if (room.players.length < 2) {
      socket.emit('err', { message: 'Need at least 2 players to start' });
      return;
    }

    room.state = 'playing';
    room.seed = Math.floor(Math.random() * 2147483647);
    room.gameState = createGameState(room.seed);

    startTimer(room, io);

    io.to(room.code).emit('game-started', {
      seed: room.seed,
      players: room.players,
      timerState: {
        totalTime: TOTAL_TIME,
        stations: STATIONS,
        elapsed: 0,
        stationIndex: 0,
      },
      puzzleLayout: room.gameState.puzzleLayout,
    });
    console.log(`Game started in room ${room.code} (seed: ${room.seed})`);
  });

  socket.on('player-move', ({ position, rotation }) => {
    const room = getRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;
    if (!position || !rotation) return;
    const px = Number(position.x), py = Number(position.y), pz = Number(position.z);
    const ry = Number(rotation.y);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz) || !Number.isFinite(ry)) return;
    socket.to(room.code).emit('player-moved', {
      socketId: socket.id,
      position: { x: px, y: py, z: pz },
      rotation: { y: ry },
    });
  });

  // --- Puzzle actions ---
  socket.on('puzzle-action', (action) => {
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
    const carNum = Number(car);
    if (!Number.isInteger(carNum) || carNum < 1 || carNum > 8) return;

    const room = getRoomBySocket(socket.id);
    if (!room || room.state !== 'playing') return;

    const gs = room.gameState;
    const carKey = `car${carNum}`;
    const currentTier = (gs.hintsUsed[carKey] || 0) + 1;
    if (currentTier > 3) {
      socket.emit('hint-response', { car, tier: 0, text: 'No more hints available for this car.' });
      return;
    }

    let hintText = null;
    if (carNum === 1) {
      hintText = getCar1Hints(gs.puzzleConfigs.car1, gs.carStates.car1, currentTier);
    }
    if (!hintText) return;

    const penalties = [30, 60, 120];
    gs.hintsUsed[carKey] = currentTier;

    io.to(room.code).emit('hint-response', {
      car: carNum,
      tier: currentTier,
      text: hintText,
      penalty: penalties[currentTier - 1],
    });
  });

  socket.on('disconnect', () => {
    const room = getRoomBySocket(socket.id);
    // Clean up puzzle state for disconnected player
    if (room && room.gameState) {
      handleCar1Disconnect(room, socket.id, io, room.code);
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
