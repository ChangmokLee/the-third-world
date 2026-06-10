// In-memory room store. Good enough for a single-server MVP.
// For production scale you'd move this to Redis, but this keeps things simple.

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no easily-confused chars
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS = 8;

// Character classes available to each alignment. Special (skilled) classes are
// guaranteed first; any remaining players become plain citizens/cultists.
const CLASSES = {
  good: {
    emperorKnight: { id: 'emperor-knight', name: 'Knight of the Emperor' },
    courtWizard: { id: 'court-wizard', name: 'Court Wizard' },
    inquisitor: { id: 'inquisitor', name: 'Inquisitor' },
    citizen: { id: 'citizen', name: 'Loyal Subject' },
  },
  evil: {
    succubus: { id: 'succubus', name: 'Succubus' },
    fallenKnight: { id: 'fallen-knight', name: 'Fallen Knight' },
    cultist: { id: 'cultist', name: 'Cultist' },
  },
};

const MAX_FALLEN_KNIGHTS = 2;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Build the ordered class pool for one side, sized to `count` players.
// Special roles come first (guaranteed when there are enough players), then the
// remainder are filled with the side's plain class.
function buildGoodPool(count) {
  const pool = [];
  if (count >= 1) pool.push(CLASSES.good.emperorKnight);
  if (count >= 2) pool.push(CLASSES.good.courtWizard);
  if (count >= 3) pool.push(CLASSES.good.inquisitor);
  while (pool.length < count) pool.push(CLASSES.good.citizen);
  return pool.slice(0, count);
}

function buildEvilPool(count, totalPlayers) {
  // Special rule: in a 3-player game the lone evil must be a Fallen Knight
  // (no Succubus, since there is no real day vote to subvert yet).
  if (totalPlayers === 3) {
    const pool = [];
    while (pool.length < count) pool.push(CLASSES.evil.fallenKnight);
    return pool.slice(0, count);
  }

  const pool = [];
  if (count >= 1) pool.push(CLASSES.evil.succubus);
  for (let i = 0; i < MAX_FALLEN_KNIGHTS && pool.length < count; i++) {
    pool.push(CLASSES.evil.fallenKnight);
  }
  while (pool.length < count) pool.push(CLASSES.evil.cultist);
  return pool.slice(0, count);
}

// Hand out classes for one alignment from a pre-sized pool (shuffled so the
// assignment order is random).
function dealClasses(players, pool) {
  const bag = shuffle([...pool]);
  players.forEach((p, i) => {
    p.charClass = bag[i] || pool[pool.length - 1];
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
      alive: true, // killed players become spectators
      nightAction: null, // { type, target } chosen during the current night
      investigateResult: null, // inquisitor's private result for the last night
    };
    room.players.set(socketId, player);
    return { room, player };
  }

  // Dev-only: add a fake "bot" player to a room so a single developer can fill
  // a room and walk through a whole game. Bots have a synthetic id (no socket)
  // and are auto-played by the socket layer.
  function addBot(room, name) {
    if (!room) return { error: 'ROOM_NOT_FOUND' };
    if (room.players.size >= MAX_PLAYERS) return { error: 'ROOM_FULL' };
    let n = 1;
    let id = `bot_${n}`;
    while (room.players.has(id)) id = `bot_${++n}`;
    const player = {
      id,
      name: (name || `Bot ${n}`).slice(0, 16),
      connected: true,
      isBot: true,
      choice: null,
      role: null,
      charClass: null,
      roleAck: false,
      alive: true,
      nightAction: null,
      investigateResult: null,
    };
    room.players.set(id, player);
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
  // hand each player a character class for their side. Returns the room.
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
      p.alive = true;
      p.nightAction = null;
      p.investigateResult = null;
    });

    // Deal classes per side: guaranteed special roles first, then fillers.
    const goodPlayers = players.filter((p) => p.role === 'good');
    const evilPlayers = players.filter((p) => p.role === 'evil');
    dealClasses(goodPlayers, buildGoodPool(goodPlayers.length));
    dealClasses(evilPlayers, buildEvilPool(evilPlayers.length, n));
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
        alive: p.alive,
        hasChosen: p.choice !== null,
      })),
    };
  }

  return {
    rooms,
    createRoom,
    getRoom,
    addPlayer,
    addBot,
    removePlayer,
    removeRoomByHost,
    assignRoles,
    roleCounts,
    publicState,
    MAX_PLAYERS,
  };
}
