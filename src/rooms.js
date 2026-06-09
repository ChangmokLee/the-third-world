// In-memory room store. Good enough for a single-server MVP.
// For production scale you'd move this to Redis, but this keeps things simple.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS = 8;

// Character classes available to each alignment. Players in the same game get
// unique classes where possible (we only repeat once a side's pool runs out).
const CLASSES = {
  good: [
    { id: 'emperor-knight', name: 'Knight of the Emperor' },
    { id: 'inquisitor', name: 'Inquisitor' },
    { id: 'court-wizard', name: 'Court Wizard' },
  ],
  evil: [
    { id: 'fallen-knight', name: 'Fallen Knight' },
    { id: 'succubus', name: 'Succubus' },
  ],
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Hand out unique classes for one alignment. If there are more players than
// available classes, the pool reshuffles and repeats (kept minimal).
function dealClasses(players, pool) {
  let bag = [];
  players.forEach((p) => {
    if (bag.length === 0) bag = shuffle([...pool]);
    p.charClass = bag.pop();
  });
}

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
      role: null, // 'good' | 'evil' — assigned secretly when the game starts
      charClass: null, // { id, name } — character class, assigned with the role
      roleAck: false, // has the player confirmed (seen) their role?
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

  // Secretly assign a good/evil alignment to every player in the room, then
  // hand each player a unique character class for their side. Returns the room.
  function assignRoles(room) {
    const players = [...room.players.values()];
    const n = players.length;
    let evilCount = Math.floor(n / 3);
    if (n >= 3 && evilCount < 1) evilCount = 1;
    if (evilCount >= n) evilCount = Math.max(0, n - 1); // never all-evil

    // Shuffle, then mark the first `evilCount` as evil.
    shuffle(players);
    players.forEach((p, i) => {
      p.role = i < evilCount ? 'evil' : 'good';
    });

    // Deal classes per side so nobody in the same game overlaps (when possible).
    const goodPlayers = players.filter((p) => p.role === 'good');
    const evilPlayers = players.filter((p) => p.role === 'evil');
    dealClasses(goodPlayers, CLASSES.good);
    dealClasses(evilPlayers, CLASSES.evil);
    return room;
  }

  function roleCounts(room) {
    let good = 0;
    let evil = 0;
    for (const p of room.players.values()) {
      if (p.role === 'evil') evil++;
      else if (p.role === 'good') good++;
    }
    return { good, evil };
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
    assignRoles,
    roleCounts,
    publicState,
    MAX_PLAYERS,
  };
}
