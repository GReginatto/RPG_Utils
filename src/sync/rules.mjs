// Regras de visibilidade e permissão da mesa sincronizada.
// O Mestre vê e altera tudo. O jogador recebe uma visão filtrada e só pode
// alterar o que é dele. Usado pelo servidor (e pelos testes).
import { getAt } from './jsonPatch.mjs';

const lc = (s) => String(s ?? '').trim().toLowerCase();
const isOwner = (item, player) => !!item && lc(item.owner) === lc(player) && lc(player) !== '';

// ── Visibilidade ──────────────────────────────────────────────────────────────
function canSeeToken(t, player) {
  if (!t) return false;
  if (isOwner(t, player)) return true;
  if (t.hidden) return false;
  return t.visibleToAll !== false;
}

function canSeeSheet(s, player) {
  if (!s) return false;
  if (s.isPublic || isOwner(s, player)) return true;
  return (s.sharedWith ?? []).some(n => lc(n) === lc(player));
}

function canSeeMessage(m, player, ownedNames) {
  if (!m || m.type !== 'whisper') return true;
  if (lc(m.authorAccount) === lc(player)) return true;
  const target = lc(m.whisperTarget);
  return target === lc(player) || ownedNames.has(target);
}

function sceneStub(sc) {
  return {
    id: sc.id, name: sc.name, createdAt: sc.createdAt, gridSize: sc.gridSize, hexGrid: sc.hexGrid,
    mapImage: null, tokens: [], walls: [], fog: { enabled: false, revealedCells: [] }, markers: [],
    paintedCells: {}, aoes: [], drawings: [], tiles: [], weather: 'none', notes: '', partyPositions: {},
  };
}

function filterScene(sc, player) {
  return {
    ...sc,
    notes: '',
    tokens: (sc.tokens ?? []).filter(t => canSeeToken(t, player)),
    walls: (sc.walls ?? []).filter(w => !w.secret),
  };
}

const PLAYER_HIDDEN_ROOTS = new Set(['compendiumEntries']);

// Visão de um jogador para uma chave de topo do estado.
function viewRoot(state, key, player) {
  const v = state[key];
  if (PLAYER_HIDDEN_ROOTS.has(key)) return Array.isArray(v) ? [] : v;
  switch (key) {
    case 'scenes':
      return (v ?? []).map(sc => (sc.id === state.activeSceneId ? filterScene(sc, player) : sceneStub(sc)));
    case 'partyTokens':
      return (v ?? []).filter(t => canSeeToken(t, player));
    case 'sheets':
      return (v ?? []).filter(s => canSeeSheet(s, player));
    case 'chatMessages': {
      const owned = new Set(allTokens(state).filter(t => isOwner(t, player)).map(t => lc(t.name)));
      return (v ?? []).filter(m => canSeeMessage(m, player, owned));
    }
    default:
      return v;
  }
}

function allTokens(state) {
  const active = (state.scenes ?? []).find(s => s.id === state.activeSceneId);
  return [...(state.partyTokens ?? []), ...(active?.tokens ?? [])];
}

function viewFor(state, user) {
  if (user.role === 'gm') return state;
  const out = {};
  for (const k of Object.keys(state)) out[k] = viewRoot(state, k, user.name);
  return out;
}

// Chaves cuja visão depende de outra chave (ex.: trocar a cena ativa muda o que se vê de scenes).
function dependentRoots(roots) {
  const r = new Set(roots);
  if (r.has('activeSceneId')) r.add('scenes');
  if (r.has('scenes') || r.has('partyTokens') || r.has('activeSceneId')) r.add('chatMessages');
  return r;
}

// ── Permissão de escrita do jogador ──────────────────────────────────────────
const PLAYER_FREE_ROOTS = new Set(['log', 'initiativeOrder', 'currentTurnIndex', 'currentRound']);
const SCENE_FREE_KEYS = new Set(['drawings', 'aoes', 'markers']);
const TOKEN_LOCKED = ['owner', 'hidden', 'visibleToAll'];

function tokenOpAllowed(op, list, rest, player) {
  // rest = caminho a partir da lista de tokens
  if (rest.length === 0) {
    if (op.op === 'upsert') {
      const cur = list?.find(t => String(t.id) === String(op.value?.id));
      if (cur) return isOwner(cur, player) && TOKEN_LOCKED.every(k => cur[k] === op.value[k]);
      return isOwner(op.value, player) && !op.value.hidden;
    }
    if (op.op === 'remove') return isOwner(list?.find(t => String(t.id) === String(op.id)), player);
    return op.op === 'order';
  }
  const seg = rest[0];
  if (typeof seg !== 'object') return false;
  const tok = list?.find(t => String(t.id) === String(seg.id));
  if (!isOwner(tok, player)) return false;
  if (rest.length === 1) return op.op !== 'set' || (op.value && TOKEN_LOCKED.every(k => tok[k] === op.value[k]));
  return !TOKEN_LOCKED.includes(rest[1]);
}

function ownedItemOpAllowed(op, list, rest, player, lockOwner = true) {
  if (rest.length === 0) {
    if (op.op === 'upsert') {
      const cur = list?.find(x => String(x.id) === String(op.value?.id));
      if (cur) return isOwner(cur, player) && (!lockOwner || lc(op.value.owner) === lc(cur.owner));
      return isOwner(op.value, player);
    }
    if (op.op === 'remove') return isOwner(list?.find(x => String(x.id) === String(op.id)), player);
    return op.op === 'order';
  }
  const seg = rest[0];
  if (typeof seg !== 'object') return false;
  const item = list?.find(x => String(x.id) === String(seg.id));
  if (!isOwner(item, player)) return false;
  return !(lockOwner && rest[1] === 'owner') && !(rest.length === 1 && op.op === 'set' && lockOwner && lc(op.value?.owner) !== lc(item.owner));
}

function playerOpAllowed(op, state, player) {
  const p = op.path ?? [];
  const root = p[0];
  if (typeof root !== 'string') return false;
  if (PLAYER_FREE_ROOTS.has(root)) return true;
  if (root === 'chatMessages') {
    const list = state.chatMessages ?? [];
    if (p.length === 1) {
      if (op.op === 'upsert') {
        const cur = list.find(m => String(m.id) === String(op.value?.id));
        return !cur || lc(cur.authorAccount) === lc(player);
      }
      if (op.op === 'remove') {
        const cur = list.find(m => String(m.id) === String(op.id));
        return !cur || lc(cur.authorAccount) === lc(player) || list.length > 200;
      }
      return op.op === 'order';
    }
    const cur = getAt(state, p.slice(0, 2));
    return !!cur && lc(cur.authorAccount) === lc(player) && p[2] !== 'authorAccount';
  }
  if (root === 'partyTokens') return tokenOpAllowed(op, state.partyTokens, p.slice(1), player);
  if (root === 'sheets') return ownedItemOpAllowed(op, state.sheets, p.slice(1), player);
  if (root === 'macros') return ownedItemOpAllowed(op, state.macros, p.slice(1), player);
  if (root === 'scenes') {
    if (p.length < 3 || typeof p[1] !== 'object') return false;
    if (String(p[1].id) !== String(state.activeSceneId)) return false;
    const scene = getAt(state, p.slice(0, 2));
    if (!scene) return false;
    if (SCENE_FREE_KEYS.has(p[2])) return true;
    if (p[2] === 'tokens') return tokenOpAllowed(op, scene.tokens, p.slice(3), player);
    return false;
  }
  return false;
}

// Marca a autoria das mensagens novas de chat (o servidor é quem sabe quem enviou).
function stampOp(op, user) {
  if (op.path?.[0] === 'chatMessages' && op.path.length === 1 && op.op === 'upsert' && op.value && typeof op.value === 'object') {
    return { ...op, value: { ...op.value, authorAccount: user.name } };
  }
  return op;
}

export { viewFor, viewRoot, dependentRoots, playerOpAllowed, stampOp, canSeeToken, canSeeSheet };
