// Servidor da mesa do Crepúsculo dos Reinos.
// Serve o VTT compilado (build/), guarda contas, sessões, imagens e o estado da
// mesa em server-data/ (fora do git) e sincroniza todos os navegadores via WebSocket.
//
// Uso: npm run mesa   (compila e sobe em http://<seu-ip>:3001)
//      npm run server (só o servidor; use com npm start durante o desenvolvimento)
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { diff, applyOp, apply } from '../src/sync/jsonPatch.mjs';
import { viewFor, viewRoot, dependentRoots, playerOpAllowed } from '../src/sync/rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.VTT_PORT || 3001);
const HOST = process.env.VTT_HOST || '0.0.0.0';
const ROOT = path.join(__dirname, '..');
const DATA = path.resolve(process.env.VTT_DATA || path.join(ROOT, 'server-data'));
const BUILD = path.join(ROOT, 'build');
const UPLOADS = path.join(DATA, 'uploads');
const BACKUPS = path.join(DATA, 'backups');
const SESSION_DAYS = 30;
const MAX_JSON = 1 * 1024 * 1024;
const MAX_UPLOAD = 25 * 1024 * 1024;
const MAX_AUDIO = 80 * 1024 * 1024;
const MAX_WS = 64 * 1024 * 1024;

for (const d of [DATA, UPLOADS, BACKUPS]) fs.mkdirSync(d, { recursive: true });

// ── Persistência simples em JSON (escrita atômica) ───────────────────────────
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); } catch { return fallback; }
}
const pendingWrites = new Map();
function writeJsonSoon(file, getData, delay = 500) {
  if (pendingWrites.has(file)) return;
  pendingWrites.set(file, setTimeout(() => { pendingWrites.delete(file); writeJsonNow(file, getData()); }, delay));
}
function writeJsonNow(file, data) {
  const target = path.join(DATA, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, target);
}
function flushAll() {
  for (const [file, t] of pendingWrites) { clearTimeout(t); pendingWrites.delete(file); }
  writeJsonNow('users.json', users);
  writeJsonNow('sessions.json', sessions);
  writeJsonNow('state.json', state);
}

let users = readJson('users.json', []);
let sessions = readJson('sessions.json', {});
let state = readJson('state.json', {});
const saveUsers = () => writeJsonSoon('users.json', () => users);
const saveSessions = () => writeJsonSoon('sessions.json', () => sessions, 2000);
const saveState = () => writeJsonSoon('state.json', () => state, 1000);

function backup() {
  if (!Object.keys(state).length) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.writeFileSync(path.join(BACKUPS, `state-${stamp}.json`), JSON.stringify(state));
  const files = fs.readdirSync(BACKUPS).filter(f => f.startsWith('state-')).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 30))) fs.unlinkSync(path.join(BACKUPS, f));
}
backup();
setInterval(backup, 20 * 60 * 1000).unref();

// ── Contas e sessões ────────────────────────────────────────────────────────
const lc = s => String(s ?? '').trim().toLowerCase();
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  return { salt, hash };
}
function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
const findUser = name => users.find(u => lc(u.name) === lc(name));
const publicUser = u => ({ id: u.id, name: u.name, role: u.role, isActive: u.active, approved: !!u.approved,
  lastLogin: u.lastLogin ?? null, createdAt: u.createdAt });
function newSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId: user.id, created: Date.now(), lastSeen: Date.now() };
  saveSessions();
  return token;
}
function userFromToken(token) {
  if (typeof token !== 'string' || !sessions[token]) return null;
  const s = sessions[token];
  if (Date.now() - s.lastSeen > SESSION_DAYS * 864e5) { delete sessions[token]; saveSessions(); return null; }
  const u = users.find(x => x.id === s.userId);
  if (!u || !u.active) return null;
  s.lastSeen = Date.now(); saveSessions();
  return u;
}
function dropSessionsOf(userId) {
  for (const [t, s] of Object.entries(sessions)) if (s.userId === userId) delete sessions[t];
  saveSessions();
  for (const c of clients) if (c.user.id === userId) c.ws.close(4001, 'sessao encerrada');
}
const validName = n => typeof n === 'string' && /^[\p{L}\p{N} _.'-]{2,24}$/u.test(n.trim());
const validPass = p => typeof p === 'string' && p.length >= 6 && p.length <= 128;

// limite de tentativas por IP (além do bloqueio por conta)
const ipFails = new Map();
function ipBlocked(ip) {
  const r = ipFails.get(ip);
  if (!r || Date.now() > r.until) return false;
  return r.count >= 20;
}
function ipFail(ip) {
  const r = ipFails.get(ip);
  if (!r || Date.now() > r.until) ipFails.set(ip, { count: 1, until: Date.now() + 10 * 60e3 });
  else r.count++;
}
const isLoopback = ip => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

// ── Imagens: data URLs viram arquivos em server-data/uploads ─────────────────
const IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
// Áudio (músicas e ambientes da mesa): só o Mestre envia.
const AUDIO_TYPES = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/wave': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/webm': 'webm', 'audio/flac': 'flac', 'audio/x-flac': 'flac' };
function storeImage(buf, mime) {
  const ext = IMG_TYPES[mime] ?? AUDIO_TYPES[mime];
  if (!ext) return null;
  const name = `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 40)}.${ext}`;
  const file = path.join(UPLOADS, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return `/uploads/${name}`;
}
const DATA_URL = /^data:(image\/(?:png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=]+)$/;
function extractImages(value) {
  if (typeof value === 'string') {
    if (value.length < 1500 || !value.startsWith('data:image/')) return value;
    const m = DATA_URL.exec(value);
    if (!m) return value;
    return storeImage(Buffer.from(m[2], 'base64'), m[1]) ?? value;
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map(v => { const n = extractImages(v); if (n !== v) changed = true; return n; });
    return changed ? out : value;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const out = {};
    for (const [k, v] of Object.entries(value)) { const n = extractImages(v); if (n !== v) changed = true; out[k] = n; }
    return changed ? out : value;
  }
  return value;
}

// ── WebSocket: sincronização ─────────────────────────────────────────────────
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const clients = new Set();
const EVENT_KINDS = new Set(['ping', 'pointer', 'sfx']);
const OPS = new Set(['set', 'del', 'upsert', 'remove', 'order', 'sadd', 'sdel']);
function validOp(o) {
  return !!o && typeof o === 'object' && OPS.has(o.op) && Array.isArray(o.path) && o.path.length > 0 && o.path.length < 12
    && typeof o.path[0] === 'string'
    && o.path.every(s => (typeof s === 'string' ? !BAD_KEYS.has(s) : !!s && typeof s === 'object' && (typeof s.id === 'string' || typeof s.id === 'number')))
    && (o.op !== 'upsert' || (o.value && typeof o.value === 'object' && (typeof o.value.id === 'string' || typeof o.value.id === 'number')))
    && (!['sadd', 'sdel'].includes(o.op) || Array.isArray(o.values))
    && (o.op !== 'order' || Array.isArray(o.ids));
}
const send = (c, msg) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); };
const hasGM = () => users.some(u => u.role === 'gm');
const online = () => [...clients].filter(c => c.ready).map(c => ({ name: c.user.name, role: c.user.role }));
function broadcastPresence() { for (const c of clients) if (c.ready) send(c, { type: 'presence', online: online() }); }

function initClient(c) {
  const empty = Object.keys(state).length === 0;
  if (empty && c.user.role !== 'gm') { c.waiting = true; send(c, { type: 'wait' }); return; }
  c.view = viewFor(state, c.user);
  c.ready = true; c.waiting = false;
  send(c, { type: 'init', state: c.view, empty, you: publicUser(c.user), serverTime: Date.now() });
  broadcastPresence();
}

function handleOps(c, ops) {
  if (!Array.isArray(ops) || ops.length === 0) return;
  const valid = ops.filter(validOp);
  const roots = new Set();
  let changed = false;
  for (const raw of valid) {
    roots.add(raw.path[0]);
    let op = raw;
    if ('value' in op) { const v = extractImages(op.value); if (v !== op.value) op = { ...op, value: v }; }
    if (op.path[0] === 'chatMessages' && op.path.length === 1 && op.op === 'upsert' && op.value && typeof op.value === 'object') {
      const exists = (state.chatMessages ?? []).some(m => String(m.id) === String(op.value.id));
      if (!exists) op = { ...op, value: { ...op.value, authorAccount: c.user.name } };
    }
    if (c.user.role !== 'gm' && !playerOpAllowed(op, state, c.user.name)) continue;
    state = applyOp(state, op);
    changed = true;
  }
  // o remetente já tem as próprias mudanças: só recebe correções (imagens, recusas, autoria)
  c.view = apply(c.view, valid);
  if (changed) saveState();
  const deps = dependentRoots(roots);
  for (const k of clients) {
    if (!k.ready) continue;
    const out = [];
    const next = { ...k.view };
    for (const r of deps) {
      const nv = k.user.role === 'gm' ? state[r] : viewRoot(state, r, k.user.name);
      if (nv === undefined) { if (k.view[r] !== undefined) { out.push({ op: 'del', path: [r] }); delete next[r]; } continue; }
      diff(k.view[r], nv, [r], out);
      next[r] = nv;
    }
    k.view = next;
    if (out.length) send(k, { type: 'ops', ops: out });
  }
  // jogadores que esperavam a mesa ser aberta
  if (changed) for (const k of clients) if (k.waiting) initClient(k);
}

function onSocket(ws, req) {
  const ip = req.socket.remoteAddress;
  const c = { ws, ip, user: null, view: null, ready: false, alive: true };
  const authTimer = setTimeout(() => ws.close(4000, 'sem autenticacao'), 5000);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!c.user) {
      if (msg.type !== 'auth') return ws.close(4000, 'sem autenticacao');
      const u = userFromToken(msg.token);
      clearTimeout(authTimer);
      if (!u) return ws.close(4001, 'sessao invalida');
      c.user = u; clients.add(c);
      return initClient(c);
    }
    if (!c.ready) return;
    if (msg.type === 'ops') handleOps(c, msg.ops);
    else if (msg.type === 'event' && msg.event && typeof msg.event === 'object') {
      // eventos instantâneos (ping, ponteiro, efeito sonoro): pequenos, de tipos conhecidos e com limite de ritmo
      if (!EVENT_KINDS.has(msg.event.kind) || String(data).length > 2000) return;
      const now = Date.now();
      if (now - (c.evWindow ?? 0) > 1000) { c.evWindow = now; c.evCount = 0; }
      if (++c.evCount > 40) return;
      const ev = { ...msg.event, from: c.user.name };
      for (const k of clients) if (k !== c && k.ready) send(k, { type: 'event', event: ev });
    } else if (msg.type === 'resync') {
      c.view = viewFor(state, c.user);
      send(c, { type: 'init', state: c.view, empty: false, you: publicUser(c.user), serverTime: Date.now() });
    }
  });
  ws.on('close', () => { clearTimeout(authTimer); clients.delete(c); broadcastPresence(); });
  ws.on('error', () => {});
}

// ── HTTP ─────────────────────────────────────────────────────────────────────
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.aac': 'audio/aac',
  '.webm': 'audio/webm', '.flac': 'audio/flac', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };

function baseHeaders(extra = {}) {
  return { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'strict-origin-when-cross-origin', ...extra };
}
function json(res, code, body) {
  res.writeHead(code, baseHeaders({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }));
  res.end(JSON.stringify(body));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', ch => { size += ch.length; if (size > limit) { reject(new Error('grande demais')); req.destroy(); } else chunks.push(ch); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJsonBody(req) {
  const buf = await readBody(req, MAX_JSON);
  try { return JSON.parse(buf.toString('utf8') || '{}'); } catch { return {}; }
}
function authUser(req) {
  const h = req.headers.authorization || '';
  return userFromToken(h.startsWith('Bearer ') ? h.slice(7) : null);
}

async function serveFile(res, file, cache, req) {
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) throw new Error();
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const m = /^bytes=(\d*)-(\d*)$/.exec(req?.headers?.range || '');
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      let end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) {
        res.writeHead(416, baseHeaders({ 'Content-Range': `bytes */${st.size}` }));
        res.end();
        return true;
      }
      res.writeHead(206, baseHeaders({ 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Cache-Control': cache }));
      if (req.method === 'HEAD') { res.end(); return true; }
      fs.createReadStream(file, { start, end }).pipe(res);
      return true;
    }
    res.writeHead(200, baseHeaders({ 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': cache }));
    if (req?.method === 'HEAD') { res.end(); return true; }
    fs.createReadStream(file).pipe(res);
    return true;
  } catch { return false; }
}
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}

async function api(req, res, url) {
  const ip = req.socket.remoteAddress;
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/status') return json(res, 200, { needsSetup: !hasGM(), canSetup: !hasGM() && isLoopback(ip) });

  if (route === 'POST /api/setup') {
    if (hasGM()) return json(res, 409, { error: 'A mesa já tem um Mestre.' });
    if (!isLoopback(ip)) return json(res, 403, { error: 'Crie a conta do Mestre no próprio computador do servidor (localhost).' });
    const { name, password } = await readJsonBody(req);
    if (!validName(name)) return json(res, 400, { error: 'Nome inválido (2 a 24 letras, números ou espaço).' });
    if (!validPass(password)) return json(res, 400, { error: 'A senha precisa ter de 6 a 128 caracteres.' });
    const u = { id: crypto.randomUUID(), name: name.trim(), role: 'gm', active: true, approved: true, createdAt: Date.now(), ...hashPassword(password) };
    users.push(u); saveUsers();
    return json(res, 200, { token: newSession(u), user: publicUser(u) });
  }

  if (route === 'POST /api/register') {
    if (!hasGM()) return json(res, 409, { error: 'O Mestre ainda não criou a mesa.' });
    if (ipBlocked(ip)) return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
    const { name, password } = await readJsonBody(req);
    if (!validName(name)) return json(res, 400, { error: 'Nome inválido (2 a 24 letras, números ou espaço).' });
    if (!validPass(password)) return json(res, 400, { error: 'A senha precisa ter de 6 a 128 caracteres.' });
    if (findUser(name)) { ipFail(ip); return json(res, 409, { error: 'Nome já cadastrado. Faça login.' }); }
    const u = { id: crypto.randomUUID(), name: name.trim(), role: 'player', active: false, approved: false, createdAt: Date.now(), ...hashPassword(password) };
    users.push(u); saveUsers();
    for (const c of clients) if (c.ready && c.user.role === 'gm') send(c, { type: 'players-changed' });
    return json(res, 200, { pending: true });
  }

  if (route === 'POST /api/login') {
    if (ipBlocked(ip)) return json(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
    const { name, password } = await readJsonBody(req);
    const u = findUser(name);
    if (!u || typeof password !== 'string') { ipFail(ip); return json(res, 401, { error: 'Nome ou senha incorretos.' }); }
    if (u.lockUntil && Date.now() < u.lockUntil) return json(res, 429, { error: `Muitas tentativas. Aguarde ${Math.ceil((u.lockUntil - Date.now()) / 1000)}s.` });
    if (!checkPassword(u, password)) {
      ipFail(ip);
      u.failedAttempts = (u.failedAttempts ?? 0) + 1;
      if (u.failedAttempts >= 5) { u.lockUntil = Date.now() + 60e3; u.failedAttempts = 0; }
      saveUsers();
      return json(res, 401, { error: u.lockUntil && Date.now() < u.lockUntil ? 'Senha incorreta. Conta bloqueada por 1 minuto.' : 'Nome ou senha incorretos.' });
    }
    if (!u.approved) return json(res, 403, { error: 'Conta aguardando aprovação do Mestre.' });
    if (!u.active) return json(res, 403, { error: 'Conta bloqueada pelo Mestre.' });
    u.failedAttempts = 0; u.lockUntil = null; u.lastLogin = Date.now(); saveUsers();
    return json(res, 200, { token: newSession(u), user: publicUser(u) });
  }

  const me = authUser(req);
  if (route === 'GET /api/me') return me ? json(res, 200, { user: publicUser(me) }) : json(res, 401, { error: 'Sessão expirada.' });
  if (route === 'POST /api/logout') {
    const h = req.headers.authorization || '';
    if (h.startsWith('Bearer ')) { delete sessions[h.slice(7)]; saveSessions(); }
    return json(res, 200, { ok: true });
  }
  if (!me) return json(res, 401, { error: 'Sessão expirada.' });

  if (route === 'POST /api/upload') {
    const mime = String(req.headers['content-type'] || '').split(';')[0].trim();
    const isAudio = !!AUDIO_TYPES[mime];
    if (!IMG_TYPES[mime] && !isAudio) return json(res, 415, { error: 'Envie imagem (PNG, JPG, GIF, WEBP) ou áudio (MP3, OGG, WAV, M4A, FLAC).' });
    if (isAudio && me.role !== 'gm') return json(res, 403, { error: 'Só o Mestre envia músicas.' });
    try {
      const buf = await readBody(req, isAudio ? MAX_AUDIO : MAX_UPLOAD);
      return json(res, 200, { url: storeImage(buf, mime) });
    } catch { return json(res, 413, { error: isAudio ? 'Áudio grande demais (máx. 80 MB).' : 'Imagem grande demais (máx. 25 MB).' }); }
  }

  if (me.role !== 'gm') return json(res, 403, { error: 'Só o Mestre.' });

  if (route === 'GET /api/players') return json(res, 200, { players: users.filter(u => u.role === 'player').map(publicUser), online: online() });
  const m = /^POST \/api\/players\/([^/]+)\/(approve|block|unblock|reset|remove)$/.exec(route);
  if (m) {
    const u = users.find(x => x.id === decodeURIComponent(m[1]) && x.role === 'player');
    if (!u) return json(res, 404, { error: 'Jogador não encontrado.' });
    const action = m[2];
    if (action === 'approve' || action === 'unblock') { u.approved = true; u.active = true; u.failedAttempts = 0; u.lockUntil = null; }
    if (action === 'block') { u.active = false; dropSessionsOf(u.id); }
    if (action === 'reset') {
      const { password } = await readJsonBody(req);
      if (!validPass(password)) return json(res, 400, { error: 'A senha precisa ter de 6 a 128 caracteres.' });
      Object.assign(u, hashPassword(password)); u.failedAttempts = 0; u.lockUntil = null; dropSessionsOf(u.id);
    }
    if (action === 'remove') { dropSessionsOf(u.id); users = users.filter(x => x.id !== u.id); }
    saveUsers();
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Rota desconhecida.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, baseHeaders()); return res.end(); }
    if (url.pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOADS, decodeURIComponent(url.pathname.slice('/uploads/'.length)));
      if (file && await serveFile(res, file, 'public, max-age=31536000, immutable', req)) return;
      res.writeHead(404, baseHeaders()); return res.end();
    }
    if (!fs.existsSync(path.join(BUILD, 'index.html'))) {
      res.writeHead(503, baseHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }));
      return res.end('A versão compilada não existe. Rode "npm run mesa" (ou "npm run build").');
    }
    const rel = decodeURIComponent(url.pathname);
    const file = safeJoin(BUILD, rel === '/' ? 'index.html' : rel.slice(1));
    const cache = rel.startsWith('/static/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    if (file && await serveFile(res, file, cache, req)) return;
    await serveFile(res, path.join(BUILD, 'index.html'), 'no-cache'); // SPA
  } catch (e) {
    if (!res.headersSent) json(res, 500, { error: 'Erro interno.' });
    console.error(e);
  }
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_WS });
wss.on('connection', onSocket);
setInterval(() => {
  for (const c of clients) { if (!c.alive) { c.ws.terminate(); continue; } c.alive = false; c.ws.ping(); }
}, 30000).unref();

function shutdown() { try { flushAll(); } catch (e) { console.error(e); } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);   // Windows: fechar a janela do terminal
process.on('SIGBREAK', shutdown); // Windows: Ctrl+Break

server.listen(PORT, HOST, () => {
  const nets = Object.values(os.networkInterfaces()).flat().filter(n => n && n.family === 'IPv4' && !n.internal);
  console.log(`\n  Mesa do Crepúsculo no ar (porta ${PORT})`);
  console.log(`  Neste computador:  http://localhost:${PORT}`);
  for (const n of nets) console.log(`  Na rede:           http://${n.address}:${PORT}`);
  console.log(`  Dados em: ${DATA}`);
  if (!hasGM()) console.log('\n  Primeira vez: abra http://localhost:' + PORT + ' NESTE computador e crie a conta do Mestre.');
  console.log('  Ctrl+C para encerrar (o estado é salvo antes de sair).\n');
});

export { server };
