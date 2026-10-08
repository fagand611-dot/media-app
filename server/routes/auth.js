import { HttpError, ah } from '../http.js';
import { COOKIE, cookieOptions, createSession, hashPassword, requireUser, verifyPassword } from '../auth.js';
import { MEDIA, GENRES, MOODS } from '../taxonomy.js';

const USERNAME_RE = /^[a-z0-9_]{3,24}$/i;

export default function authRoutes(r, { db }) {
  r.post('/auth/register', ah(async (req, res) => {
    const { username, password, displayName } = req.body || {};
    if (!USERNAME_RE.test(username || '')) throw new HttpError(400, 'Username must be 3–24 letters, numbers or _');
    if (!password || password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'That username is taken');
    const { lastInsertRowid: id } = db
      .prepare('INSERT INTO users (username, display_name, password_hash) VALUES (?,?,?)')
      .run(username, (displayName || username).trim().slice(0, 40), hashPassword(password));
    const s = createSession(db, Number(id));
    res.cookie(COOKIE, s.token, cookieOptions(s.expires));
    res.status(201).json({ user: { id: Number(id), username, display_name: displayName || username, onboarded: false } });
  }));

  r.post('/auth/login', ah(async (req, res) => {
    const { username, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username || '');
    if (!u || !verifyPassword(password || '', u.password_hash)) throw new HttpError(401, 'Wrong username or password');
    const s = createSession(db, u.id);
    res.cookie(COOKIE, s.token, cookieOptions(s.expires));
    res.json({ user: { id: u.id, username: u.username, display_name: u.display_name, onboarded: !!u.onboarded } });
  }));

  r.post('/auth/logout', (req, res) => {
    const token = req.cookies?.[COOKIE];
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => res.json({ user: req.user ?? null }));

  r.get('/taxonomy', (_req, res) => res.json({ media: MEDIA, genres: GENRES, moods: MOODS }));
}
