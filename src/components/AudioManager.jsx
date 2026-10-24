import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  getCtx,
  sfxDiceRoll, sfxHit, sfxCritical, sfxHeal, sfxDeath, sfxTurnBell, sfxCombatStart,
  toggleAmbient, stopAllAmbients, isAmbientPlaying, setAmbientVolume,
} from '../utils/sfx';
import { sync, getToken } from '../sync/client';

// Playlist antiga (antes da mesa sincronizada), usada só para migrar.
const OLD_PLAYLIST_KEY = 'crepusculo-vtt-playlist';
const PREFS_KEY = 'vtt-audio-prefs';

// Ambientes sintetizados no navegador (sem arquivo). Os gravados são enviados pelo Mestre.
const AMBIENTS = [
  { id: 'rain',    label: '🌧 Chuva'    },
  { id: 'fire',    label: '🔥 Fogueira' },
  { id: 'forest',  label: '🌲 Floresta' },
  { id: 'dungeon', label: '💀 Masmorra' },
  { id: 'ocean',   label: '🌊 Mar'      },
  { id: 'battle',  label: '⚔ Batalha'  },
];

const SFX_BUTTONS = [
  { type: 'dice',        label: '🎲', title: 'Dado'     },
  { type: 'hit',         label: '💥', title: 'Impacto'  },
  { type: 'critical',    label: '⚡', title: 'Crítico'  },
  { type: 'heal',        label: '💚', title: 'Cura'     },
  { type: 'death',       label: '💀', title: 'Morte'    },
  { type: 'turnStart',   label: '🔔', title: 'Turno'    },
  { type: 'combatStart', label: '⚔', title: 'Combate'  },
];

const SFX_FNS = {
  dice:        sfxDiceRoll,
  hit:         sfxHit,
  critical:    sfxCritical,
  heal:        sfxHeal,
  death:       sfxDeath,
  turnStart:   sfxTurnBell,
  combatStart: sfxCombatStart,
};

const AUDIO_EXT_TYPES = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  aac: 'audio/aac', webm: 'audio/webm', flac: 'audio/flac' };

// Estado de áudio compartilhado pela mesa (fica no estado sincronizado; só o Mestre altera).
// playlist: faixas { id, name, url } (arquivo no servidor) ou { id, name, videoId } (YouTube).
// startedAt: hora do servidor em que a faixa estaria no segundo 0 (vale quando playing);
// pausedAt: posição em segundos quando pausada. ambients: id → volume (sintetizados e gravados).
export function makeDefaultAudio(withOldPlaylist = false) {
  let playlist = [];
  if (withOldPlaylist) {
    try { playlist = JSON.parse(localStorage.getItem(OLD_PLAYLIST_KEY)) ?? []; } catch { playlist = []; }
  }
  return { playlist, current: null, playing: false, startedAt: 0, pausedAt: 0, loop: false, ambients: {}, ambientTracks: [] };
}

function getYouTubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/|\/shorts\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function loadPrefs() {
  const def = { musicVol: 80, sfxOn: true, sfxVol: 0.7, ambVol: 1, muted: false };
  try { return { ...def, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {}) }; } catch { return def; }
}

const serverNow = () => Date.now() + (sync.timeOffset ?? 0);
// registro curto para diagnóstico (window.__vttAudio.log())
const audioLog = [];
const logAudio = (...x) => { audioLog.push(`${new Date().toISOString().slice(11, 23)} ${x.join(' ')}`); if (audioLog.length > 40) audioLog.shift(); };
function positionOf(a) {
  if (!a) return 0;
  return a.playing ? Math.max(0, (serverNow() - (a.startedAt ?? 0)) / 1000) : (a.pausedAt ?? 0);
}

async function uploadAudio(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = file.type && file.type.startsWith('audio/') ? file.type : AUDIO_EXT_TYPES[ext];
  if (!type) return { error: `${file.name}: formato não suportado.` };
  try {
    const res = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': type, Authorization: `Bearer ${getToken()}` }, body: file });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: `${file.name}: ${data.error || `erro ${res.status}`}` };
    return { url: data.url, name: file.name.replace(/\.[^.]+$/, '') };
  } catch { return { error: `${file.name}: sem conexão com o servidor.` }; }
}

// ── YouTube singleton ─────────────────────────────────────────────────────────
let _ytReady = false;
let _ytReadyCbs = [];

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) { _ytReady = true; return; }
  if (document.getElementById('yt-api-script')) return;
  window.onYouTubeIframeAPIReady = () => {
    _ytReady = true;
    _ytReadyCbs.forEach(cb => cb());
    _ytReadyCbs = [];
  };
  const tag = document.createElement('script');
  tag.id = 'yt-api-script';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function onYTReady(cb) {
  if (_ytReady) { cb(); return; }
  _ytReadyCbs.push(cb);
}

// ── Component ─────────────────────────────────────────────────────────────────
const AudioManager = forwardRef(function AudioManager({ active, audio, setAudio, isGM }, ref) {
  const canEdit = isGM && !!setAudio;
  const a = audio ?? makeDefaultAudio();
  const playlist = a.playlist ?? [];
  const ambientTracks = a.ambientTracks ?? [];
  const currentTrack = playlist.find(t => t.id === a.current) ?? null;

  // ── Preferências locais (cada pessoa ajusta o próprio volume) ───────────────
  const [prefs, setPrefs] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* sem storage */ }
  }, [prefs]);
  const setPref = (k, v) => setPrefs(p => ({ ...p, [k]: v }));

  const [ytReady,   setYtReady]   = useState(false);
  const [ytError,   setYtError]   = useState(null);  // videoId bloqueado pelo YouTube neste navegador
  const [blocked,   setBlocked]   = useState(false); // navegador pediu um clique antes de tocar som
  const [busy,      setBusy]      = useState('');
  const [notice,    setNotice]    = useState('');
  const [urlInput,  setUrlInput]  = useState('');
  const [nameInput, setNameInput] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState('');

  const playerRef  = useRef(null);   // YT.Player
  const ytDivRef   = useRef(null);
  const loadedRef  = useRef(null);   // videoId carregado no player do YouTube
  const musicElRef = useRef(null);   // <audio> das músicas em arquivo
  const ambElsRef  = useRef(new Map()); // ambientes gravados: id → <audio>
  const audioRef   = useRef(a);
  const setAudioRef = useRef(setAudio);
  const canEditRef = useRef(canEdit);
  audioRef.current = a;
  setAudioRef.current = setAudio;
  canEditRef.current = canEdit;

  // ── Efeitos sonoros ─────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    playEffect(type) {
      logAudio('sfx', type);
      const p = prefsRef.current;
      if (!p.sfxOn || p.muted) return;
      getCtx();
      SFX_FNS[type]?.(p.sfxVol);
    },
  }), []);

  // Fim da faixa: só o Mestre decide o que vem depois (repete ou próxima).
  const advanceRef = useRef(null);
  advanceRef.current = () => {
    if (!canEditRef.current) return;
    const cur = audioRef.current;
    if (cur.loop) { setAudioRef.current(x => ({ ...x, startedAt: serverNow(), playing: true })); return; }
    const pl = cur.playlist ?? [];
    const i = pl.findIndex(t => t.id === cur.current);
    const next = pl.length ? pl[(i + 1) % pl.length] : null;
    setAudioRef.current(x => ({ ...x, current: next?.id ?? null, playing: !!next, startedAt: serverNow(), pausedAt: 0 }));
  };

  // ── YouTube ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadYouTubeAPI();
    onYTReady(() => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(ytDivRef.current, {
        height: '0', width: '0',
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady() {
            setYtReady(true);
            // leitura para diagnóstico: window.__vttAudio.state()
            window.__vttAudio = {
              state: () => playerRef.current?.getPlayerState?.(),
              time: () => playerRef.current?.getCurrentTime?.(),
              video: () => playerRef.current?.getVideoData?.()?.video_id,
              file: () => { const el = musicElRef.current; return el ? { src: el.dataset.src, paused: el.paused, time: el.currentTime, duration: el.duration } : null; },
              shared: () => { const { playlist, ...rest } = audioRef.current; return { ...rest, faixas: (playlist ?? []).length }; },
              pos: () => positionOf(audioRef.current),
              offset: () => sync.timeOffset,
              log: () => audioLog.slice(),
              amb: () => [...ambElsRef.current].map(([id, el]) => ({ id, paused: el.paused, volume: +el.volume.toFixed(2), time: +el.currentTime.toFixed(1) })),
            };
          },
          onError() { setYtError(loadedRef.current); },
          onStateChange(e) {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) { setBlocked(false); setYtError(null); }
            else if (e.data === S.ENDED) advanceRef.current();
          },
        },
      });
    });
    const ambEls = ambElsRef.current;
    return () => {
      stopAllAmbients();
      musicElRef.current?.pause();
      for (const el of ambEls.values()) el.pause();
    };
  }, []);

  // ── Reconciliação: o que toca aqui segue o estado da mesa ───────────────────
  const reconcile = useCallback(() => {
    const cur = audioRef.current;
    const pr = prefsRef.current;
    const track = (cur.playlist ?? []).find(t => t.id === cur.current) ?? null;
    const pos = positionOf(cur);
    const musicVol = pr.muted ? 0 : pr.musicVol / 100;
    const tryPlay = (el) => el.play().catch(err => { if (err?.name === 'NotAllowedError') setBlocked(true); });

    // música em arquivo
    const fileTrack = track && track.url ? track : null;
    if (fileTrack) {
      let el = musicElRef.current;
      if (!el) {
        el = new Audio();
        el.preload = 'auto';
        el.addEventListener('ended', () => { logAudio('ended', el.currentTime.toFixed(1)); advanceRef.current(); });
        el.addEventListener('playing', () => setBlocked(false));
        musicElRef.current = el;
      }
      el.volume = musicVol;
      if (el.dataset.src !== fileTrack.url) {
        el.dataset.src = fileTrack.url;
        el.src = fileTrack.url;
        logAudio('src', fileTrack.url.slice(-12), 'pos', pos.toFixed(1), 'playing', cur.playing, 'startedAt', cur.startedAt);
        el.addEventListener('loadedmetadata', () => {
          const p = positionOf(audioRef.current);
          logAudio('metadata dur', el.duration, 'pos', p.toFixed(1));
          if (Number.isFinite(el.duration) && p < el.duration) el.currentTime = p;
        }, { once: true });
        if (cur.playing) tryPlay(el);
      } else {
        if (el.readyState >= 1 && Math.abs(el.currentTime - pos) > 2 && Number.isFinite(el.duration) && pos < el.duration) {
          logAudio('seek', el.currentTime.toFixed(1), '->', pos.toFixed(1));
          el.currentTime = pos;
        }
        if (cur.playing && el.paused) tryPlay(el);
        if (!cur.playing && !el.paused) el.pause();
      }
    } else if (musicElRef.current?.dataset.src) {
      const el = musicElRef.current;
      el.pause(); el.removeAttribute('src'); el.dataset.src = ''; el.load();
    }

    // música do YouTube
    const p = playerRef.current;
    const ytTrack = track && !track.url && track.videoId ? track : null;
    if (p && ytReady) {
      p.setVolume?.(pr.muted ? 0 : pr.musicVol);
      if (!ytTrack) {
        if (loadedRef.current) { p.stopVideo?.(); loadedRef.current = null; }
      } else if (loadedRef.current !== ytTrack.videoId) {
        loadedRef.current = ytTrack.videoId;
        setYtError(null);
        if (cur.playing) p.loadVideoById({ videoId: ytTrack.videoId, startSeconds: pos });
        else p.cueVideoById({ videoId: ytTrack.videoId, startSeconds: pos });
      } else {
        const S = window.YT.PlayerState;
        const st = p.getPlayerState?.();
        const t = p.getCurrentTime?.() ?? 0;
        if (cur.playing) {
          if (Math.abs(t - pos) > 3) p.seekTo(pos, true);
          if (st !== S.PLAYING && st !== S.BUFFERING) p.playVideo();
        } else {
          if (st === S.PLAYING || st === S.BUFFERING) p.pauseVideo();
          if (Math.abs(t - pos) > 2) p.seekTo(pos, true);
        }
      }
    }

    // ambientes sintetizados
    const ambs = cur.ambients ?? {};
    const synthWanted = !pr.muted && AMBIENTS.some(am => ambs[am.id] != null);
    if (synthWanted && getCtx().state === 'suspended') setBlocked(true);
    for (const am of AMBIENTS) {
      const want = !pr.muted && ambs[am.id] != null;
      const vol = (ambs[am.id] ?? 0.5) * pr.ambVol;
      if (want !== isAmbientPlaying(am.id)) toggleAmbient(am.id, vol);
      else if (want) setAmbientVolume(am.id, vol);
    }

    // ambientes gravados (arquivos, em loop)
    const els = ambElsRef.current;
    const tracks = cur.ambientTracks ?? [];
    for (const [id, el] of els) if (!tracks.some(t => t.id === id)) { el.pause(); els.delete(id); }
    for (const t of tracks) {
      let el = els.get(t.id);
      if (!el) { el = new Audio(t.url); el.loop = true; el.preload = 'auto'; els.set(t.id, el); }
      const want = !pr.muted && ambs[t.id] != null;
      el.volume = Math.max(0, Math.min(1, (ambs[t.id] ?? 0.5) * pr.ambVol));
      if (want && el.paused) tryPlay(el);
      if (!want && !el.paused) el.pause();
    }
  }, [ytReady]);

  useEffect(() => { reconcile(); }, [audio, prefs, ytReady, reconcile]);

  // Confere de vez em quando se o som está tocando como deveria (ex.: navegador bloqueou).
  useEffect(() => {
    const t = setInterval(() => {
      const cur = audioRef.current;
      const track = (cur.playlist ?? []).find(x => x.id === cur.current);
      if (!cur.playing || !track || prefsRef.current.muted) return;
      if (track.url && musicElRef.current?.paused) setBlocked(true);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const unblock = () => {
    getCtx();
    setBlocked(false);
    musicElRef.current?.play?.().catch(() => {});
    playerRef.current?.playVideo?.();
    reconcile();
  };

  // ── Controles do Mestre ─────────────────────────────────────────────────────
  const edit = useCallback((fn) => { if (canEditRef.current) { getCtx(); setAudioRef.current(x => fn(x ?? makeDefaultAudio())); } }, []);

  const playTrack = (id) => edit(x => ({ ...x, current: id, playing: true, startedAt: serverNow(), pausedAt: 0 }));
  const togglePlay = () => edit(x => {
    if (x.playing) return { ...x, playing: false, pausedAt: positionOf(x) };
    if (!x.current && (x.playlist ?? []).length) return { ...x, current: x.playlist[0].id, playing: true, startedAt: serverNow(), pausedAt: 0 };
    return { ...x, playing: true, startedAt: serverNow() - (x.pausedAt ?? 0) * 1000 };
  });
  const stopMusic = () => edit(x => ({ ...x, playing: false, current: null, pausedAt: 0 }));
  const addYouTube = () => {
    const vid = getYouTubeId(urlInput.trim());
    if (!vid) { setNotice('Link do YouTube inválido.'); return; }
    const name = nameInput.trim() || `Faixa ${(a.playlist ?? []).length + 1}`;
    edit(x => ({ ...x, playlist: [...(x.playlist ?? []), { id: `yt-${Date.now()}`, videoId: vid, name }] }));
    setUrlInput(''); setNameInput(''); setNotice('');
  };
  const addFiles = async (files, kind) => {
    const list = [...files];
    if (!list.length) return;
    const errors = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(`Enviando ${i + 1} de ${list.length}…`);
      const r = await uploadAudio(list[i]);
      if (r.error) { errors.push(r.error); continue; }
      const id = `${kind === 'amb' ? 'amb' : 'au'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      if (kind === 'amb') edit(x => ({ ...x, ambientTracks: [...(x.ambientTracks ?? []), { id, name: r.name, url: r.url }] }));
      else edit(x => ({ ...x, playlist: [...(x.playlist ?? []), { id, name: r.name, url: r.url }] }));
    }
    setBusy('');
    setNotice(errors.join(' '));
  };
  const removeTrack = (id) => edit(x => ({
    ...x,
    playlist: (x.playlist ?? []).filter(t => t.id !== id),
    ...(x.current === id ? { current: null, playing: false, pausedAt: 0 } : {}),
  }));
  const saveEditName = (id) => {
    edit(x => ({ ...x, playlist: (x.playlist ?? []).map(t => (t.id === id ? { ...t, name: editName.trim() || t.name } : t)) }));
    setEditingId(null);
  };
  const toggleAmb = (id) => edit(x => {
    const ambients = { ...(x.ambients ?? {}) };
    if (ambients[id] != null) delete ambients[id]; else ambients[id] = 0.5;
    return { ...x, ambients };
  });
  const setAmbVol = (id, v) => edit(x => ({ ...x, ambients: { ...(x.ambients ?? {}), [id]: v } }));
  const removeAmbTrack = (id) => edit(x => {
    const ambients = { ...(x.ambients ?? {}) };
    delete ambients[id];
    return { ...x, ambients, ambientTracks: (x.ambientTracks ?? []).filter(t => t.id !== id) };
  });
  const playSfxForAll = (type) => {
    getCtx();
    const p = prefsRef.current;
    if (p.sfxOn && !p.muted) SFX_FNS[type]?.(p.sfxVol);
    sync.sendEvent({ kind: 'sfx', type });
  };

  const isPlaying = a.playing && !!currentTrack;
  const allAmbs = [...AMBIENTS.map(x => ({ ...x, synth: true })), ...ambientTracks.map(t => ({ id: t.id, label: `🎧 ${t.name}`, synth: false }))];
  const activeAmbs = allAmbs.filter(x => (a.ambients ?? {})[x.id] != null);
  const ytBlockedHere = currentTrack?.videoId && !currentTrack.url && ytError === currentTrack.videoId;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {blocked && !prefs.muted && (
        <button
          className="tbtn"
          onClick={unblock}
          style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9000, borderColor: 'var(--gold)', color: 'var(--gold)',
            padding: '8px 14px', fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,0.6)' }}
          title="O navegador só toca som depois de um clique na página"
        >
          🔊 Clique para ouvir o som da mesa
        </button>
      )}

      <div style={{
        display: active ? 'flex' : 'none',
        flexDirection: 'column', flex: 1, overflowY: 'auto',
        padding: '10px 12px', gap: 16,
      }}>
        <div ref={ytDivRef} style={{ display: 'none' }} />

        {/* ── 🎚 Meu volume (local) ── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <SectionLabel style={{ margin: 0 }}>🎚 Meu volume</SectionLabel>
            <button className={`tbtn${prefs.muted ? ' active' : ''}`} onClick={() => setPref('muted', !prefs.muted)}
              style={{ fontSize: 10, padding: '2px 8px' }}>
              {prefs.muted ? '🔇 Mudo' : '🔊 Som'}
            </button>
          </div>
          <LabeledRow label="Música">
            <VolumeRow value={prefs.musicVol} min={0} max={100} step={1} onChange={v => setPref('musicVol', v)} label={`${prefs.musicVol}%`} />
          </LabeledRow>
          <LabeledRow label="Ambiente">
            <VolumeRow value={prefs.ambVol} min={0} max={1} step={0.01} onChange={v => setPref('ambVol', v)} label={`${Math.round(prefs.ambVol * 100)}%`} />
          </LabeledRow>
          <LabeledRow label="Efeitos">
            <VolumeRow value={prefs.sfxVol} min={0} max={1} step={0.01} onChange={v => setPref('sfxVol', v)} label={`${Math.round(prefs.sfxVol * 100)}%`} />
            <button className={`tbtn${prefs.sfxOn ? ' active' : ''}`} onClick={() => setPref('sfxOn', !prefs.sfxOn)}
              style={{ fontSize: 10, padding: '2px 8px', marginLeft: 4 }}>{prefs.sfxOn ? 'ON' : 'OFF'}</button>
          </LabeledRow>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 4, lineHeight: 1.5 }}>
            Só vale para você. {canEdit ? 'O que toca para todos é controlado abaixo.' : 'O Mestre escolhe o que toca.'}
          </div>
        </section>

        {/* ── 🎵 Música ── */}
        <section>
          <SectionLabel>🎵 Música {canEdit ? '(toca para toda a mesa)' : ''}</SectionLabel>

          {!canEdit && (
            <div style={{ fontSize: 12, color: isPlaying ? 'var(--gold)' : 'var(--sub)' }}>
              {currentTrack ? `${isPlaying ? '▶' : '⏸'} ${currentTrack.name}` : 'Nenhuma música tocando.'}
            </div>
          )}
          {ytBlockedHere && (
            <div style={{ fontSize: 11, color: '#e0a040', marginTop: 4, lineHeight: 1.5 }}>
              ⚠ O YouTube bloqueou esta faixa neste computador. Use músicas em arquivo.
            </div>
          )}

          {canEdit && (
            <>
              <label className="tbtn" style={{ display: 'block', textAlign: 'center', marginBottom: 6, cursor: 'pointer' }}>
                📁 Enviar músicas (MP3, OGG, WAV, M4A, FLAC)
                <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac" multiple style={{ display: 'none' }}
                  onChange={e => { addFiles(e.target.files, 'music'); e.target.value = ''; }} />
              </label>
              {busy && <div style={{ fontSize: 11, color: 'var(--gold)', marginBottom: 6 }}>{busy}</div>}
              {notice && <div style={{ fontSize: 11, color: '#e05555', marginBottom: 6, lineHeight: 1.5 }}>{notice}</div>}

              <details style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: 11, color: 'var(--sub)', cursor: 'pointer' }}>Adicionar do YouTube</summary>
                <div style={{ fontSize: 10, color: '#e0a040', margin: '4px 0', lineHeight: 1.5 }}>
                  ⚠ Muitas músicas do YouTube não tocam para quem entra pelo IP (o YouTube bloqueia). Prefira arquivos.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <input className="vtt-input" placeholder="URL do YouTube" value={urlInput}
                    onChange={e => setUrlInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addYouTube(); }} />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input className="vtt-input" placeholder="Nome (opcional)" value={nameInput} style={{ flex: 1 }}
                      onChange={e => setNameInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addYouTube(); }} />
                    <button className="tbtn" onClick={addYouTube} style={{ flexShrink: 0 }}>+ Adicionar</button>
                  </div>
                </div>
              </details>

              {playlist.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <button className="tbtn" onClick={togglePlay} style={{ fontSize: 14, padding: '3px 10px', minWidth: 36 }}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className="tbtn" onClick={stopMusic} title="Parar" style={{ fontSize: 12, padding: '3px 8px' }}>⏹</button>
                  <button className={`tbtn${a.loop ? ' active' : ''}`} onClick={() => edit(x => ({ ...x, loop: !x.loop }))}
                    title="Repetir a faixa" style={{ fontSize: 12, padding: '3px 8px' }}>♻</button>
                  <span style={{ fontSize: 11, color: 'var(--sub)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentTrack ? currentTrack.name : ''}
                  </span>
                </div>
              )}

              {playlist.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--sub)' }}>Nenhuma faixa. Envie arquivos de música acima.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {playlist.map(track => {
                    const isCurrent = track.id === a.current;
                    return (
                      <div key={track.id} style={{
                        display: 'flex', alignItems: 'center', gap: 5, background: 'var(--card)',
                        border: `1px solid ${isCurrent ? 'var(--gold)' : 'var(--border)'}`, borderRadius: 4, padding: '5px 7px',
                      }}>
                        <button className="tbtn" onClick={() => (isCurrent ? togglePlay() : playTrack(track.id))}
                          style={{ fontSize: 12, padding: '2px 7px', flexShrink: 0, minWidth: 28 }}>
                          {isCurrent && isPlaying ? '⏸' : '▶'}
                        </button>
                        {editingId === track.id ? (
                          <input className="vtt-input" style={{ flex: 1, fontSize: 11 }} value={editName} autoFocus
                            onChange={e => setEditName(e.target.value)} onBlur={() => saveEditName(track.id)}
                            onKeyDown={e => { if (e.key === 'Enter') saveEditName(track.id); if (e.key === 'Escape') setEditingId(null); }} />
                        ) : (
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: isCurrent ? 'var(--gold)' : 'var(--text)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
                            onDoubleClick={() => { setEditingId(track.id); setEditName(track.name); }} title="Duplo clique para renomear">
                            {track.url ? '🎵' : '▶️'} {track.name}
                          </span>
                        )}
                        <button onClick={() => removeTrack(track.id)} title="Remover"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 12, padding: '0 2px', flexShrink: 0 }}>
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── 🔉 Efeitos Sonoros (Mestre) ── */}
        {canEdit && (
          <section>
            <SectionLabel>🔉 Efeitos Sonoros (para todos)</SectionLabel>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SFX_BUTTONS.map(({ type, label, title }) => (
                <button key={type} className="tbtn" title={title} onClick={() => playSfxForAll(type)} style={{ fontSize: 15, padding: '4px 8px' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 6, lineHeight: 1.5 }}>
              Os efeitos tocam sozinhos para toda a mesa ao rolar dados, aplicar dano, curar, morte, turno e início de combate.
            </div>
          </section>
        )}

        {/* ── 🌧 Ambiente ── */}
        <section>
          <SectionLabel>🌧 Ambiente {canEdit ? '(para todos)' : ''}</SectionLabel>
          {canEdit ? (
            <>
              <label className="tbtn" style={{ display: 'block', textAlign: 'center', marginBottom: 6, cursor: 'pointer' }}>
                📁 Enviar sons de ambiente (tocam em loop)
                <input type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.flac" multiple style={{ display: 'none' }}
                  onChange={e => { addFiles(e.target.files, 'amb'); e.target.value = ''; }} />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {allAmbs.map(am => (
                  <span key={am.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <button className={`tbtn${(a.ambients ?? {})[am.id] != null ? ' active' : ''}`}
                      onClick={() => toggleAmb(am.id)} style={{ fontSize: 11, padding: '4px 8px' }}
                      title={am.synth ? 'Som sintetizado (sem arquivo)' : 'Som enviado'}>
                      {am.label}
                    </button>
                    {!am.synth && (
                      <button onClick={() => removeAmbTrack(am.id)} title="Remover"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', fontSize: 11, padding: '0 3px' }}>✕</button>
                    )}
                  </span>
                ))}
              </div>
              {activeAmbs.map(am => (
                <LabeledRow key={am.id} label={am.label}>
                  <VolumeRow value={a.ambients[am.id]} min={0} max={1} step={0.01} onChange={v => setAmbVol(am.id, v)}
                    label={`${Math.round(a.ambients[am.id] * 100)}%`} />
                </LabeledRow>
              ))}
              <div style={{ fontSize: 10, color: 'var(--sub)', lineHeight: 1.5 }}>
                Os botões sem 🎧 são sons sintetizados; os 🎧 são arquivos enviados (soam melhor).
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--sub)' }}>
              {activeAmbs.length ? activeAmbs.map(am => am.label).join(' · ') : 'Nenhum ambiente tocando.'}
            </div>
          )}
        </section>
      </div>
    </>
  );
});

// ── Helper components ─────────────────────────────────────────────────────────

function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 6,
      ...style,
    }}>
      {children}
    </div>
  );
}

function LabeledRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text)', flexShrink: 0, width: 76, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function VolumeRow({ value, min, max, step, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
      <input
        type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--gold)', height: 3, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 10, color: 'var(--sub)', width: 30, textAlign: 'right', flexShrink: 0 }}>
        {label}
      </span>
    </div>
  );
}

export default AudioManager;
