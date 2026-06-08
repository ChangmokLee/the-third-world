// Wires up all realtime events between the TV host screen and phone controllers.
import QRCode from 'qrcode';

function buildJoinUrl(socket, code) {
  // Prefer the configured public URL (production); fall back to the request
  // origin (works for local dev and when origin header is present).
  const base =
    (process.env.PUBLIC_URL || '').replace(/\/$/, '') ||
    socket.handshake.headers.origin ||
    `http://localhost:${process.env.PORT || 3000}`;
  return `${base}/play?code=${code}`;
}

export function registerSocketHandlers(io, rooms) {
  io.on('connection', (socket) => {
    // -----------------------------------------------------------------------
    // HOST (TV) creates a room
    // -----------------------------------------------------------------------
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
        qr = null; // QR is a nice-to-have; the room code still works.
      }

      socket.emit('host:created', { ...rooms.publicState(room), joinUrl, qr });
    });

    // -----------------------------------------------------------------------
    // PLAYER (phone) joins a room
    // -----------------------------------------------------------------------
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
      // Tell the TV (and everyone) the updated lobby.
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // -----------------------------------------------------------------------
    // HOST starts the game
    // -----------------------------------------------------------------------
    socket.on('host:start', () => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.hostSocketId !== socket.id) return;
      room.phase = 'playing';
      for (const p of room.players.values()) p.choice = null;

      // Secretly assign good/evil alignments and tell each player privately.
      rooms.assignRoles(room);
      for (const p of room.players.values()) {
        io.to(p.id).emit('game:role', { role: p.role });
      }

      io.to(room.code).emit('game:phase', { phase: 'playing' });
      // The TV only learns how many of each side there are, never who.
      io.to(room.code).emit('game:roleCounts', rooms.roleCounts(room));
      io.to(room.code).emit('room:update', rooms.publicState(room));
    });

    // -----------------------------------------------------------------------
    // PLAYER submits a choice (story branch / vote)
    // -----------------------------------------------------------------------
    socket.on('player:choice', ({ choice }) => {
      const room = rooms.getRoom(socket.data.roomCode);
      if (!room || room.phase !== 'playing') return;
      const player = room.players.get(socket.id);
      if (!player) return;
      player.choice = choice;

      io.to(room.code).emit('room:update', rooms.publicState(room));

      // When everyone has chosen, tally and tell the host.
      const all = [...room.players.values()];
      if (all.length > 0 && all.every((p) => p.choice !== null)) {
        const tally = {};
        for (const p of all) tally[p.choice] = (tally[p.choice] || 0) + 1;
        room.phase = 'results';
        io.to(room.code).emit('game:results', { tally });
        io.to(room.code).emit('game:phase', { phase: 'results' });
      }
    });

    // -----------------------------------------------------------------------
    // Disconnects
    // -----------------------------------------------------------------------
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
