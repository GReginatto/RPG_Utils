// Cliente da mesa sincronizada: API HTTP (contas) e conexão WebSocket (estado).
import { diff, apply } from './jsonPatch.mjs';

const TOKEN_KEY = 'vtt-session';

// Em desenvolvimento (npm start na porta 3000) o servidor fica na 3001.
const DEV = window.location.port === '3000';
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.hostname}:${DEV ? 3001 : window.location.port || (window.location.protocol === 'https:' ? 443 : 80)}/ws`;

export function getToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }
function setToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch { /* sem storage */ } }

export async function apiCall(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 0, error: 'Servidor da mesa fora do ar. Peça ao Mestre para iniciá-lo.' };
  }
  let data = {};
  try { data = await res.json(); } catch { /* resposta vazia */ }
  return { ok: res.ok, status: res.status, ...data, error: res.ok ? undefined : (data.error || `Erro ${res.status}`) };
}

export const api = {
  status: () => apiCall('GET', '/api/status'),
  me: () => apiCall('GET', '/api/me'),
  async setup(name, password) { const r = await apiCall('POST', '/api/setup', { name, password }); if (r.ok) setToken(r.token); return r; },
  async login(name, password) { const r = await apiCall('POST', '/api/login', { name, password }); if (r.ok) setToken(r.token); return r; },
  register: (name, password) => apiCall('POST', '/api/register', { name, password }),
  async logout() { await apiCall('POST', '/api/logout'); setToken(null); sync.close(); },
  players: () => apiCall('GET', '/api/players'),
  playerAction: (id, action, body) => apiCall('POST', `/api/players/${encodeURIComponent(id)}/${action}`, body),
};

// ── Conexão de sincronização (uma por aba) ──────────────────────────────────
class SyncClient {
  constructor() {
    this.ws = null;
    this.snapshot = null;        // último estado combinado com o servidor
    this.initial = null;         // estado para o primeiro render da mesa
    this.status = 'idle';        // idle | connecting | waiting | online | offline
    this.online = [];
    this.listeners = new Set();
    this.getLocal = null;        // () => estado atual da mesa (buildSaveState)
    this.applyRemote = null;     // (novoEstado, raízesAlteradas) => void
    this.onEvent = null;
    this.retry = 0;
    this.closedByUser = false;
    this.pending = null;
  }
  get active() { return this.status === 'online' && !!this.snapshot; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }
  setStatus(s) { this.status = s; this.emit(); }

  connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    this.closedByUser = false;
    this.setStatus(this.snapshot ? 'offline' : 'connecting');
    const ws = new WebSocket(WS_URL);
    this.ws = ws;
    ws.onopen = () => { this.retry = 0; ws.send(JSON.stringify({ type: 'auth', token: getToken() })); };
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handle(m); };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (e.code === 4001) { setToken(null); this.setStatus('expired'); return; }
      if (this.closedByUser) return;
      this.setStatus(this.snapshot ? 'offline' : 'connecting');
      const delay = Math.min(10000, 500 * 2 ** this.retry++);
      setTimeout(() => this.connect(), delay);
    };
  }
  close() { this.closedByUser = true; this.snapshot = null; this.initial = null; if (this.ws) this.ws.close(); this.ws = null; this.setStatus('idle'); }

  handle(m) {
    if (m.type === 'wait') { this.setStatus('waiting'); return; }
    if (m.type === 'presence') { this.online = m.online || []; this.emit(); return; }
    if (m.type === 'players-changed') { this.emit(); window.dispatchEvent(new Event('vtt-players-changed')); return; }
    if (m.type === 'event') { this.onEvent?.(m.event); return; }
    if (m.type === 'init') {
      const first = !this.initial;
      this.you = m.you;
      if (m.empty) {
        // mesa nova: o Mestre envia o que tem no navegador (sessão local antiga ou mesa vazia)
        this.snapshot = {};
        if (first) this.initial = { local: true };
      } else {
        this.snapshot = m.state;
        if (first) this.initial = { state: m.state };
        else this.applyRemote?.(m.state, null);
      }
      this.setStatus('online');
      if (!first) this.flush();
      return;
    }
    if (m.type === 'ops' && this.snapshot) {
      this.flush(); // manda antes o que ainda não foi enviado, para não perder edição local
      const prev = this.snapshot;
      this.snapshot = apply(this.snapshot, m.ops);
      const roots = new Set(m.ops.map(o => o.path[0]));
      this.applyRemote?.(this.snapshot, roots, prev);
    }
  }

  // Compara o estado local com o último combinado e envia só a diferença.
  flush() {
    if (!this.active || !this.getLocal || !this.ws || this.ws.readyState !== 1) return;
    clearTimeout(this.pending); this.pending = null;
    const cur = this.getLocal();
    if (!cur) return;
    const ops = diff(this.snapshot, cur);
    if (!ops.length) return;
    this.snapshot = cur;
    this.ws.send(JSON.stringify({ type: 'ops', ops }));
  }
  schedule(ms = 90) {
    if (this.pending) return;
    this.pending = setTimeout(() => { this.pending = null; this.flush(); }, ms);
  }
  sendEvent(event) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'event', event })); }
  resync() { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ type: 'resync' })); }
}

export const sync = new SyncClient();
