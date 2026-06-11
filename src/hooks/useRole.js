import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ROLE_KEY         = 'vtt-role';
const NAME_KEY         = 'vtt-player-name';
const PLAYERS_AUTH_KEY = 'vtt-players-auth';

const SALT = 'crepusculo-salt-2024';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 60_000;

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function loadAuthRecords() {
  try { return JSON.parse(localStorage.getItem(PLAYERS_AUTH_KEY) ?? '[]'); }
  catch { return []; }
}

function saveAuthRecords(records) {
  localStorage.setItem(PLAYERS_AUTH_KEY, JSON.stringify(records));
}

export const RoleContext = createContext(null);

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: 'gm', playerName: '', isGM: true, players: [], playerRecords: [],
      enterGM: () => {}, enterPlayer: () => {}, clearRole: () => {},
      registerPlayer: async () => ({ ok: false, error: 'No provider' }),
      loginPlayer: async () => ({ ok: false, error: 'No provider' }),
      resetPlayerPassword: async () => {},
      blockPlayer: () => {}, unblockPlayer: () => {}, removePlayerAuth: () => {},
      canControlToken: () => true, canEditToken: () => true,
      canSeeToken: () => true, canUseTool: () => true,
      previewAs: null, isPreviewMode: false, startPreview: () => {}, stopPreview: () => {},
    };
  }
  return ctx;
}

export function RoleProvider({ children }) {
  const [role,          setRole]          = useState(() => localStorage.getItem(ROLE_KEY) ?? null);
  const [playerName,    setPlayerName]    = useState(() => localStorage.getItem(NAME_KEY) ?? '');
  const [playerRecords, setPlayerRecords] = useState(loadAuthRecords);

  const recordsRef = useRef(playerRecords);
  const syncRecords = useCallback((next) => {
    const val = typeof next === 'function' ? next(recordsRef.current) : next;
    recordsRef.current = val;
    setPlayerRecords(val);
    saveAuthRecords(val);
  }, []);

  const players = playerRecords.filter(r => r.isActive).map(r => r.name);

  const enterGM = useCallback(() => {
    setRole('gm');
    localStorage.setItem(ROLE_KEY, 'gm');
  }, []);

  const clearRole = useCallback(() => {
    setRole(null);
    setPlayerName('');
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(NAME_KEY);
  }, []);

  const registerPlayer = useCallback(async (name, password) => {
    const n = name.trim();
    if (!n) return { ok: false, error: 'Nome inválido.' };
    const existing = recordsRef.current.find(r => r.name.toLowerCase() === n.toLowerCase());
    if (existing) return { ok: false, error: 'Nome já cadastrado. Faça login.' };
    const passwordHash = await hashPassword(password);
    const record = {
      id: `player-${Date.now()}`,
      name: n,
      passwordHash,
      createdAt: Date.now(),
      lastLogin: null,
      isActive: true,
      failedAttempts: 0,
      lockUntil: null,
    };
    syncRecords(prev => [...prev, record]);
    setRole('player');
    setPlayerName(n);
    localStorage.setItem(ROLE_KEY, 'player');
    localStorage.setItem(NAME_KEY, n);
    return { ok: true };
  }, [syncRecords]);

  const loginPlayer = useCallback(async (name, password) => {
    const n = name.trim();
    const record = recordsRef.current.find(r => r.name.toLowerCase() === n.toLowerCase());
    if (!record) return { ok: false, error: 'Jogador não encontrado.' };
    if (!record.isActive) return { ok: false, error: 'Conta bloqueada pelo Mestre.' };
    if (record.lockUntil && Date.now() < record.lockUntil) {
      const secs = Math.ceil((record.lockUntil - Date.now()) / 1000);
      return { ok: false, error: `Muitas tentativas. Aguarde ${secs}s.` };
    }
    const hash = await hashPassword(password);
    if (hash !== record.passwordHash) {
      const failed = (record.failedAttempts ?? 0) + 1;
      const lockUntil = failed >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
      syncRecords(prev => prev.map(r => r.id === record.id
        ? { ...r, failedAttempts: failed, lockUntil }
        : r
      ));
      if (lockUntil) return { ok: false, error: `Senha incorreta. Conta bloqueada por 1 minuto.` };
      return { ok: false, error: `Senha incorreta. ${MAX_ATTEMPTS - failed} tentativa(s) restante(s).` };
    }
    syncRecords(prev => prev.map(r => r.id === record.id
      ? { ...r, lastLogin: Date.now(), failedAttempts: 0, lockUntil: null }
      : r
    ));
    setRole('player');
    setPlayerName(record.name);
    localStorage.setItem(ROLE_KEY, 'player');
    localStorage.setItem(NAME_KEY, record.name);
    return { ok: true };
  }, [syncRecords]);

  const resetPlayerPassword = useCallback(async (name, newPassword) => {
    const hash = await hashPassword(newPassword);
    syncRecords(prev => prev.map(r => r.name === name
      ? { ...r, passwordHash: hash, failedAttempts: 0, lockUntil: null }
      : r
    ));
  }, [syncRecords]);

  const blockPlayer = useCallback((name) => {
    syncRecords(prev => prev.map(r => r.name === name ? { ...r, isActive: false } : r));
  }, [syncRecords]);

  const unblockPlayer = useCallback((name) => {
    syncRecords(prev => prev.map(r => r.name === name ? { ...r, isActive: true, failedAttempts: 0, lockUntil: null } : r));
  }, [syncRecords]);

  const removePlayerAuth = useCallback((name) => {
    syncRecords(prev => prev.filter(r => r.name !== name));
  }, [syncRecords]);

  const isGM = role === 'gm';
  const [previewAs, setPreviewAs] = useState(null);
  const isPreviewMode = isGM && previewAs !== null;
  const startPreview = useCallback((name) => setPreviewAs(name), []);
  const stopPreview  = useCallback(() => setPreviewAs(null), []);

  const canControlToken = useCallback((token) => {
    if (role === 'gm') return true;
    return token.owner === playerName;
  }, [role, playerName]);

  const canEditToken = useCallback((token) => {
    if (role === 'gm') return true;
    return token.owner === playerName;
  }, [role, playerName]);

  const canSeeToken = useCallback((token) => {
    if (role === 'gm' && previewAs !== null) {
      if (token.hidden) return false;
      if (token.owner === previewAs) return true;
      return token.visibleToAll !== false;
    }
    if (role === 'gm') return true;
    if (token.hidden) return false;
    if (token.owner === playerName) return true;
    return token.visibleToAll !== false;
  }, [role, playerName, previewAs]);

  const canUseTool = useCallback((toolName) => {
    if (role === 'gm') return true;
    return ['select', 'measure'].includes(toolName);
  }, [role]);

  return (
    <RoleContext.Provider value={{
      role, playerName, isGM, players, playerRecords,
      enterGM, clearRole,
      registerPlayer, loginPlayer,
      resetPlayerPassword, blockPlayer, unblockPlayer, removePlayerAuth,
      canControlToken, canEditToken, canSeeToken, canUseTool,
      previewAs, isPreviewMode, startPreview, stopPreview,
    }}>
      {children}
    </RoleContext.Provider>
  );
}
