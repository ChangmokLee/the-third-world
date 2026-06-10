// Wires up all realtime events between the TV host screen and phone controllers
// for the social-deduction game loop (role reveal -> night -> day -> ...).
import QRCode from 'qrcode';
import {
  startNight,
  submitNightAction,
  solvePuzzle,
  puzzleProgress,
  allPuzzlesSolved,
  playerSolvedAll,
  resolveNight,
  startDay,
  submitVote,
  emperorExecute,
  voteTally,
  allVoted,
  resolveDay,
  checkWin,
  nightActionFor,
} from './game.js';

// Dev tools (bot players, etc.) are only available outside production.
const DEV_TOOLS = process.env.NODE_ENV !== 'production' && process.env.DEV_NO_AUTH !== '0';

function buildJoinUrl(socket, code) {
  const base =
    (process.env.PUBLIC_URL || '').replace(/\/$/, '') ||
    socket.handshake.headers.origin ||
    `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/play?code=${code}`;
}

// Living players other than `selfId`, as { id, name } — the legal targets for
// most night/day abilities.
function targetsExcept(room, selfId) {
  return [...room.players.values()]
    .filter((p) => p.alive && p.id !== selfId)
    .map((p) => ({ id: p.id, name: p.name }));
}

function publicPlayers(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
    charClass: p.alive ? null : p.charClass?.id || null, // reveal class on death
    role: p.alive ? null : p.role, // reveal alignment on death
  }));
}

export function registerSocketHandlers(io, rooms) {
  // -------------------------------------------------------------------------
  // Broadcast the night state: the shared puzzle questions + a private "your
  // secret action" prompt to each living role-player. Each player solves the
  // puzzles independently, so progress is tracked per phone.
  // -------------------------------------------------------------------------
  function broadcastNight(room) {
    const pp = puzzleProgress(room);
    io.to(room.code).emit('game:night', {
      day: room.day,
      players: publicPlayers(room),
      puzzles: room.night.puzzles.map((p) => ({
        id: p.id,
        en: p.en,
        ko: p.ko,
      })),
      progress: pp,
    });

    for (const player of room.players.values()) {
      if (!player.alive) {
        io.to(player.id).emit('game:yourAction', { type: null });
        continue;
      }
      const type = nightActionFor(player.charClass?.id);
      io.to(player.id).emit('game:yourAction', {
        type,
        classId: player.charClass?.id || null,
        targets: type ? targetsExcept(room, player.id) : [],
      });
    }
  }

  function broadcastPuzzleProgress(room) {
    io.to(room.code).emit('game:puzzleUpdate', {
      progress: puzzleProgress(room),
    });
  }

  // -------------------------------------------------------------------------
  // Resolve the night and move into day, OR end the game if someone has won.
  // -------------------------------------------------------------------------
  function endNight(room) {
    const summary = resolveNight(room);

    // Private result for the inquisitor.
    for (const p of room.players.values()) {
      if (p.investigateResult) {
        io.to(p.id).emit('game:info', {
          kind: 'investigate',
          targetName: p.investigateResult.targetName,
          isEvil: p.investigateResult.isEvil,
        });
      }
    }

    const winner = checkWin(room);
    if (winner) return endGame(room, winner);

    // Build the day report (deaths, save, succubus reveal).
    const report = {
      day: room.day,
      deaths: summary.deaths.map((d) => d.name),
      saved: summary.saved,
      revealKnightName: null,
    };
    if (summary.seduceRevealKnightId) {
      const knight = room.players.get(summary.seduceRevealKnightId);
      if (knight) report.revealKnightName = knight.name;
    }

    startDay(room);
    io.to(room.code).emit('game:phase', { phase: 'day' });
    broadcastDay(room, report);
    scheduleBots(room, playBotsDay);
  }

  // -------------------------------------------------------------------------
  // Broadcast the day: the night report + voting board, plus the Emperor's
  // Knight's private "summary execution" option.
  // -------------------------------------------------------------------------
  function broadcastDay(room, report) {
    io.to(room.code).emit('game:day', {
      day: room.day,
      players: publicPlayers(room),
      report: report || room.lastDayReport || null,
      tally: voteTally(room),
    });
    if (report) room.lastDayReport = report;

    for (const player of room.players.values()) {
      const isKnight =
        player.alive && player.charClass?.id === 'emperor-knight';
      io.to(player.id).emit('game:yourDayAction', {
        canVote: player.alive,
        canExecute: isKnight && !room.dayState.emperorUsed,
        targets: player.alive ? targetsExcept(room, player.id) : [],
      });
    }
  }

  function broadcastVoteUpdate(room) {
    const voted = [...room.dayState.votes.keys()];
    io.to(room.code).emit('game:voteUpdate', {
      tally: voteTally(room),
      voted,
      total: [...room.players.values()].filter((p) => p.alive).length,
    });
  }

  function endDay(room) {
    if (room.phase !== 'day' || room.dayState?.resolved) return;
    const summary = resolveDay(room);
    const report = {
      executedName: summary.executed?.name || null,
      byEmperor: summary.byEmperor,
      tie: summary.tie,
    };
    io.to(room.code).emit('game:dayResult', {
      report,
      players: publicPlayers(room),
    });

    const winner = checkWin(room);
    // Give everyone a beat to read the verdict before the next phase begins.
    setTimeout(() => {
      if (!rooms.getRoom(room.code)) return; // room may have closed
      if (winner) return endGame(room, winner);
      startNight(room);
      io.to(room.code).emit('game:phase', { phase: 'night' });
      broadcastNight(room);
      scheduleBots(room, playBotsNight);
    }, 4500);
  }

  function endGame(room, winner) {
    room.phase = 'gameover';
    room.winner = winner;
    io.to(room.code).emit('game:over', {
      winner,
      roster: [...room.players.values()].map((p) => ({
        name: p.name,
        role: p.role,
        charClass: p.charClass?.id || null,
        alive: p.alive,
      })),
    });
  }

  // -------------------------------------------------------------------------
  // DEV: bot auto-play. Bots fill empty seats so one developer can run a whole
  // game alone. They confirm roles, solve their puzzles and pick random legal
  // targets, leaving the human(s) free to play their own part.
  // -------------------------------------------------------------------------
  function roomHasBots(room) {
    return [...room.players.values()].some((p) => p.isBot);
  }

  function randomLivingTarget(room, selfId) {
    const others = [...room.players.values()].filter(
      (p) => p.alive && p.id !== selfId
    );
    if (!others.length) return null;
    return others[Math.floor(Math.random() * others.length)].id;
  }

  // Each bot solves all of its own night puzzles and submits a random action.
  function playBotsNight(room) {
    if (room.phase !== 'night' || !room.night) return;
    for (const bot of room.players.values()) {
      if (!bot.isBot || !bot.alive) continue;
      for (const pz of room.night.puzzles) {
        if (!playerSolvedAll(room, bot.id)) {
          solvePuzzle(room, bot.id, pz.id, pz.a);
        }
      }
      const type = nightActionFor(bot.charClass?.id);
      if (type) {
        const target = randomLivingTarget(room, bot.id);
        if (target) submitNightAction(room, bot.id, target);
      }
    }
    broadcastPuzzleProgress(room);
    if (allPuzzlesSolved(room)) {
      io.to(room.code).emit('game:phase', { phase: 'nightResolving' });
      endNight(room);
    }
  }

  // Each bot casts a random vote during the day.
  function playBotsDay(room) {
    if (room.phase !== 'day') return;
    for (const bot of room.players.values()) {
      if (!bot.isBot || !bot.alive) continue;
      const target = randomLivingTarget(room, bot.id);
      submitVote(room, bot.id, target || 'skip');
    }
    broadcastVoteUpdate(room);
    if (allVoted(room)) endDay(room);
  }

  // Schedule bot play a moment after a phase broadcast so ordering stays clean.
  function scheduleBots(room, fn) {
    if (!DEV_TOOLS || !roomHasBots(room)) return;
    setTimeout(() => {
      if (rooms.getRoom(room.code)) fn(room);
    }, 900);
  }

  io.on('connection', (socket) => {
    // ----------------------------------------------------------------------
    // HOST (TV) creates a room
    // ----------------------------------------------------------------------
    socket.on('host:create', async () => {
      const passportUser = socket.request.session?.passport?.user ?? null;
      const room = rooms.createRoom(socket.id, passportUser);
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = 'host';

      const joinUrl = buildJoinUrl(socket, room.code);
      let qr = null;
      try {
        qr = await QRCode.toDataURL(joinUrl, { margin: 1, width: 320 });
      } catch {
        qr = null;
      }
      socket.emit('host:created', { ...rooms.publicState(room), joinUrl, qr, dev: DEV_TOOLS });
    });

    // ----------------------------------------------------------------------
    // PLAYER (phone) joins a room
    // ----------------------------------------------------------------------
    socket.on('player:join', ({ code, name }) => {
      const result = rooms.addPlayer(code, socket.id, name);
      if (result.error) {
        socket.emit('player:error', { code: result.error });
        return;
      }
      const { room, player } = result;
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.role = 'player';

      socket.emit('player:joined', { code: room.code, name: player.name });
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // ----------------------------------------------------------------------
    // DEV: host adds fake bot players to fill the room for solo testing
    // ----------------------------------------------------------------------
    socket.on('host:addBots', ({ count = 1 } = {}) => {
      if (!DEV_TOOLS) return;
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      if (room.phase !== 'lobby') return;
      const n = Math.max(1, Math.min(7, Number(count) || 1));
      for (let i = 0; i < n; i++) rooms.addBot(room);
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // ----------------------------------------------------------------------
    // HOST starts the game → assign roles, reveal privately, gate on roleAck
    // ----------------------------------------------------------------------
    socket.on('host:start', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;

      rooms.assignRoles(room);
      room.phase = 'role';
      room.day = 0;
      room.winner = null;
      for (const p of room.players.values()) p.roleAck = false;
      // Dev bots confirm their role automatically.
      for (const p of room.players.values()) if (p.isBot) p.roleAck = true;

      for (const p of room.players.values()) {
        io.to(p.id).emit('game:role', { role: p.role, charClass: p.charClass });
      }
      io.to(room.code).emit('game:phase', { phase: 'role' });
      io.to(room.code).emit('game:roleCounts', rooms.roleCounts(room));
      io.to(room.code).emit('game:roleAcks', {
        confirmed: [...room.players.values()].filter((p) => p.roleAck).length,
        total: room.players.size,
      });
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // ----------------------------------------------------------------------
    // PLAYER confirms they have seen their secret role
    // ----------------------------------------------------------------------
    socket.on('player:roleAck', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player) return;
      player.roleAck = true;
      const confirmed = [...room.players.values()].filter((p) => p.roleAck).length;
      io.to(room.code).emit('game:roleAcks', {
        confirmed,
        total: room.players.size,
      });
    });

    // ----------------------------------------------------------------------
    // HOST begins the first night (after everyone confirmed their role)
    // ----------------------------------------------------------------------
    socket.on('host:beginNight', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      if (room.phase !== 'role') return;
      startNight(room);
      io.to(room.code).emit('game:phase', { phase: 'night' });
      broadcastNight(room);
      scheduleBots(room, playBotsNight);
    });

    // ----------------------------------------------------------------------
    // NIGHT: a player solves one of their own puzzles (personal cover task)
    // ----------------------------------------------------------------------
    socket.on('player:solvePuzzle', ({ puzzleId, answer }) => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room) return;
      const player = room.players.get(socket.id);
      if (!player || !player.alive) return;
      const result = solvePuzzle(room, socket.id, puzzleId, answer);
      if (result.error === 'WRONG') {
        socket.emit('player:puzzleWrong', { puzzleId });
        return;
      }
      if (!result.ok) return;
      // Tell this player their own progress; tell the room the aggregate.
      socket.emit('player:puzzleOk', {
        puzzleId,
        mySolved: result.mySolved,
        myTotal: result.myTotal,
      });
      broadcastPuzzleProgress(room);
      if (result.allSolved) {
        io.to(room.code).emit('game:phase', { phase: 'nightResolving' });
        endNight(room);
      }
    });

    // ----------------------------------------------------------------------
    // NIGHT: a role-player secretly submits their action
    // ----------------------------------------------------------------------
    socket.on('player:nightAction', ({ target }) => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room) return;
      const result = submitNightAction(room, socket.id, target);
      if (result.error) {
        socket.emit('player:actionError', { code: result.error });
        return;
      }
      socket.emit('player:actionOk', { target });
    });

    // ----------------------------------------------------------------------
    // DAY: a player casts their execution vote
    // ----------------------------------------------------------------------
    socket.on('player:vote', ({ target }) => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room) return;
      const result = submitVote(room, socket.id, target);
      if (result.error) {
        socket.emit('player:actionError', { code: result.error });
        return;
      }
      socket.emit('player:voteOk', { target });
      broadcastVoteUpdate(room);
      if (allVoted(room)) endDay(room);
    });

    // ----------------------------------------------------------------------
    // DAY: the Emperor's Knight invokes a summary execution (overrides vote)
    // ----------------------------------------------------------------------
    socket.on('player:emperorExecute', ({ target }) => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room) return;
      const result = emperorExecute(room, socket.id, target);
      if (result.error) {
        socket.emit('player:actionError', { code: result.error });
        return;
      }
      endDay(room);
    });

    // ----------------------------------------------------------------------
    // HOST may force the current phase forward (safety valve)
    // ----------------------------------------------------------------------
    socket.on('host:advance', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      if (room.phase === 'night') {
        io.to(room.code).emit('game:phase', { phase: 'nightResolving' });
        endNight(room);
      } else if (room.phase === 'day') {
        endDay(room);
      }
    });

    // ----------------------------------------------------------------------
    // HOST starts a brand new game (back to lobby with same players)
    // ----------------------------------------------------------------------
    socket.on('host:reset', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      room.phase = 'lobby';
      room.winner = null;
      room.day = 0;
      for (const p of room.players.values()) {
        p.role = null;
        p.charClass = null;
        p.roleAck = false;
        p.alive = true;
        p.nightAction = null;
        p.investigateResult = null;
      }
      io.to(room.code).emit('game:phase', { phase: 'lobby' });
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // ----------------------------------------------------------------------
    // Disconnects
    // ----------------------------------------------------------------------
    socket.on('disconnect', () => {
      if (socket.data.role === 'host') {
        const room = rooms.removeRoomByHost(socket.id);
        if (room) io.to(room.code).emit('room:closed');
      } else if (socket.data.role === 'player') {
        const room = rooms.removePlayer(socket.id);
        if (room) io.to(room.code).emit('room:update', rooms.publicState(room));
      }
    });
  });
}
