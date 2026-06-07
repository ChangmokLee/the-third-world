// In-memory room store. Good enough for a single-server MVP.
// For production scale you'd move this to Redis, but this keeps things simple.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS = 8;

function randomCode() {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
}

export function createRoomStore() {
  /** @type {Map<string, Room>} */
  const rooms = new Map();

  function createRoom(hostSocketId, hostUser) {
    let code = randomCode();
    while (rooms.has(code)) code = randomCode();

    const room = {
      code,
      hostSocketId,
      hostUser: hostUser ?? null,
      phase: 'lobby', // lobby | playing | results
      players: new Map(), // socketId -> player
      createdAt: Date.now(),
    };
    rooms.set(code, room);
    return room;
  }

  function getRoom(code) {
    return rooms.get((code || '').toUpperCase());
  }

  function addPlayer(code, socketId, name) {
    const room = getRoom(code);
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.players.size >= MAX_PLAYERS) return { error: 'ROOM_FULL' };

    const trimmed = (name || '').trim().slice(0, 16);
    if (!trimmed) return { error: 'NAME_REQUIRED' };

    const player = {
      id: socketId,
      name: trimmed,
      connected: true,
      choice: null,
    };
    room.players.set(socketId, player);
    return { room, player };
  }

  function removePlayer(socketId) {
    for (const room of rooms.values()) {
      if (room.players.has(socketId)) {
        room.players.delete(socketId);
        return room;
      }
    }
    return null;
  }

  function removeRoomByHost(socketId) {
    for (const [code, room] of rooms.entries()) {
      if (room.hostSocketId === socketId) {
        rooms.delete(code);
        return room;
      }
    }
    return null;
  }

  function publicState(room) {
    return {
      code: room.code,
      phase: room.phase,
      players: [...room.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        hasChosen: p.choice !== null,
      })),
    };
  }

  return {
    rooms,
    createRoom,
    getRoom,
    addPlayer,
    removePlayer,
    removeRoomByHost,
    publicState,
    MAX_PLAYERS,
  };
}
