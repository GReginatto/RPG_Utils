import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  getCtx,
  sfxDiceRoll, sfxHit, sfxCritical, sfxHeal, sfxDeath, sfxTurnBell, sfxCombatStart,
  toggleAmbient, stopAllAmbients, isAmbientPlaying, setAmbientVolume,
} from '../utils/sfx';

const PLAYLIST_KEY = 'crepusculo-vtt-playlist';

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

function getYouTubeId(url) {
  const match = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/v\/)([\w-]{11})/);
  return match ? match[1] : null;
}

function loadPlaylist() {
  try { return JSON.parse(localStorage.getItem(PLAYLIST_KEY)) ?? []; }
  catch { return []; }
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
const AudioManager = forwardRef(function AudioManager({ active }, ref) {
  // ── SFX state ────────────────────────────────────────────────────────────────
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume,  setSfxVolume]  = useState(0.7);
  const sfxEnabledRef = useRef(true);
  const sfxVolumeRef  = useRef(0.7);
  useEffect(() => { sfxEnabledRef.current = sfxEnabled; }, [sfxEnabled]);
  useEffect(() => { sfxVolumeRef.current  = sfxVolume;  }, [sfxVolume]);

  // ── Ambient state ─────────────────────────────────────────────────────────────
  const [activeAmbs,  setActiveAmbs]  = useState(new Set());
  const [ambVolumes,  setAmbVolumes]  = useState(
    Object.fromEntries(AMBIENTS.map(a => [a.id, 0.5]))
  );

  // ── Music / YouTube state ─────────────────────────────────────────────────────
  const [playlist,     setPlaylist]     = useState(loadPlaylist);
  const [currentIdx,   setCurrentIdx]   = useState(null);
  const [ytState,      setYtState]      = useState('unstarted'); // 'unstarted'|'playing'|'paused'|'ended'
  const [musicVolume,  setMusicVolume]  = useState(80);          // 0–100
  const [loopMusic,    setLoopMusic]    = useState(false);
  const [urlInput,     setUrlInput]     = useState('');
  const [nameInput,    setNameInput]    = useState('');
  const [editingId,    setEditingId]    = useState(null);
  const [editName,     setEditName]     = useState('');

  const playerRef    = useRef(null); // YT.Player instance
  const ytDivRef     = useRef(null);
  const musicVolRef  = useRef(80);
  const loopRef      = useRef(false);
  const currentIdxRef = useRef(null);

  useEffect(() => { musicVolRef.current   = musicVolume; }, [musicVolume]);
  useEffect(() => { loopRef.current       = loopMusic;   }, [loopMusic]);
  useEffect(() => { currentIdxRef.current = currentIdx;  }, [currentIdx]);

  // Persist playlist
  useEffect(() => {
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(playlist));
  }, [playlist]);

  // ── Expose playEffect to parent ───────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    playEffect(type) {
      if (!sfxEnabledRef.current) return;
      getCtx();
      const fn = SFX_FNS[type];
      if (fn) fn(sfxVolumeRef.current);
    },
  }), []);

  // ── YouTube setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    loadYouTubeAPI();
    onYTReady(() => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(ytDivRef.current, {
        height: '0', width: '0',
        playerVars: { autoplay: 0, controls: 0, rel: 0, modestbranding: 1 },
        events: {
          onReady(e) {
            e.target.setVolume(musicVolRef.current);
          },
          onStateChange(e) {
            const s = e.data;
            if (s === window.YT.PlayerState.PLAYING) setYtState('playing');
            else if (s === window.YT.PlayerState.PAUSED) setYtState('paused');
            else if (s === window.YT.PlayerState.ENDED) {
              setYtState('ended');
              if (loopRef.current) {
                e.target.seekTo(0);
                e.target.playVideo();
              } else {
                // advance to next track
                setCurrentIdx(prev => {
                  const pl = JSON.parse(localStorage.getItem(PLAYLIST_KEY) ?? '[]');
                  if (!pl.length) return null;
                  const next = prev !== null ? (prev + 1) % pl.length : 0;
                  e.target.loadVideoById(pl[next].videoId);
                  return next;
                });
              }
            }
          },
        },
      });
    });
    return () => { stopAllAmbients(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync volume to player when slider changes
  useEffect(() => {
    playerRef.current?.setVolume?.(musicVolume);
  }, [musicVolume]);

  // ── Music controls ────────────────────────────────────────────────────────────
  const playTrack = useCallback((idx) => {
    const track = playlist[idx];
    if (!track || !playerRef.current) return;
    getCtx();
    playerRef.current.loadVideoById(track.videoId);
    playerRef.current.setVolume(musicVolRef.current);
    setCurrentIdx(idx);
    setYtState('playing');
  }, [playlist]);

  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (ytState === 'playing') {
      playerRef.current.pauseVideo();
    } else {
      if (currentIdx === null && playlist.length > 0) {
        playTrack(0);
      } else {
        playerRef.current.playVideo();
      }
    }
  }, [ytState, currentIdx, playlist, playTrack]);

  const addTrack = useCallback(() => {
    const id = getYouTubeId(urlInput.trim());
    if (!id) return;
    const name = nameInput.trim() || `Faixa ${Date.now()}`;
    const newTrack = { id: `yt-${Date.now()}`, videoId: id, name };
    setPlaylist(prev => [...prev, newTrack]);
    setUrlInput('');
    setNameInput('');
  }, [urlInput, nameInput]);

  const removeTrack = useCallback((trackId) => {
    setPlaylist(prev => {
      const idx = prev.findIndex(t => t.id === trackId);
      const next = prev.filter(t => t.id !== trackId);
      if (currentIdxRef.current === idx) {
        playerRef.current?.stopVideo?.();
        setCurrentIdx(null);
        setYtState('unstarted');
      } else if (currentIdxRef.current > idx) {
        setCurrentIdx(i => i - 1);
      }
      return next;
    });
  }, []);

  const saveEditName = useCallback((trackId) => {
    setPlaylist(prev => prev.map(t => t.id === trackId ? { ...t, name: editName.trim() || t.name } : t));
    setEditingId(null);
  }, [editName]);

  // ── Ambient controls ──────────────────────────────────────────────────────────
  const handleToggleAmb = useCallback((id) => {
    getCtx();
    const vol = ambVolumes[id] ?? 0.5;
    const nowPlaying = toggleAmbient(id, vol);
    setActiveAmbs(prev => {
      const next = new Set(prev);
      if (nowPlaying) next.add(id); else next.delete(id);
      return next;
    });
  }, [ambVolumes]);

  const handleAmbVolume = useCallback((id, vol) => {
    setAmbVolumes(prev => ({ ...prev, [id]: vol }));
    if (isAmbientPlaying(id)) setAmbientVolume(id, vol);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: active ? 'flex' : 'none',
      flexDirection: 'column', flex: 1, overflowY: 'auto',
      padding: '10px 12px', gap: 16,
    }}>

      {/* Hidden YouTube player div */}
      <div ref={ytDivRef} style={{ display: 'none' }} />

      {/* ── 🎵 Música ── */}
      <section>
        <SectionLabel>🎵 Música</SectionLabel>

        {/* Add track */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          <input
            className="vtt-input"
            placeholder="URL do YouTube"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTrack(); }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              className="vtt-input"
              placeholder="Nome (opcional)"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTrack(); }}
              style={{ flex: 1 }}
            />
            <button className="tbtn" onClick={addTrack} style={{ flexShrink: 0 }}>
              + Adicionar
            </button>
          </div>
        </div>

        {/* Player controls */}
        {playlist.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <button
              className="tbtn"
              onClick={togglePlay}
              style={{ fontSize: 14, padding: '3px 10px', minWidth: 36 }}
            >
              {ytState === 'playing' ? '⏸' : '▶'}
            </button>
            <button
              className={`tbtn${loopMusic ? ' active' : ''}`}
              onClick={() => setLoopMusic(v => !v)}
              title="Loop"
              style={{ fontSize: 12, padding: '3px 8px' }}
            >
              ♻
            </button>
            <div style={{ flex: 1 }}>
              <VolumeRow
                value={musicVolume}
                min={0} max={100} step={1}
                onChange={setMusicVolume}
                label={`${musicVolume}%`}
              />
            </div>
          </div>
        )}

        {/* Playlist */}
        {playlist.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>
            Nenhuma faixa. Cole uma URL do YouTube acima.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {playlist.map((track, idx) => {
              const isCurrent = idx === currentIdx;
              return (
                <div
                  key={track.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'var(--card)',
                    border: `1px solid ${isCurrent ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 4, padding: '5px 7px',
                  }}
                >
                  <button
                    className="tbtn"
                    onClick={() => isCurrent ? togglePlay() : playTrack(idx)}
                    style={{ fontSize: 12, padding: '2px 7px', flexShrink: 0, minWidth: 28 }}
                  >
                    {isCurrent && ytState === 'playing' ? '⏸' : '▶'}
                  </button>

                  {editingId === track.id ? (
                    <input
                      className="vtt-input"
                      style={{ flex: 1, fontSize: 11 }}
                      value={editName}
                      autoFocus
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => saveEditName(track.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEditName(track.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1, minWidth: 0, fontSize: 11, color: isCurrent ? 'var(--gold)' : 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text',
                      }}
                      onDoubleClick={() => { setEditingId(track.id); setEditName(track.name); }}
                      title="Duplo clique para renomear"
                    >
                      {track.name}
                    </span>
                  )}

                  <button
                    onClick={() => removeTrack(track.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--sub)', fontSize: 12, padding: '0 2px', flexShrink: 0,
                    }}
                    title="Remover"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 🔉 Efeitos Sonoros ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <SectionLabel style={{ margin: 0 }}>🔉 Efeitos Sonoros</SectionLabel>
          <button
            className={`tbtn${sfxEnabled ? ' active' : ''}`}
            onClick={() => setSfxEnabled(v => !v)}
            style={{ fontSize: 10, padding: '2px 8px' }}
          >
            {sfxEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        <div style={{ marginBottom: 6 }}>
          <VolumeRow
            value={sfxVolume}
            min={0} max={1} step={0.01}
            onChange={setSfxVolume}
            label={`${Math.round(sfxVolume * 100)}%`}
          />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {SFX_BUTTONS.map(({ type, label, title }) => (
            <button
              key={type}
              className="tbtn"
              title={title}
              onClick={() => { getCtx(); SFX_FNS[type]?.(sfxVolume); }}
              style={{ fontSize: 15, padding: '4px 8px' }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 6, lineHeight: 1.5 }}>
          SFX disparam automaticamente ao rolar dados, aplicar dano, curar, morte, turno e início de combate.
        </div>
      </section>

      {/* ── 🌧 Ambiente ── */}
      <section>
        <SectionLabel>🌧 Ambiente</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {AMBIENTS.map(a => (
            <button
              key={a.id}
              className={`tbtn${activeAmbs.has(a.id) ? ' active' : ''}`}
              onClick={() => handleToggleAmb(a.id)}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Volume sliders for active ambients */}
        {AMBIENTS.filter(a => activeAmbs.has(a.id)).map(a => (
          <div
            key={a.id}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
          >
            <span style={{
              fontSize: 11, color: 'var(--text)', flexShrink: 0, width: 76,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {a.label}
            </span>
            <VolumeRow
              value={ambVolumes[a.id] ?? 0.5}
              min={0} max={1} step={0.01}
              onChange={v => handleAmbVolume(a.id, v)}
              label={`${Math.round((ambVolumes[a.id] ?? 0.5) * 100)}%`}
            />
          </div>
        ))}

        {activeAmbs.size === 0 && (
          <div style={{ fontSize: 11, color: 'var(--sub)' }}>
            Clique nos botões acima para ativar sons de ambiente empilháveis.
          </div>
        )}
      </section>
    </div>
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
