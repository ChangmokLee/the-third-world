// Core game engine for "The Third World" — a social-deduction (Mafia/Werewolf)
// game themed as the Empire vs. the Cult of the Fallen.
//
// This module is intentionally a set of pure-ish functions that operate on a
// `room` object (created by rooms.js). The socket layer (socketHandlers.js)
// drives the state machine and broadcasts the resulting state to the TV host
// and the phone controllers.
//
// Phase flow:
//   lobby -> role -> night -> day -> night -> day -> ... -> gameover
//
// Win conditions:
//   GOOD wins when every Cult member is dead.
//   EVIL wins when living Cult >= living Empire (they can no longer be outvoted).

// ---------------------------------------------------------------------------
// Night puzzles. Numeric answers keep them language-neutral so the same answer
// works whether the player reads the English or Korean prompt. The night ends
// once every puzzle on the board is solved (anyone may solve any puzzle).
// ---------------------------------------------------------------------------
const PUZZLE_BANK = [
  { en: '7 + 8 = ?', ko: '7 + 8 = ?', a: '15' },
  { en: '3 × 4 = ?', ko: '3 × 4 = ?', a: '12' },
  { en: '12 − 5 = ?', ko: '12 − 5 = ?', a: '7' },
  { en: 'How many minutes in an hour?', ko: '한 시간은 몇 분?', a: '60' },
  { en: 'Sequence: 2, 4, 8, 16, ?', ko: '수열: 2, 4, 8, 16, ?', a: '32' },
  { en: 'Largest sum of two dice?', ko: '주사위 두 개의 최대 합은?', a: '12' },
  { en: '6 × 6 = ?', ko: '6 × 6 = ?', a: '36' },
  { en: 'Half of 18?', ko: '18의 절반은?', a: '9' },
  { en: '9 + 9 = ?', ko: '9 + 9 = ?', a: '18' },
  { en: 'How many sides on a hexagon?', ko: '육각형의 변은 몇 개?', a: '6' },
  { en: 'Sequence: 1, 1, 2, 3, 5, ?', ko: '수열: 1, 1, 2, 3, 5, ?', a: '8' },
  { en: '100 − 1 = ?', ko: '100 − 1 = ?', a: '99' },
];

const PUZZLES_PER_NIGHT = 3;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function livingPlayers(room) {
  return [...room.players.values()].filter((p) => p.alive);
}

function findByClass(room, classId, onlyAlive = true) {
  return [...room.players.values()].find(
    (p) => p.charClass?.id === classId && (!onlyAlive || p.alive)
  );
}

function findAllByClass(room, classId, onlyAlive = true) {
  return [...room.players.values()].filter(
    (p) => p.charClass?.id === classId && (!onlyAlive || p.alive)
  );
}

// Which night ability (if any) a class has. Returns null for classes that
// take no night action (they just help solve puzzles as cover).
export function nightActionFor(classId) {
  switch (classId) {
    case 'court-wizard':
      return 'protect';
    case 'inquisitor':
      return 'investigate';
    case 'fallen-knight':
      return 'assassinate';
    case 'succubus':
      return 'seduce';
    default:
      return null; // emperor-knight (day skill), citizen, cultist
  }
}

// ---------------------------------------------------------------------------
// NIGHT
// ---------------------------------------------------------------------------
export function startNight(room) {
  room.phase = 'night';
  room.day = (room.day || 0) + 1;

  // Fresh puzzle board for this night.
  const picks = shuffle([...PUZZLE_BANK]).slice(0, PUZZLES_PER_NIGHT);
  room.night = {
    puzzles: picks.map((p, i) => ({
      id: i,
      en: p.en,
      ko: p.ko,
      a: String(p.a).toLowerCase().trim(),
      solved: false,
      solvedBy: null,
    })),
    actions: new Map(), // playerId -> { type, target }
  };

  // Clear per-night transient flags.
  for (const p of room.players.values()) {
    p.nightAction = null;
    p.investigateResult = null;
  }
  return room;
}

// Record a secret night action for a player. Returns { ok } or { error }.
export function submitNightAction(room, playerId, target) {
  if (room.phase !== 'night') return { error: 'NOT_NIGHT' };
  const player = room.players.get(playerId);
  if (!player || !player.alive) return { error: 'NOT_ALLOWED' };
  const type = nightActionFor(player.charClass?.id);
  if (!type) return { error: 'NO_ACTION' };

  const targetPlayer = room.players.get(target);
  if (!targetPlayer || !targetPlayer.alive) return { error: 'BAD_TARGET' };

  room.night.actions.set(playerId, { type, target });
  player.nightAction = { type, target };
  return { ok: true };
}

// Try to solve a puzzle. Returns { ok:true, allSolved } or { error }.
export function solvePuzzle(room, puzzleId, answer) {
  if (room.phase !== 'night') return { error: 'NOT_NIGHT' };
  const puzzle = room.night.puzzles.find((p) => p.id === puzzleId);
  if (!puzzle) return { error: 'NO_PUZZLE' };
  if (puzzle.solved) return { ok: true, allSolved: allPuzzlesSolved(room) };

  const given = String(answer || '').toLowerCase().trim();
  if (given !== puzzle.a) return { error: 'WRONG' };

  puzzle.solved = true;
  return { ok: true, allSolved: allPuzzlesSolved(room) };
}

export function allPuzzlesSolved(room) {
  return room.night?.puzzles.every((p) => p.solved) ?? false;
}

export function puzzleProgress(room) {
  const puzzles = room.night?.puzzles || [];
  return { solved: puzzles.filter((p) => p.solved).length, total: puzzles.length };
}

// Resolve the night: apply protection, assassinations, investigations and the
// succubus seduction. Returns a structured summary used for the day report.
export function resolveNight(room) {
  const actions = room.night?.actions || new Map();
  const summary = {
    deaths: [], // [{ id, name }]
    saved: false, // was an assassination blocked by the wizard?
    inquisitor: null, // { inquisitorId, targetId, targetName, isEvil }
    seduceRevealKnightId: null, // emperor-knight id to reveal during the day
  };

  // 1) Court wizard protection.
  let protectedId = null;
  for (const [actorId, act] of actions) {
    if (act.type === 'protect') protectedId = act.target;
  }

  // 2) Fallen knight assassinations (any number of fallen knights, but they
  //    typically coordinate on one target). Each assassinate target dies unless
  //    it is the protected player.
  const killTargets = new Set();
  for (const [actorId, act] of actions) {
    if (act.type === 'assassinate') killTargets.add(act.target);
  }
  for (const targetId of killTargets) {
    if (targetId === protectedId) {
      summary.saved = true;
      continue;
    }
    const victim = room.players.get(targetId);
    if (victim && victim.alive) {
      victim.alive = false;
      summary.deaths.push({ id: victim.id, name: victim.name });
    }
  }

  // 3) Inquisitor investigation — private result for the inquisitor.
  for (const [actorId, act] of actions) {
    if (act.type === 'investigate') {
      const target = room.players.get(act.target);
      if (target) {
        const isEvil = target.role === 'evil';
        const inquisitor = room.players.get(actorId);
        if (inquisitor) inquisitor.investigateResult = { targetId: target.id, targetName: target.name, isEvil };
        summary.inquisitor = { inquisitorId: actorId, targetId: target.id, targetName: target.name, isEvil };
      }
    }
  }

  // 4) Succubus seduction — if the succubus is still alive after the night and
  //    her chosen target is the Emperor's Knight, that knight is revealed today.
  const succubus = findByClass(room, 'succubus', false);
  if (succubus && succubus.alive) {
    const act = actions.get(succubus.id);
    if (act && act.type === 'seduce') {
      const target = room.players.get(act.target);
      if (target && target.charClass?.id === 'emperor-knight') {
        summary.seduceRevealKnightId = target.id;
      }
    }
  }

  room.lastNight = summary;
  return summary;
}

// ---------------------------------------------------------------------------
// DAY
// ---------------------------------------------------------------------------
export function startDay(room) {
  room.phase = 'day';
  room.day = room.day || 1;
  room.dayState = {
    votes: new Map(), // voterId -> targetId
    emperorExecuteTarget: null,
    emperorUsed: false,
    resolved: false,
  };
  return room;
}

export function submitVote(room, voterId, targetId) {
  if (room.phase !== 'day') return { error: 'NOT_DAY' };
  const voter = room.players.get(voterId);
  if (!voter || !voter.alive) return { error: 'NOT_ALLOWED' };
  if (targetId === 'skip') {
    room.dayState.votes.set(voterId, 'skip');
    return { ok: true };
  }
  const target = room.players.get(targetId);
  if (!target || !target.alive) return { error: 'BAD_TARGET' };
  room.dayState.votes.set(voterId, targetId);
  return { ok: true };
}

// The Emperor's Knight may, once per day, override the vote and summarily
// execute a chosen target ("By command of the Emperor").
export function emperorExecute(room, knightId, targetId) {
  if (room.phase !== 'day') return { error: 'NOT_DAY' };
  const knight = room.players.get(knightId);
  if (!knight || !knight.alive || knight.charClass?.id !== 'emperor-knight') {
    return { error: 'NOT_ALLOWED' };
  }
  const target = room.players.get(targetId);
  if (!target || !target.alive) return { error: 'BAD_TARGET' };
  room.dayState.emperorExecuteTarget = targetId;
  room.dayState.emperorUsed = true;
  return { ok: true };
}

export function voteTally(room) {
  const tally = {};
  for (const targetId of room.dayState?.votes.values() || []) {
    tally[targetId] = (tally[targetId] || 0) + 1;
  }
  return tally;
}

export function allVoted(room) {
  const living = livingPlayers(room);
  return living.length > 0 && living.every((p) => room.dayState?.votes.has(p.id));
}

// Resolve the day's execution. Emperor override takes priority; otherwise the
// strict plurality vote (no tie, not "skip") is executed. Returns a summary.
export function resolveDay(room) {
  const ds = room.dayState;
  const summary = { executed: null, byEmperor: false, tie: false };

  if (ds.emperorExecuteTarget) {
    const target = room.players.get(ds.emperorExecuteTarget);
    if (target && target.alive) {
      target.alive = false;
      summary.executed = { id: target.id, name: target.name };
      summary.byEmperor = true;
    }
  } else {
    const tally = voteTally(room);
    let topId = null;
    let topCount = 0;
    let tie = false;
    for (const [id, count] of Object.entries(tally)) {
      if (id === 'skip') continue;
      if (count > topCount) {
        topId = id;
        topCount = count;
        tie = false;
      } else if (count === topCount && topCount > 0) {
        tie = true;
      }
    }
    if (topId && !tie) {
      const target = room.players.get(topId);
      if (target && target.alive) {
        target.alive = false;
        summary.executed = { id: target.id, name: target.name };
      }
    } else if (tie) {
      summary.tie = true;
    }
  }

  ds.resolved = true;
  room.lastDay = summary;
  return summary;
}

// ---------------------------------------------------------------------------
// WIN CONDITIONS
// ---------------------------------------------------------------------------
export function aliveCounts(room) {
  let good = 0;
  let evil = 0;
  for (const p of room.players.values()) {
    if (!p.alive) continue;
    if (p.role === 'evil') evil++;
    else good++;
  }
  return { good, evil };
}

export function checkWin(room) {
  const { good, evil } = aliveCounts(room);
  if (evil === 0) return 'good';
  if (evil >= good) return 'evil';
  return null;
}

// A compact, role-aware view of the room used to build host/player payloads.
export function playerList(room) {
  return [...room.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    alive: p.alive,
  }));
}

export { PUZZLE_BANK };
