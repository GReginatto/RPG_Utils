import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { api, getToken, sync } from '../sync/client';

// Contas e sessão vêm do servidor da mesa (server/index.js); nada de senha no navegador.

export const RoleContext = createContext(null);

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: 'gm', playerName: '', isGM: true, players: [], playerRecords: [], loading: false,
      clearRole: () => {}, setupGM: async () => ({ ok: false }),
      registerPlayer: async () => ({ ok: false, error: 'No provider' }),
      loginPlayer: async () => ({ ok: false, error: 'No provider' }),
      resetPlayerPassword: async () => {}, approvePlayer: () => {},
      blockPlayer: () => {}, unblockPlayer: () => {}, removePlayerAuth: () => {},
      canControlToken: () => true, canEditToken: () => true,
      canSeeToken: () => true, canUseTool: () => true,
      previewAs: null, isPreviewMode: false, startPreview: () => {}, stopPreview: () => {},
    };
  }
  return ctx;
}

export function RoleProvider({ children }) {
  const [user,          setUser]          = useState(null);
  const [loading,       setLoading]       = useState(() => !!getToken());
  const [playerRecords, setPlayerRecords] = useState([]);

  const role = user?.role ?? null;
  const playerName = user?.name ?? '';

  // sessão salva: confere com o servidor
  useEffect(() => {
    if (!getToken()) return;
    api.me().then(r => { if (r.ok) setUser(r.user); setLoading(false); });
  }, []);

  // sessão expirada (ex.: Mestre bloqueou ou trocou a senha)
  useEffect(() => sync.subscribe(s => { if (s.status === 'expired') setUser(null); }), []);

  const refreshPlayers = useCallback(async () => {
    const r = await api.players();
    if (r.ok) setPlayerRecords(r.players);
  }, []);
  useEffect(() => {
    if (role !== 'gm') { setPlayerRecords([]); return undefined; }
    refreshPlayers();
    const h = () => refreshPlayers();
    window.addEventListener('vtt-players-changed', h);
    return () => window.removeEventListener('vtt-players-changed', h);
  }, [role, refreshPlayers]);

  const players = playerRecords.filter(r => r.isActive).map(r => r.name);

  const clearRole = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const setupGM = useCallback(async (name, password) => {
    const r = await api.setup(name, password);
    if (r.ok) setUser(r.user);
    return r;
  }, []);

  const registerPlayer = useCallback(async (name, password) => {
    const r = await api.register(name, password);
    if (!r.ok) return r;
    return { ok: true, pending: true };
  }, []);

  const loginPlayer = useCallback(async (name, password) => {
    const r = await api.login(name, password);
    if (r.ok) setUser(r.user);
    return r;
  }, []);

  const act = useCallback(async (name, action, body) => {
    const rec = playerRecords.find(r => r.name === name);
    if (!rec) return { ok: false };
    const r = await api.playerAction(rec.id, action, body);
    await refreshPlayers();
    return r;
  }, [playerRecords, refreshPlayers]);
  const resetPlayerPassword = useCallback((name, pw) => act(name, 'reset', { password: pw }), [act]);
  const approvePlayer   = useCallback((name) => act(name, 'approve'), [act]);
  const blockPlayer     = useCallback((name) => act(name, 'block'), [act]);
  const unblockPlayer   = useCallback((name) => act(name, 'unblock'), [act]);
  const removePlayerAuth = useCallback((name) => act(name, 'remove'), [act]);

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
      role, playerName, isGM, players, playerRecords, loading, user,
      clearRole, setupGM,
      registerPlayer, loginPlayer,
      resetPlayerPassword, approvePlayer, blockPlayer, unblockPlayer, removePlayerAuth,
      canControlToken, canEditToken, canSeeToken, canUseTool,
      previewAs, isPreviewMode, startPreview, stopPreview,
    }}>
      {children}
    </RoleContext.Provider>
  );
}
