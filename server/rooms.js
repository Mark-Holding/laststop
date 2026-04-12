const rooms = new Map();

const PLAYER_COLORS = ['#4488ff', '#ff4444', '#44cc44', '#ffaa22'];

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

export function createRoom(hostSocketId, username) {
  const code = generateCode();
  const room = {
    code,
    hostId: hostSocketId,
    state: 'waiting',
    players: [{ socketId: hostSocketId, username, color: PLAYER_COLORS[0], index: 0 }],
    seed: null,
    timerInterval: null,
    timerState: null,
    gameState: null,
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(code, socketId, username) {
  const room = rooms.get(code.toUpperCase());
  if (!room) return { error: 'Room not found' };
  if (room.state !== 'waiting') return { error: 'Game already started' };
  if (room.players.length >= 4) return { error: 'Room is full (max 4)' };
  if (room.players.some(p => p.socketId === socketId)) return { error: 'Already in room' };

  const index = room.players.length;
  const player = { socketId, username, color: PLAYER_COLORS[index], index };
  room.players.push(player);
  return { room, player };
}

export function leaveRoom(socketId) {
  for (const [code, room] of rooms) {
    const idx = room.players.findIndex(p => p.socketId === socketId);
    if (idx === -1) continue;

    room.players.splice(idx, 1);

    if (room.players.length === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      rooms.delete(code);
      return { code, room: null, wasHost: true };
    }

    const wasHost = room.hostId === socketId;
    if (wasHost) room.hostId = room.players[0].socketId;

    return { code, room, wasHost };
  }
  return null;
}

export function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    if (room.players.some(p => p.socketId === socketId)) return room;
  }
  return null;
}
