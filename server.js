import 'dotenv/config';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Server as SocketIOServer } from 'socket.io';

import { createRoomStore } from './src/rooms.js';
import { registerSocketHandlers } from './src/socketHandlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const {
  PORT = 3000,
  SESSION_SECRET = 'dev-secret-change-me',
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  NODE_ENV = 'development',
} = process.env;

const isProduction = NODE_ENV === 'production';

// In production, prefer an explicit public URL so the OAuth callback always
// matches what is registered in Google Cloud Console.
//   PUBLIC_URL   e.g. https://your-app.onrender.com   (no trailing slash)
//   GOOGLE_CALLBACK_URL overrides everything if set.
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (PUBLIC_URL
    ? `${PUBLIC_URL}/auth/google/callback`
    : `http://localhost:${PORT}/auth/google/callback`);

const googleConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

// Behind a hosting platform's proxy (Render/Railway/Fly), trust the proxy so
// secure cookies and req.protocol work correctly.
if (isProduction) app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Sessions + Passport (Google OAuth)
// ---------------------------------------------------------------------------
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction, // HTTPS-only cookies in production
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) => {
        // In a real app you would look up / create a user in a database here.
        const user = {
          id: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value ?? null,
          photo: profile.photos?.[0]?.value ?? null,
        };
        return done(null, user);
      }
    )
  );
} else {
  console.warn(
    '[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set. ' +
      'Google login is disabled until you configure .env (see README).'
  );
}

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
function ensureAuth(req, res, next) {
  if (req.isAuthenticated?.()) return next();
  res.redirect('/');
}

app.get('/auth/google', (req, res, next) => {
  if (!googleConfigured) {
    return res
      .status(503)
      .send('Google login is not configured yet. See README.md to set up .env.');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/home')
);

app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// Small JSON endpoint so the frontend knows who is logged in.
app.get('/api/me', (req, res) => {
  res.json({
    authenticated: Boolean(req.user),
    googleConfigured,
    user: req.user ?? null,
  });
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);
// Logged-in landing (host or join). Requires auth.
app.get('/home', ensureAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'home.html'))
);
// The TV / big-screen view.
app.get('/host', ensureAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'host.html'))
);
// The phone controller view. No login required — players just enter a room code.
app.get('/play', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'controller.html'))
);

// ---------------------------------------------------------------------------
// Realtime (Socket.IO) — share the session with sockets
// ---------------------------------------------------------------------------
io.engine.use(sessionMiddleware);
io.engine.use(passport.session());

const rooms = createRoomStore();
registerSocketHandlers(io, rooms);

server.listen(PORT, () => {
  console.log(`\n  The Third World running on port ${PORT}\n`);
  console.log(`  OAuth callback: ${GOOGLE_CALLBACK_URL}`);
  if (!googleConfigured) {
    console.log('  ⚠  Google login disabled — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.\n');
  }
});
