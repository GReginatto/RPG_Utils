import { useState, useRef, useCallback, useEffect } from 'react';
import { useCamera } from './hooks/useCamera';
import { useTokens } from './hooks/useTokens';
import { useParty, MAX_PARTY } from './hooks/useParty';
import { useScenes, makeScene } from './hooks/useScenes';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSheets } from './hooks/useSheets';
import { rollDice } from './utils/dice';
import { GRID } from './utils/constants';
import MapCanvas from './components/MapCanvas';
import Sidebar from './components/Sidebar';
import ShortcutOverlay from './components/ShortcutOverlay';
import PartyStatsOverlay from './components/PartyStatsOverlay';
import CharacterSheet from './components/CharacterSheet';
import SceneManager from './components/SceneManager';
import ActionBar from './components/AoeSystem';
import { useAoe, makeAoe, getAffectedTokens } from './hooks/useAoe';
import { useRole } from './hooks/useRole';
import { RoleBadge, LockedTool } from './components/PlayerView';
import { isMovementBlocked, sanitizeWalls, isDoorOnWall, splitWallAroundDoor } from './utils/collision';
import { useDrawing } from './hooks/useDrawing';
import { usePing } from './components/PingSystem';
import { TilePanel } from './components/TileLayer';
import MacroBar, { runMacroCommands } from './components/MacroBar';
import { processEffectsOnTurnStart } from './components/ActiveEffects';
import GMPanel from './components/GMPanel';

const { cols: COLS, rows: ROWS } = GRID;

function findNearestFree(tx, ty, occupied) {
  for (let r = 1; r <= 5; r++) {
    for (let ddx = -r; ddx <= r; ddx++) {
      for (let ddy = -r; ddy <= r; ddy++) {
        if (Math.abs(ddx) !== r && Math.abs(ddy) !== r) continue;
        const x = tx + ddx, y = ty + ddy;
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS && !occupied.has(`${x},${y}`)) return { x, y };
      }
    }
  }
  return null;
}

const STATE_KEY = 'crepusculo-vtt';

function loadSaved() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0a10; --panel: #12121c; --card: #1a1a28; --border: #2a2a3a;
    --gold: #c9a96e; --gold-dim: #8a7a50; --text: #d8d0c4; --sub: #7a7468;
  }
  html, body { height: 100%; overflow: hidden; background: var(--bg); }
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: var(--text); }

  .tbtn {
    background: var(--card); border: 1px solid var(--border); color: var(--text);
    padding: 5px 12px; border-radius: 4px; cursor: pointer;
    font-size: 12px; font-family: inherit; white-space: nowrap;
    line-height: 1.4; transition: border-color 0.12s, color 0.12s; flex-shrink: 0;
  }
  .tbtn:hover { border-color: var(--gold); }
  .tbtn.active { border-color: var(--gold); color: var(--gold); }

  .ctx-menu {
    position: fixed; z-index: 1000;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 6px; padding: 4px 0; min-width: 150px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.65); user-select: none;
  }
  .ctx-btn {
    display: block; width: 100%; background: none; border: none;
    color: var(--text); padding: 7px 16px; text-align: left;
    cursor: pointer; font-size: 12px; font-family: inherit; white-space: nowrap;
    transition: background 0.08s, color 0.08s;
  }
  .ctx-btn:hover { background: var(--card); color: var(--gold); }
  .ctx-btn.danger:hover { color: #e05555; }
  .ctx-sep { height: 1px; background: var(--border); margin: 4px 0; }

  .sidebar-tab {
    flex: 1; padding: 8px 4px; background: none; border: none;
    color: var(--sub); cursor: pointer; font-size: 11px; font-family: inherit;
    border-bottom: 2px solid transparent;
    transition: color 0.12s, border-color 0.12s;
    white-space: nowrap; overflow: hidden;
  }
  .sidebar-tab:hover { color: var(--text); }
  .sidebar-tab.active { color: var(--gold); border-bottom-color: var(--gold); }

  .token-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.08s, border-color 0.08s;
    user-select: none;
  }
  .token-row:hover { background: var(--card); }
  .token-row.selected { border-left-color: var(--gold); background: rgba(201,169,110,0.07); }

  .vtt-input {
    background: var(--card); border: 1px solid var(--border); color: var(--text);
    border-radius: 3px; padding: 4px 6px; font-size: 12px; font-family: inherit;
    width: 100%; outline: none; transition: border-color 0.12s;
  }
  .vtt-input:focus { border-color: var(--gold); }
  .vtt-select {
    background: var(--card); border: 1px solid var(--border); color: var(--text);
    border-radius: 3px; padding: 4px 6px; font-size: 12px; font-family: inherit;
    width: 100%; outline: none; transition: border-color 0.12s;
    appearance: none; -webkit-appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237a7468'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 8px center;
    padding-right: 24px;
  }
  .vtt-select:focus { border-color: var(--gold); }
  .vtt-label {
    color: var(--sub); font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.5px; display: block; margin-bottom: 3px;
  }

  .cond-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 3px; padding: 2px 6px; font-size: 10px;
    color: var(--text); cursor: pointer; font-family: inherit;
    transition: border-color 0.1s, color 0.1s;
  }
  .cond-chip:hover { border-color: #e05555; color: #e05555; }

  @keyframes tokenShake {
    0%,100% { transform: translateX(0); }
    20%      { transform: translateX(-5px); }
    45%      { transform: translateX(5px); }
    65%      { transform: translateX(-4px); }
    85%      { transform: translateX(4px); }
  }
  @keyframes combatPulse {
    0%,100% { box-shadow: 0 0 0 3px var(--gold), 0 0 10px rgba(201,169,110,0.45), 0 2px 8px rgba(0,0,0,0.7); }
    50%     { box-shadow: 0 0 0 3px var(--gold), 0 0 26px rgba(201,169,110,0.85), 0 2px 8px rgba(0,0,0,0.7); }
  }
  @keyframes targetPulse {
    0%,100% { opacity: 0.7; transform: scale(1); }
    50%     { opacity: 1;   transform: scale(1.08); }
  }
  @keyframes condPulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.55; }
  }
  @keyframes overloadPulse {
    0%,100% { box-shadow: 0 0 8px rgba(196,48,48,0.4), 0 2px 8px rgba(0,0,0,0.55); }
    50%     { box-shadow: 0 0 18px rgba(196,48,48,0.85), 0 2px 8px rgba(0,0,0,0.55); }
  }
  @keyframes phaseShimmer {
    0%,100% { opacity: 1;    filter: brightness(1); }
    50%     { opacity: 0.55; filter: brightness(1.4) hue-rotate(20deg); }
  }
  @keyframes toastIn {
    0%   { opacity: 0; transform: translateX(-50%) translateY(-10px); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes feedbackIn {
    0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
    100% { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes diceSpin {
    0%   { transform: rotate(0deg)   scale(1);   }
    25%  { transform: rotate(90deg)  scale(1.2); }
    50%  { transform: rotate(180deg) scale(1);   }
    75%  { transform: rotate(270deg) scale(1.2); }
    100% { transform: rotate(360deg) scale(1);   }
  }
  @keyframes auraPulse {
    0%, 100% { opacity: 0.25; }
    50%       { opacity: 0.48; }
  }
  @keyframes auraHueShift {
    0%   { filter: hue-rotate(0deg);   opacity: 0.32; }
    50%  { filter: hue-rotate(180deg); opacity: 0.48; }
    100% { filter: hue-rotate(360deg); opacity: 0.32; }
  }
  @keyframes floatUp {
    0%   { opacity: 1;   transform: translateX(-50%) translateY(0); }
    100% { opacity: 0;   transform: translateX(-50%) translateY(-44px); }
  }
  @keyframes pingRipple {
    0%   { width: 0;    height: 0;    opacity: 0.9; }
    100% { width: 80px; height: 80px; opacity: 0; }
  }
  @keyframes timerPulse {
    0%,100% { opacity: 1; }
    50%     { opacity: 0.35; }
  }
`;

function rollInitiativeFor(token) {
  const dex = token.attributes?.DEX ?? 10;
  const mod = Math.floor((dex - 10) / 2);
  return rollDice(3, 8, mod).total;
}

export default function TabletopMap() {
  const [savedState] = useState(loadSaved);
  const {
    isGM, playerName: rolePlayerName, clearRole, players,
    previewAs, isPreviewMode, startPreview, stopPreview,
  } = useRole();

  // ── Determine initial format (new scene-based vs legacy) ──────────────────
  const _hasScenes = Array.isArray(savedState.scenes) && savedState.scenes.length > 0;
  const _initScene = _hasScenes
    ? (savedState.scenes.find(s => s.id === savedState.activeSceneId) ?? savedState.scenes[0])
    : null;

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef     = useRef(null);
  const fileInputRef     = useRef(null);
  const importFileRef    = useRef(null);
  const toolRef          = useRef('select');
  const toastTimer       = useRef(null);
  const feedbackTimer    = useRef(null);
  const isMounted        = useRef(false);
  const audioManagerRef  = useRef(null);
  const partyOrderRef    = useRef([]);
  const isSwitchingRef   = useRef(false);
  const hasCreatedSheetRef = useRef(false);

  // Scene-state refs (for reading stale-safe inside switchScene timeout)
  const bgImageRef      = useRef(null);
  const fogEnabledRef2  = useRef(false);
  const revealedCellsRef2 = useRef(new Set());
  const markersRef2     = useRef([]);
  const paintedCellsRef2 = useRef({});
  const weatherRef2     = useRef('none');

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const sheetState = useSheets(savedState.sheets ?? []);
  const camera     = useCamera(containerRef);
  const sceneManager = useScenes(
    _hasScenes ? savedState.scenes : undefined,
    _hasScenes ? savedState.activeSceneId : undefined,
  );
  const tokenState = useTokens(_hasScenes
    ? [...(savedState.partyTokens ?? []), ...(_initScene?.tokens ?? [])]
    : (savedState.tokens ?? [])
  );
  const party      = useParty();
  const aoeState     = useAoe(_initScene?.aoes ?? []);
  const drawingState = useDrawing(_initScene?.drawings ?? []);
  const { pings, addPing } = usePing();

  // ── Map state ──────────────────────────────────────────────────────────────
  const [tool,          setTool]          = useState('select');
  const [aimingMode,        setAimingMode]        = useState(null);
  const [showTechniqueMenu, setShowTechniqueMenu] = useState(false);
  const aimingModeRef2 = useRef(null);
  useEffect(() => { aimingModeRef2.current = aimingMode; }, [aimingMode]);

  // ── Walls & lighting state ─────────────────────────────────────────────────
  const [walls,          setWalls]          = useState(() => sanitizeWalls(_initScene?.walls ?? []));
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [blockedWallId,  setBlockedWallId]  = useState(null);
  const showWalls = true;
  const [lightingEnabled, setLightingEnabled] = useState(true);
  const [playerView,     setPlayerView]     = useState(false);

  // ── Role ref (stale-closure safety) ───────────────────────────────────────
  const isGMRef = useRef(isGM);
  useEffect(() => { isGMRef.current = isGM; }, [isGM]);
  const playerNameRef = useRef(rolePlayerName);
  useEffect(() => { playerNameRef.current = rolePlayerName; }, [rolePlayerName]);

  const [showGrid,      setShowGrid]      = useState(savedState.showGrid ?? true);
  const [bgImage,       setBgImage]       = useState(
    _initScene ? (_initScene.mapImage ?? null) : (savedState.bgImage ?? null)
  );
  const [fading,        setFading]        = useState(false);
  const [sidebarOpen,   setSidebarOpen]   = useState(true);
  const [activeTab,     setActiveTab]     = useState('tokens');
  const [ctxMenu,       setCtxMenu]       = useState(null);
  const [aoeCtxMenu,    setAoeCtxMenu]    = useState(null); // { x, y, items[] }
  const [toast,           setToast]           = useState(null);
  const [feedbackToast,   setFeedbackToast]   = useState(null);
  const [showShortcuts,   setShowShortcuts]   = useState(false);
  const [showGMPanel,     setShowGMPanel]     = useState(false);
  const [topModal,        setTopModal]        = useState(null);
  const [showPartyOverlay, setShowPartyOverlay] = useState(false);
  const [openSheetIds,    setOpenSheetIds]    = useState([]);
  const [customConditions,  setCustomConditions]  = useState(savedState.customConditions  ?? []);
  const [tokenGroups,       setTokenGroups]       = useState(savedState.tokenGroups       ?? []);
  const [journalEntries,    setJournalEntries]    = useState(savedState.journalEntries    ?? []);
  const [compendiumEntries, setCompendiumEntries] = useState(savedState.compendiumEntries ?? []);
  const [rollableTables,    setRollableTables]    = useState(savedState.rollableTables    ?? []);
  const [macros,            setMacros]            = useState(savedState.macros            ?? []);
  const [timerEnabled,      setTimerEnabled]      = useState(savedState.timerEnabled      ?? false);
  const [timerDuration,     setTimerDuration]     = useState(savedState.timerDuration     ?? 60);
  const [timerSoundEnabled, setTimerSoundEnabled] = useState(savedState.timerSoundEnabled ?? true);

  // ── Combat state ───────────────────────────────────────────────────────────
  const [combatActive,     setCombatActive]     = useState(savedState.combatActive     ?? false);
  const [currentRound,     setCurrentRound]     = useState(savedState.currentRound     ?? 1);
  const [currentTurnIndex, setCurrentTurnIndex] = useState(savedState.currentTurnIndex ?? 0);
  const [initiativeOrder,  setInitiativeOrder]  = useState(savedState.initiativeOrder  ?? []);

  // ── Targeting state ────────────────────────────────────────────────────────
  const [targetingMode, setTargetingMode] = useState(false);
  const [targetId,      setTargetId]      = useState(null);

  // ── Wall draw mode (wall / door) ──────────────────────────────────────────
  const [wallDrawMode, setWallDrawMode] = useState('wall');

  // ── Tile state ────────────────────────────────────────────────────────────
  const [tiles,             setTiles]             = useState(_initScene?.tiles ?? []);
  const [selectedTileId,    setSelectedTileId]    = useState(null);
  const [activeTileTemplate, setActiveTileTemplate] = useState(null);
  const [customTiles,       setCustomTiles]       = useState([]);
  const [showTilePanel,     setShowTilePanel]     = useState(false);

  const tilesRef2 = useRef(tiles);
  useEffect(() => { tilesRef2.current = tiles; }, [tiles]);

  // ── Drawing state ──────────────────────────────────────────────────────────
  const [drawingTool,       setDrawingTool]       = useState(null);
  const [drawingConfig,     setDrawingConfig]     = useState({ color: '#c9a96e', strokeWidth: 2, opacity: 1, fontSize: 16, eraserSize: 20 });
  const [playersCanDraw,    setPlayersCanDraw]    = useState(false);
  const [showDrawingPanel,  setShowDrawingPanel]  = useState(false);

  // ── Waypoint state ─────────────────────────────────────────────────────────
  const [waypointMode,  setWaypointMode]  = useState(false);
  const [waypointToken, setWaypointToken] = useState(null);
  const [waypoints,     setWaypoints]     = useState([]);

  // ── Ping / pointer state ───────────────────────────────────────────────────
  const [pointerPos,   setPointerPos]   = useState(null);
  const zKeyRef = useRef(false);

  // ── Session log ────────────────────────────────────────────────────────────
  const [log,          setLog]          = useState(savedState.log          ?? []);
  const [chatMessages, setChatMessages] = useState(savedState.chatMessages ?? []);

  // ── Fog of war ─────────────────────────────────────────────────────────────
  const [fogEnabled,    setFogEnabled]    = useState(
    _initScene ? (_initScene.fog?.enabled ?? false) : (savedState.fogEnabled ?? false)
  );
  const [revealedCells, setRevealedCells] = useState(() =>
    new Set(_initScene ? (_initScene.fog?.revealedCells ?? []) : (savedState.revealedCells ?? []))
  );

  // ── Measurement (transient) ────────────────────────────────────────────────
  const [measurements, setMeasurements] = useState([]);
  const [measuring,    setMeasuring]    = useState(null);

  // ── Map effects ────────────────────────────────────────────────────────────
  const [markers,      setMarkers]      = useState(
    _initScene ? (_initScene.markers ?? []) : (savedState.markers ?? [])
  );
  const [paintedCells, setPaintedCells] = useState(
    _initScene ? (_initScene.paintedCells ?? {}) : (savedState.paintedCells ?? {})
  );
  const [, setPaintHistory] = useState([]);
  const [weather,      setWeather]      = useState(
    _initScene ? (_initScene.weather ?? 'none') : (savedState.weather ?? 'none')
  );
  const [paintColor,   setPaintColor]   = useState('#e05555');
  const [floatingNums, setFloatingNums] = useState([]);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const prevTokensRef = useRef([]);

  // ── State refs (stale-closure safety) ─────────────────────────────────────
  const combatActiveRef     = useRef(combatActive);
  const initiativeOrderRef  = useRef(initiativeOrder);
  const currentTurnIndexRef = useRef(currentTurnIndex);
  const currentRoundRef     = useRef(currentRound);
  const selectedIdRef       = useRef(null);
  const targetingModeRef    = useRef(false);

  useEffect(() => { combatActiveRef.current = combatActive;         }, [combatActive]);
  useEffect(() => { initiativeOrderRef.current = initiativeOrder;   }, [initiativeOrder]);
  useEffect(() => { currentTurnIndexRef.current = currentTurnIndex; }, [currentTurnIndex]);
  useEffect(() => { currentRoundRef.current = currentRound;         }, [currentRound]);
  useEffect(() => { toolRef.current = tool;                         }, [tool]);
  useEffect(() => { targetingModeRef.current = targetingMode;       }, [targetingMode]);
  useEffect(() => { partyOrderRef.current = party.order;            }, [party.order]);

  // Scene-state refs (read inside switchScene setTimeout)
  useEffect(() => { bgImageRef.current = bgImage;               }, [bgImage]);
  useEffect(() => { fogEnabledRef2.current = fogEnabled;        }, [fogEnabled]);
  useEffect(() => { revealedCellsRef2.current = revealedCells;  }, [revealedCells]);
  useEffect(() => { markersRef2.current = markers;              }, [markers]);
  useEffect(() => { paintedCellsRef2.current = paintedCells;    }, [paintedCells]);
  useEffect(() => { weatherRef2.current = weather;              }, [weather]);

  const aoesRef2 = useRef(aoeState.aoes);
  useEffect(() => { aoesRef2.current = aoeState.aoes; }, [aoeState.aoes]);

  const macrosRef = useRef(macros);
  useEffect(() => { macrosRef.current = macros; }, [macros]);

  const drawingsRef2 = useRef(drawingState.drawings);
  useEffect(() => { drawingsRef2.current = drawingState.drawings; }, [drawingState.drawings]);

  // Track Z key for ping trigger
  useEffect(() => {
    const onDown = (e) => { if (e.key === 'z' || e.key === 'Z') zKeyRef.current = true; };
    const onUp   = (e) => { if (e.key === 'z' || e.key === 'Z') zKeyRef.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  const wallsRef2 = useRef(walls);
  useEffect(() => { wallsRef2.current = walls; }, [walls]);
  const selectedWallIdRef = useRef(null);
  useEffect(() => { selectedWallIdRef.current = selectedWallId; }, [selectedWallId]);
  const waypointModeRef = useRef(false);
  useEffect(() => { waypointModeRef.current = waypointMode; }, [waypointMode]);

  // ── Stable callbacks ───────────────────────────────────────────────────────
  const {
    tokens, selectedId, moveToken, setSelectedId, adjustHp,
    deleteToken, updateToken, tokensRef, setTokens, resetIdCounter,
  } = tokenState;
  const { ensureCellVisible, centerOnCell, resetZoom, zoomAtCenter } = camera;

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // ── Audio ──────────────────────────────────────────────────────────────────
  const playSfx = useCallback((type) => {
    audioManagerRef.current?.playEffect(type);
  }, []);

  // ── Log + Chat bridge ──────────────────────────────────────────────────────
  const addLog = useCallback((text, category = 'system') => {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setLog(prev => [
      { id: `${Date.now()}-${Math.random()}`, time, text, category },
      ...prev,
    ].slice(0, 100));
    setChatMessages(prev => [...prev, {
      id: `sys-${Date.now()}-${Math.random()}`,
      type: 'system',
      sender: 'Sistema',
      content: text,
      timestamp: Date.now(),
      tokenColor: null,
      diceResult: null,
    }].slice(-200));
  }, []);

  const addChatMessage = useCallback((msg) => {
    setChatMessages(prev => [...prev, msg].slice(-200));
  }, []);

  const handleAoeConfirm = useCallback((col, row) => {
    const mode = aimingModeRef2.current;
    if (!mode) return;
    const src = mode.sourceToken;
    const aoeData = makeAoe({
      casterId: src.id,
      shape: mode.shape,
      originX: src.x, originY: src.y,
      targetX: col,   targetY: row,
      radius: mode.radius, length: mode.length,
      width:  mode.width,  angle:  mode.angle,
      color:  mode.color,  label:  mode.label,
      roundCreated: currentRoundRef.current,
    });
    const affected = getAffectedTokens(aoeData, tokensRef.current);
    const final = { ...aoeData, affectedTokenIds: affected.map(t => t.id) };
    aoeState.addAoe(final);
    const shapeName = { circle: 'Círculo', cone: 'Cone', line: 'Linha', square: 'Cubo' }[mode.shape] ?? mode.shape;
    const techName  = mode.label || shapeName;
    const names     = affected.map(t => t.name).join(', ') || 'nenhum';
    addChatMessage({
      id: Date.now(), type: 'system', sender: 'Sistema', timestamp: Date.now(),
      text: `✨ ${src.name} usa ${techName} — Alvos: ${names} (${affected.length})`,
    });
    setAimingMode(null);
  }, [aoeState, addChatMessage, tokensRef]);

  const handleAoeCancel = useCallback(() => setAimingMode(null), []);

  const onAddWall = useCallback((wall) => {
    setWalls(prev => {
      if (wall.type === 'door') {
        // When a door is drawn on top of an existing wall, split that wall
        // so there's a proper gap where the door sits.
        let result = [];
        for (const w of prev) {
          if (w.type === 'door') { result.push(w); continue; }
          if (isDoorOnWall(wall, w)) {
            // Replace this wall segment with the pieces that flank the door
            result.push(...splitWallAroundDoor(w, wall));
          } else {
            result.push(w);
          }
        }
        result.push(wall);
        return result;
      }
      // Regular wall: discard exact duplicates, then append
      const posKey = (w) => [
        Math.min(w.x1,w.x2), Math.min(w.y1,w.y2),
        Math.max(w.x1,w.x2), Math.max(w.y1,w.y2),
      ].join(',');
      if (prev.some(w => posKey(w) === posKey(wall))) return prev;
      return [...prev, wall];
    });
  }, []);

  const onSelectWall = useCallback((wallId) => {
    setSelectedWallId(prev => prev === wallId ? null : wallId);
  }, []);

  const clearLog = useCallback(() => {
    if (window.confirm('Limpar o registro da sessão?')) setLog([]);
  }, []);

  const clearChat = useCallback(() => setChatMessages([]), []);

  // ── Scene management ──────────────────────────────────────────────────────

  const saveCurrentSceneState = useCallback(() => {
    const partyIds = new Set(partyOrderRef.current);
    const currentTokens = tokensRef.current;
    sceneManager.updateScene(sceneManager.activeSceneId, {
      mapImage: bgImageRef.current,
      fog: { enabled: fogEnabledRef2.current, revealedCells: [...revealedCellsRef2.current] },
      markers: markersRef2.current,
      paintedCells: paintedCellsRef2.current,
      weather: weatherRef2.current,
      aoes: aoesRef2.current,
      walls: wallsRef2.current,
      drawings: drawingsRef2.current,
      tiles: tilesRef2.current,
      tokens: currentTokens.filter(t => !partyIds.has(t.id)),
      partyPositions: Object.fromEntries(
        currentTokens.filter(t => partyIds.has(t.id)).map(t => [t.id, { x: t.x, y: t.y }])
      ),
    });
  }, [sceneManager, partyOrderRef, tokensRef]);

  const applyScene = useCallback((scene) => {
    const partyIds = new Set(partyOrderRef.current);
    const partyTokens = tokensRef.current.filter(t => partyIds.has(t.id));
    const gx = Math.floor((scene.gridSize?.cols ?? COLS) / 2);
    const gy = Math.floor((scene.gridSize?.rows ?? ROWS) / 2);
    setBgImage(scene.mapImage ?? null);
    setFogEnabled(scene.fog?.enabled ?? false);
    setRevealedCells(new Set(scene.fog?.revealedCells ?? []));
    setMarkers(scene.markers ?? []);
    setPaintedCells(scene.paintedCells ?? {});
    setPaintHistory([]);
    setWeather(scene.weather ?? 'none');
    aoeState.setAoes(scene.aoes ?? []);
    drawingState.setDrawings(scene.drawings ?? []);
    setTiles(scene.tiles ?? []);
    setSelectedTileId(null);
    setWalls(sanitizeWalls(scene.walls ?? []));
    setSelectedWallId(null);
    setTokens([
      ...partyTokens.map(t => ({
        ...t,
        x: scene.partyPositions?.[t.id]?.x ?? gx,
        y: scene.partyPositions?.[t.id]?.y ?? gy,
      })),
      ...(scene.tokens ?? []),
    ]);
    centerOnCell(gx, gy);
  }, [partyOrderRef, tokensRef, setTokens, centerOnCell, aoeState, drawingState]);

  const switchScene = useCallback((newSceneId) => {
    if (newSceneId === sceneManager.activeSceneId || isSwitchingRef.current) return;
    isSwitchingRef.current = true;
    saveCurrentSceneState();
    setFading(true);
    setTimeout(() => {
      const newScene = sceneManager.scenesRef.current.find(s => s.id === newSceneId);
      if (!newScene) { setFading(false); isSwitchingRef.current = false; return; }
      applyScene(newScene);
      sceneManager.setActiveSceneId(newSceneId);
      addLog(`🗺️ Cena: ${newScene.name}`, 'system');
      setTimeout(() => { setFading(false); isSwitchingRef.current = false; }, 320);
    }, 300);
  }, [sceneManager, saveCurrentSceneState, applyScene, addLog]);

  const handleSceneCreate = useCallback((scene) => {
    if (isSwitchingRef.current) return;
    isSwitchingRef.current = true;
    saveCurrentSceneState();
    sceneManager.addScene(scene);
    setFading(true);
    setTimeout(() => {
      applyScene(scene);
      sceneManager.setActiveSceneId(scene.id);
      addLog(`🗺️ Cena criada: ${scene.name}`, 'system');
      setTimeout(() => { setFading(false); isSwitchingRef.current = false; }, 320);
    }, 300);
  }, [sceneManager, saveCurrentSceneState, applyScene, addLog]);

  const handleSceneDuplicate = useCallback((sceneId) => {
    saveCurrentSceneState();
    const copy = sceneManager.duplicateScene(sceneId);
    if (copy) addLog(`🗺️ Cena duplicada: ${copy.name}`, 'system');
  }, [sceneManager, saveCurrentSceneState, addLog]);

  const handleSceneConfigGrid = useCallback((sceneId, gridSize) => {
    sceneManager.updateScene(sceneId, { gridSize });
  }, [sceneManager]);

  const handleSceneUpdateNotes = useCallback((text) => {
    sceneManager.updateScene(sceneManager.activeSceneId, { notes: text });
  }, [sceneManager]);

  const sceneCols = sceneManager.activeScene?.gridSize?.cols ?? COLS;
  const sceneRows = sceneManager.activeScene?.gridSize?.rows ?? ROWS;

  // ── Toasts ─────────────────────────────────────────────────────────────────
  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const handleDragBlocked = useCallback((wall) => {
    setBlockedWallId(wall.id);
    showToast('Caminho bloqueado por parede');
    setTimeout(() => setBlockedWallId(null), 500);
  }, [showToast]);

  // ── Sheet management ───────────────────────────────────────────────────────
  const openSheet = useCallback((sheetId) => {
    setOpenSheetIds(prev => prev.includes(sheetId) ? prev : [...prev, sheetId]);
  }, []);

  const closeSheet = useCallback((sheetId) => {
    setOpenSheetIds(prev => prev.filter(id => id !== sheetId));
  }, []);

  const handleOpenSheetForToken = useCallback((tokenId) => {
    if (!tokenId) return;
    let sheet = sheetState.getSheetForToken(tokenId);
    if (!sheet) {
      const token = tokensRef.current.find(t => t.id === tokenId);
      if (!token) return;
      sheet = sheetState.addSheet({ linkedTokenId: tokenId, name: token.name, category: 'pc' });
    }
    openSheet(sheet.id);
  }, [sheetState, openSheet, tokensRef]);

  // ── GM panel helpers ──────────────────────────────────────────────────────
  const showGMPanelRef   = useRef(false);
  useEffect(() => { showGMPanelRef.current    = showGMPanel;    }, [showGMPanel]);

  // Opens the sheet for the selected token (GM) or the player's own sheet
  const handleOpenCharacterSheet = useCallback(() => {
    if (isGMRef.current) {
      const tokId = selectedIdRef.current;
      if (!tokId) { showToast('Selecione um token para abrir a ficha.'); return; }
      handleOpenSheetForToken(tokId);
    } else {
      const sh = sheetState.sheetsRef.current.find(
        s => s.owner === playerNameRef.current && s.category === 'pc'
      );
      if (sh) openSheet(sh.id);
      else showToast('Nenhuma ficha encontrada.');
    }
  }, [handleOpenSheetForToken, openSheet, sheetState.sheetsRef, showToast]);

  const showFeedback = useCallback((msg) => {
    clearTimeout(feedbackTimer.current);
    setFeedbackToast(null);
    // micro delay so re-keying same shortcut still animates
    requestAnimationFrame(() => {
      setFeedbackToast(msg);
      feedbackTimer.current = setTimeout(() => setFeedbackToast(null), 1500);
    });
  }, []);

  // ── Party helpers ──────────────────────────────────────────────────────────
  const handleShortRest = useCallback(() => {
    const partyTokens = party.order.map(id => tokens.find(t => t.id === id)).filter(Boolean);
    if (partyTokens.length === 0) return;
    partyTokens.forEach(token => {
      const restore = Math.floor(token.maxMp * 0.5);
      const gain    = Math.min(restore, token.maxMp - token.mp);
      if (gain > 0) updateToken(token.id, { mp: token.mp + gain });
      addLog(`💤 ${token.name}: +${gain} MP (${token.mp + gain}/${token.maxMp}).`, 'heal');
    });
    addLog('💤 Descanso Curto concluído.', 'system');
    playSfx('heal');
  }, [party, tokens, updateToken, addLog, playSfx]);

  const handleLongRest = useCallback(() => {
    const partyTokens = party.order.map(id => tokens.find(t => t.id === id)).filter(Boolean);
    if (partyTokens.length === 0) return;
    const EXHS = ['Exaustão 1', 'Exaustão 2', 'Exaustão 3', 'Exaustão 4', 'Exaustão 5'];
    partyTokens.forEach(token => {
      const exhIdx = EXHS.findIndex(e => token.conditions.includes(e));
      let conds = token.conditions;
      if (exhIdx === 0)      conds = conds.filter(c => c !== EXHS[0]);
      else if (exhIdx > 0)   conds = conds.filter(c => c !== EXHS[exhIdx]).concat(EXHS[exhIdx - 1]);
      updateToken(token.id, { hp: token.maxHp, mp: token.maxMp, conditions: conds });
      addLog(`🌙 ${token.name}: HP/MP restaurados totalmente.`, 'heal');
    });
    addLog('🌙 Descanso Longo concluído.', 'system');
    playSfx('heal');
  }, [party, tokens, updateToken, addLog, playSfx]);

  const handleDivideGold = useCallback(() => {
    const count = party.order.filter(id => tokens.some(t => t.id === id)).length;
    if (count === 0 || party.sharedGold === 0) { showToast('Nada para dividir'); return; }
    const share = Math.floor(party.sharedGold / count);
    const remainder = party.sharedGold % count;
    party.setSharedGold(remainder);
    addLog(`💰 Ouro dividido: ${share} CO por membro × ${count}. Sobra: ${remainder} CO.`, 'system');
    showToast(`${share} CO por membro`);
  }, [party, tokens, addLog, showToast]);

  const onGroupMove = useCallback((destCol, destRow) => {
    const selId = selectedIdRef.current;
    if (!selId) return;
    const order = partyOrderRef.current;
    if (!order.includes(selId)) return;
    const snapshot = tokensRef.current;
    const leader = snapshot.find(t => t.id === selId);
    if (!leader) return;
    const dx = destCol - leader.x;
    const dy = destRow - leader.y;
    if (dx === 0 && dy === 0) return;
    const currentWalls = wallsRef2.current;

    // Pre-compute moves outside setTokens so we can log blocked members
    const occupied = new Set(snapshot.map(t => `${t.x},${t.y}`));
    const memberIds = order.filter(id => snapshot.some(t => t.id === id));
    memberIds.forEach(id => { const t = snapshot.find(tk => tk.id === id); if (t) occupied.delete(`${t.x},${t.y}`); });
    const moves = new Map();
    const blockedNames = [];
    memberIds.forEach(id => {
      const t = snapshot.find(tk => tk.id === id);
      if (!t) return;
      const tx = t.x + dx, ty = t.y + dy;
      if (!t.canPhaseWalls && isMovementBlocked(t.x, t.y, tx, ty, currentWalls, t)) {
        blockedNames.push(t.name);
        moves.set(id, { x: t.x, y: t.y });
        return;
      }
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && !occupied.has(`${tx},${ty}`)) {
        moves.set(id, { x: tx, y: ty });
        occupied.add(`${tx},${ty}`);
      } else {
        const free = findNearestFree(tx, ty, occupied);
        const dest = free ?? { x: t.x, y: t.y };
        moves.set(id, dest);
        occupied.add(`${dest.x},${dest.y}`);
      }
    });

    setTokens(prev => prev.map(t => moves.has(t.id) ? { ...t, ...moves.get(t.id) } : t));
    blockedNames.forEach(name => addLog(`🧱 ${name} não pode se mover — parede no caminho.`, 'system'));
    addLog(`⚔ Grupo moveu em formação (${dx > 0 ? '+' : ''}${dx}, ${dy > 0 ? '+' : ''}${dy}).`, 'system');
  }, [tokensRef, setTokens, addLog]);

  // ── Waypoint helpers ──────────────────────────────────────────────────────
  const cancelWaypoints = useCallback(() => {
    setWaypointMode(false);
    setWaypointToken(null);
    setWaypoints([]);
  }, []);

  const confirmWaypoints = useCallback(() => {
    const wpts = waypoints;
    const tok  = waypointToken;
    if (!tok || wpts.length === 0) { cancelWaypoints(); return; }
    const currentWalls = wallsRef2.current;
    const path = [{ x: tok.x, y: tok.y }, ...wpts];
    const DIST_M = 1.5;
    let totalDist = 0;
    const steps = [];
    let blocked = false;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1];
      if (!tok.canPhaseWalls && isMovementBlocked(a.x, a.y, b.x, b.y, currentWalls, tok)) {
        blocked = true; break;
      }
      totalDist += Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2) * DIST_M;
      steps.push(b);
    }
    if (blocked) {
      showFeedback('🧱 Caminho bloqueado!');
      cancelWaypoints();
      return;
    }
    cancelWaypoints();
    steps.forEach((cell, idx) => {
      setTimeout(() => {
        setTokens(prev => prev.map(t => t.id === tok.id ? { ...t, x: cell.x, y: cell.y } : t));
        if (idx === steps.length - 1) {
          addLog(`🗺 ${tok.name} percorreu ${totalDist.toFixed(1)}m.`, 'system');
        }
      }, idx * 180);
    });
  }, [waypoints, waypointToken, cancelWaypoints, setTokens, addLog, showFeedback]);

  // ── Door interaction ──────────────────────────────────────────────────────
  const handleDoorInteract = useCallback((door) => {
    if (isGM) {
      // GM cycles: closed → open → locked → closed
      const next = door.state === 'closed' ? 'open' : door.state === 'open' ? 'locked' : 'closed';
      setWalls(prev => prev.map(w => w.id === door.id ? { ...w, state: next } : w));
      addLog(`🚪 Porta ${next === 'open' ? 'aberta' : next === 'locked' ? 'trancada' : 'fechada'} pelo Mestre.`, 'system');
    } else {
      const sel = tokensRef.current.find(t => t.id === selectedIdRef.current);
      const playerN = playerNameRef.current;
      const controlled = sel && (sel.owner === playerN);
      const name = controlled ? sel.name : (playerN ?? 'Jogador');
      if (door.state === 'locked') {
        showFeedback('🔒 A porta está trancada');
        addLog(`🔒 ${name} tentou abrir uma porta trancada.`, 'system');
        return;
      }
      if (door.state === 'open') {
        setWalls(prev => prev.map(w => w.id === door.id ? { ...w, state: 'closed' } : w));
        addLog(`🚪 ${name} fechou uma porta.`, 'system');
        showFeedback('🚪 Porta fechada');
      } else {
        setWalls(prev => prev.map(w => w.id === door.id ? { ...w, state: 'open' } : w));
        addLog(`🚪 ${name} abriu uma porta.`, 'system');
        showFeedback('🚪 Porta aberta');
      }
    }
  }, [isGM, addLog, tokensRef, showFeedback]);

  const handleWallConvert = useCallback((seg) => {
    if (!isGM) return;
    if (seg.type === 'door') {
      // Convert door → wall
      setWalls(prev => prev.map(w => {
        if (w.id !== seg.id) return w;
        const { type: _t, state: _s, secret: _sec, ...rest } = w;
        return rest;
      }));
      addLog('🧱 Porta convertida em parede.', 'system');
    } else {
      // Convert wall → door
      setWalls(prev => prev.map(w => w.id === seg.id ? { ...w, type: 'door', state: 'closed', secret: false } : w));
      addLog('🚪 Parede convertida em porta.', 'system');
    }
  }, [isGM, addLog]);

  const handleWallContextMenu = useCallback((seg, x, y) => {
    setCtxMenu({ type: seg.type === 'door' ? 'door' : 'wall', wallId: seg.id, wall: seg, x, y });
  }, []);

  // ── Tile CRUD ─────────────────────────────────────────────────────────────
  const handleAddTile = useCallback((tile) => {
    setTiles(prev => [...prev, tile]);
  }, []);

  const handleUpdateTile = useCallback((id, patch) => {
    setTiles(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const handleRemoveTile = useCallback((id) => {
    setTiles(prev => prev.filter(t => t.id !== id));
    setSelectedTileId(prev => prev === id ? null : prev);
  }, []);

  // ── Hex grid (per-scene) ──────────────────────────────────────────────────
  const hexGrid = sceneManager.activeScene?.hexGrid ?? false;
  const setHexGrid = useCallback((val) => {
    sceneManager.updateScene(sceneManager.activeSceneId, { hexGrid: val });
  }, [sceneManager]);

  // Sync party when a token is deleted
  useEffect(() => {
    party.syncMembers(tokens.map(t => t.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length]);

  // ── BUG 2: Auto-create sheet + token when a player joins ──────────────────
  useEffect(() => {
    if (isGM || !rolePlayerName) return;
    const existing = sheetState.sheetsRef.current.find(s => s.owner === rolePlayerName);
    if (existing) return;
    if (hasCreatedSheetRef.current) return;
    hasCreatedSheetRef.current = true;

    const newTokId = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const sheet = sheetState.addSheet({
      category: 'pc',
      owner: rolePlayerName,
      name: 'Novo Personagem',
      level: 3,
      hp: 30, maxHp: 30,
      mp: 15, maxMp: 15,
      ac: 10, movement: 9,
      profBonus: 2,
      weaponDice: '1d8',
      attributes: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 },
      conditions: [],
      race: 'Humano',
      profession: 'Guerreiro',
      aura: '', techniques: [],
      proficiencies: [],
      inventory: [], gold: 0,
      notes: '', backstory: '',
      linkedTokenId: newTokId,
    });

    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    setTokens(prev => {
      const occupied = new Set(prev.map(t => `${t.x},${t.y}`));
      let tx = cx, ty = cy;
      if (occupied.has(`${cx},${cy}`)) {
        outer: for (let r = 1; r <= 5; r++) {
          for (let dx = -r; dx <= r; dx++) {
            for (let dy = -r; dy <= r; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !occupied.has(`${nx},${ny}`)) {
                tx = nx; ty = ny; break outer;
              }
            }
          }
        }
      }
      return [...prev, {
        id: newTokId,
        name: 'Novo Personagem',
        type: 'player',
        owner: rolePlayerName,
        x: tx, y: ty,
        hp: 30, maxHp: 30,
        mp: 15, maxMp: 15,
        ac: 10, movement: 9,
        color: '#6ea3c9',
        image: null,
        level: 3,
        race: 'Humano',
        profession: 'Guerreiro',
        attributes: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 },
        conditions: [], hidden: false, visibleToAll: true,
        lightRadius: 0, lightColor: '#ffd700', darkvision: false,
        size: 1, profBonus: 2, weaponDice: '1d8', initiative: 0,
        techniques: [], proficiencies: [], inventory: [], gold: 0,
        aura: '', notes: '',
      }];
    });

    openSheet(sheet.id);
    showToast('📋 Ficha criada! Configure seu personagem.');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolePlayerName, isGM]);

  // HP-watching → floating damage/heal numbers
  useEffect(() => {
    const prev = prevTokensRef.current;
    const nums = [];
    tokens.forEach(token => {
      const prevToken = prev.find(t => t.id === token.id);
      if (!prevToken) return;
      const diff = token.hp - prevToken.hp;
      if (diff === 0) return;
      const fn = {
        id: `fn-${Date.now()}-${Math.random()}`,
        tokenId: token.id,
        value: Math.abs(diff),
        type: diff > 0 ? 'heal' : 'damage',
      };
      nums.push(fn);
    });
    if (nums.length > 0) {
      setFloatingNums(prev => [...prev, ...nums]);
      nums.forEach(fn => {
        setTimeout(() => setFloatingNums(p => p.filter(n => n.id !== fn.id)), 2000);
      });
    }
    prevTokensRef.current = tokens;
  }, [tokens]);

  // ── Combat: advance turn ───────────────────────────────────────────────────
  const advanceTurn = useCallback(() => {
    if (!combatActiveRef.current) return;
    const order = initiativeOrderRef.current;
    if (order.length === 0) return;
    const currentTokens = tokensRef.current;
    let idx   = currentTurnIndexRef.current;
    let round = currentRoundRef.current;
    let found = false;
    for (let tried = 0; tried < order.length; tried++) {
      idx = (idx + 1) % order.length;
      if (idx === 0) round++;
      const tid = order[idx]?.tokenId;
      if (currentTokens.some(t => t.id === tid)) { found = true; break; }
    }
    if (!found) return;
    if (round !== currentRoundRef.current) setCurrentRound(round);
    setCurrentTurnIndex(idx);
    const t = currentTokens.find(tk => tk.id === order[idx]?.tokenId);
    addLog(`→ Turno de ${t?.name ?? '?'} (Round ${round})`);
    if (t && (t.activeEffects?.length ?? 0) > 0) {
      processEffectsOnTurnStart(t, { adjustHp, updateToken, addLog, addChatMessage, playSfx });
    }
    playSfx('turnStart');
    if (t) showFeedback(`Turno: ${t.name}`);
    // Exit targeting when turn changes
    setTargetingMode(false);
    setTargetId(null);
  }, [tokensRef, addLog, playSfx, showFeedback, adjustHp, updateToken, addChatMessage]);

  // ── Combat: start (lifted for Ctrl+R shortcut) ────────────────────────────
  const startCombat = useCallback(() => {
    const currentTokens = tokensRef.current;
    if (currentTokens.length === 0) return;
    const order = currentTokens
      .map(t => ({ tokenId: t.id, initiative: rollInitiativeFor(t) }))
      .sort((a, b) => b.initiative - a.initiative);
    setInitiativeOrder(order);
    setCombatActive(true);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    addLog('⚔ Combate iniciado! Round 1');
    addLog(order.map(({ tokenId, initiative }) => {
      const t = currentTokens.find(tk => tk.id === tokenId);
      return `${t?.name ?? '?'}: ${initiative}`;
    }).join(' | '));
    playSfx('combatStart');
    setActiveTab('combat');
    setSidebarOpen(true);
    showFeedback('⚔ Combate iniciado!');
  }, [tokensRef, addLog, playSfx, showFeedback]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const combatTurnTokenId = combatActive && initiativeOrder.length > 0
    ? (initiativeOrder[currentTurnIndex]?.tokenId ?? null)
    : null;
  const combatTurnToken = combatTurnTokenId
    ? tokens.find(t => t.id === combatTurnTokenId) ?? null
    : null;

  // ── Drawing / ping derived ────────────────────────────────────────────────
  const canDraw = isGM || playersCanDraw;
  const pingAuthorToken = rolePlayerName
    ? tokens.find(t => t.owner === rolePlayerName) ?? null
    : null;
  const pointerColor = pingAuthorToken?.color ?? '#c9a96e';
  const drawingAuthor = isGM ? 'Mestre' : (rolePlayerName ?? '?');

  // ── Auto-save ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const timer = setTimeout(() => {
      try {
        const state = buildSaveState();
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
      } catch (e) { console.warn('Auto-save failed:', e.message); }
    }, 800);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, bgImage, log, showGrid, combatActive, currentRound, currentTurnIndex,
      initiativeOrder, fogEnabled, revealedCells, markers, paintedCells, weather, chatMessages, aoeState.aoes, walls, tiles]);

  // ── AoE context menu event listener ───────────────────────────────────────
  useEffect(() => {
    const handler = (e) => setAoeCtxMenu(e.detail);
    window.addEventListener('aoe-ctx', handler);
    return () => window.removeEventListener('aoe-ctx', handler);
  }, []);

  // ── Small-screen default ───────────────────────────────────────────────────
  useEffect(() => { if (window.innerWidth < 900) setSidebarOpen(false); }, []);

  // Clear measurements when switching away from measure tool
  useEffect(() => {
    if (tool !== 'measure') { setMeasurements([]); setMeasuring(null); }
  }, [tool]);

  // Clear targeting when selected token changes
  useEffect(() => {
    setTargetingMode(false);
    setTargetId(null);
  }, [selectedId]);

  // ── Ownership guard for keyboard movement ─────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canMoveSelected = useCallback(() => {
    if (isGMRef.current) return true;
    const tok = tokensRef.current.find(t => t.id === selectedIdRef.current);
    return tok != null && tok.owner === playerNameRef.current;
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts({
    // Tools & nav
    't': () => { setTool('select'); showFeedback('Seleção'); },
    'm': () => { setTool(t => t === 'measure' ? 'select' : 'measure'); showFeedback('Medida'); },
    'k': () => { setTool(t => t === 'marker' ? 'select' : 'marker'); showFeedback('Marcador 📌'); },
    'j': () => { setTool(t => t === 'paint'  ? 'select' : 'paint');  showFeedback('Pintura 🎨'); },
    'b': () => { setTool(t => t === 'wall' ? 'select' : 'wall'); showFeedback('Paredes 🧱'); },
    'c': () => {
      const id = selectedIdRef.current;
      if (id) handleOpenSheetForToken(id);
      else showFeedback('Selecione um token para abrir a ficha');
    },
    'v': () => {
      if (!isGMRef.current) return;
      if (!isPreviewMode) {
        if (players.length > 0) { startPreview(players[0]); setPlayerView(true); showFeedback(`👁 ${players[0]}`); }
        else { setPlayerView(v => !v); showFeedback('Visão Jogador'); }
      } else {
        const idx = players.indexOf(previewAs);
        if (idx < players.length - 1) {
          startPreview(players[idx + 1]); showFeedback(`👁 ${players[idx + 1]}`);
        } else {
          stopPreview(); setPlayerView(false); showFeedback('Visão: Mestre');
        }
      }
    },
    'a': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current, -1,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'g': () => setShowGrid(g => { showFeedback(`Grade: ${g ? 'OFF' : 'ON'}`); return !g; }),
    'f': () => setFogEnabled(f => { showFeedback(`Névoa: ${f ? 'OFF' : 'ON'}`); return !f; }),
    'h': () => setSidebarOpen(o => !o),
    'home': () => { resetZoom(); showFeedback('Zoom resetado'); },
    'f11': () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    },
    // Tabs
    '1': () => { setActiveTab('tokens'); setSidebarOpen(true); },
    '2': () => { setActiveTab('combat'); setSidebarOpen(true); },
    '3': () => { setActiveTab('dice');   setSidebarOpen(true); },
    '4': () => { setActiveTab('audio');  setSidebarOpen(true); },
    '5': () => { setActiveTab('chat');   setSidebarOpen(true); },
    '6': () => { setActiveTab('fichas'); setSidebarOpen(true); },
    // Scene navigation
    'ctrl+arrowleft': () => {
      const ss = sceneManager.scenesRef.current;
      const idx = ss.findIndex(s => s.id === sceneManager.activeSceneId);
      if (idx > 0) switchScene(ss[idx - 1].id);
    },
    'ctrl+arrowright': () => {
      const ss = sceneManager.scenesRef.current;
      const idx = ss.findIndex(s => s.id === sceneManager.activeSceneId);
      if (idx < ss.length - 1) switchScene(ss[idx + 1].id);
    },
    // Overlays
    '?': () => setShowShortcuts(v => !v),
    // 'p' merged below with waypoint logic
    // Drawing toggle
    'x': () => setShowDrawingPanel(v => !v),
    // Tile objects
    'o': () => { if (isGMRef.current) setShowTilePanel(v => !v); },
    // Journal
    'ctrl+j': () => setActiveTab(t => t === 'diary' ? 'tokens' : 'diary'),
    // Drawing undo/redo (drawing tool active) or paint undo
    'ctrl+z': () => {
      if (drawingTool) {
        const ok = drawingState.undoDrawing();
        if (ok) showFeedback('Desenho desfeito');
        return;
      }
      setPaintHistory(prev => {
        if (prev.length === 0) return prev;
        setPaintedCells(prev[prev.length - 1]);
        showFeedback('Pintura desfeita');
        return prev.slice(0, -1);
      });
    },
    'ctrl+shift+z': () => {
      if (drawingTool) {
        const ok = drawingState.redoDrawing();
        if (ok) showFeedback('Desenho refeito');
      }
    },
    // Combat
    'n': () => advanceTurn(),
    'ctrl+r': () => { if (combatActive) advanceTurn(); else startCombat(); },
    'ctrl+shift+s': () => {
      const token = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!token) return;
      if (combatActiveRef.current) { showFeedback('Descanso indisponível em combate'); return; }
      if (!isGMRef.current && token.owner !== playerNameRef.current) return;
      const recovered = Math.ceil(token.maxMp * 0.5);
      const newMp = Math.min(token.maxMp, (token.mp ?? 0) + recovered);
      const gain = newMp - (token.mp ?? 0);
      updateToken(token.id, { mp: newMp });
      addLog(`☕ ${token.name} fez um descanso curto. MP: ${token.mp} → ${newMp}${gain > 0 ? ` (+${gain})` : ''}`, 'heal');
      playSfx('heal');
      showFeedback(`☕ Descanso Curto`);
    },
    'ctrl+shift+l': () => {
      const token = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!token) return;
      if (combatActiveRef.current) { showFeedback('Descanso indisponível em combate'); return; }
      if (!isGMRef.current && token.owner !== playerNameRef.current) return;
      const exLevels = ['Exaustão 1','Exaustão 2','Exaustão 3','Exaustão 4','Exaustão 5'];
      const exIdx = exLevels.findIndex(c => (token.conditions ?? []).includes(c));
      const newConds = (token.conditions ?? []).filter(c => !exLevels.includes(c));
      if (exIdx > 0) newConds.push(exLevels[exIdx - 1]);
      updateToken(token.id, { hp: token.maxHp, mp: token.maxMp, conditions: newConds });
      addLog(`🛏 ${token.name} fez um descanso longo. HP e MP totalmente recuperados.`, 'heal');
      playSfx('heal');
      showFeedback(`🛏 Descanso Longo`);
    },
    'ctrl+shift+f': handleOpenCharacterSheet,
    'ctrl+shift+m': () => { if (!isGMRef.current) return; setShowGMPanel(v => { if (!v) setTopModal('gm'); return !v; }); },
    'q': () => {
      const token = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!token) return;
      const dom = token.attributes?.DOM ?? 10;
      const mod = Math.floor((dom - 10) / 2);
      const r = rollDice(1, 20, mod);
      const sign = mod >= 0 ? `+${mod}` : `${mod}`;
      addLog(`⚡ ${token.name} ataque rápido: [${r.rolls[0]}]${mod !== 0 ? sign : ''} = ${r.total}`, 'dice');
      playSfx('dice');
    },
    // Token control
    'tab': () => {
      const ts = tokensRef.current;
      if (!ts.length) return;
      const idx = ts.findIndex(t => t.id === selectedIdRef.current);
      const next = ts[(idx + 1) % ts.length];
      setSelectedId(next.id); centerOnCell(next.x, next.y);
    },
    'shift+tab': () => {
      const ts = tokensRef.current;
      if (!ts.length) return;
      const idx = ts.findIndex(t => t.id === selectedIdRef.current);
      const prev = ts[(idx - 1 + ts.length) % ts.length];
      setSelectedId(prev.id); centerOnCell(prev.x, prev.y);
    },
    'delete': () => {
      if (waypointModeRef.current) { setWaypoints(prev => prev.slice(0, -1)); return; }
      if (selectedWallIdRef.current) {
        setWalls(prev => prev.filter(w => w.id !== selectedWallIdRef.current));
        setSelectedWallId(null);
        return;
      }
      const t = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!t) return;
      if (t.type === 'player' && !window.confirm(`Remover ${t.name}?`)) return;
      deleteToken(t.id); addLog(`${t.name} removido.`, 'system');
    },
    'backspace': () => {
      if (waypointModeRef.current) { setWaypoints(prev => prev.slice(0, -1)); return; }
      if (selectedWallIdRef.current) {
        setWalls(prev => prev.filter(w => w.id !== selectedWallIdRef.current));
        setSelectedWallId(null);
        return;
      }
      const t = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!t) return;
      if (t.type === 'player' && !window.confirm(`Remover ${t.name}?`)) return;
      deleteToken(t.id); addLog(`${t.name} removido.`, 'system');
    },
    'e': () => {
      const token = tokensRef.current.find(tk => tk.id === selectedIdRef.current);
      if (!token) { showFeedback('Selecione um token primeiro'); return; }
      const sab = token.attributes?.SAB ?? 10;
      const mod = Math.floor((sab - 10) / 2);
      const roll = Math.floor(Math.random() * 20) + 1;
      const total = roll + mod;
      const sign = mod >= 0 ? `+${mod}` : `${mod}`;
      addChatMessage({
        id: Date.now(), type: 'dice', sender: token.name, timestamp: Date.now(),
        text: `🛡 ${token.name} tenta proteger: [${roll}]${mod !== 0 ? sign : ''} = **${total}**${roll === 20 ? ' ✨ Crítico!' : ''}`,
        diceResult: { total, rolls: [roll], expr: `1d20${mod !== 0 ? sign : ''}`, isCrit: roll === 20, isFail: roll === 1 },
      });
      playSfx('dice');
    },
    'r': () => {
      if (aimingModeRef2.current) { setAimingMode(null); return; }
      if (selectedIdRef.current) { setShowTechniqueMenu(v => !v); return; }
      // No token: roll initiative fallback (for non-combat open rolls)
      const r2 = rollDice(1, 20, 0);
      addLog(`🎲 Iniciativa: ${r2.total}`, 'dice');
    },
    'escape': () => {
      if (topModal === 'gm' && showGMPanel) { setShowGMPanel(false); setTopModal(null); return; }
      if (showGMPanel) { setShowGMPanel(false); return; }
      if (waypointMode) { cancelWaypoints(); return; }
      if (aimingModeRef2.current) { setAimingMode(null); setShowTechniqueMenu(false); return; }
      if (showTechniqueMenu)  { setShowTechniqueMenu(false); return; }
      if (showShortcuts)      { setShowShortcuts(false); return; }
      if (showPartyOverlay)   { setShowPartyOverlay(false); return; }
      if (targetingMode)      { setTargetingMode(false); return; }
      if (drawingTool)        { setDrawingTool(null); return; }
      if (activeTileTemplate) { setActiveTileTemplate(null); return; }
      setCtxMenu(null); setMeasurements([]); setMeasuring(null);
      setSelectedId(null); setTargetId(null);
    },
    'enter': () => { if (waypointMode) confirmWaypoints(); },
    'y': () => {
      if (!selectedIdRef.current) { showFeedback('Selecione um token primeiro'); return; }
      setTargetingMode(v => !v);
    },
    // Movement (1 cell) — W A S D + arrows
    'arrowup':    (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0, -1, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'arrowdown':  (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0,  1, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'arrowleft':  (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current, -1,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'arrowright': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  1,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'w': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current, 0, -1, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'p': () => {
      if (!selectedIdRef.current) { setShowPartyOverlay(v => !v); return; }
      const tok = tokensRef.current.find(t => t.id === selectedIdRef.current);
      if (!tok) { setShowPartyOverlay(v => !v); return; }
      setWaypointMode(v => {
        if (!v) { setWaypointToken(tok); setWaypoints([]); showFeedback('🗺 Rota: clique nos destinos, Enter confirma, Esc cancela'); }
        else { setWaypointToken(null); setWaypoints([]); }
        return !v;
      });
    },
    's': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0,  1, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'd': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  1,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    // Movement (2 cells — sprint)
    'shift+arrowup':    (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0, -2, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+arrowdown':  (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0,  2, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+arrowleft':  (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current, -2,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+arrowright': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  2,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+w': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0, -2, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+s': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  0,  2, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+a': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current, -2,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    'shift+d': (e) => { if (selectedIdRef.current && canMoveSelected()) moveToken(selectedIdRef.current,  2,  0, (nx, ny) => ensureCellVisible(nx, ny), { walls: wallsRef2.current, bypass: isGMRef.current && !!e?.ctrlKey }); },
    // Quick dice
    'f1': () => { const r = rollDice(1, 20, 0); addLog(`🎲 1d20: [${r.rolls[0]}] = ${r.total}`, 'dice'); playSfx('dice'); },
    'f2': () => { const r = rollDice(1, 6,  0); addLog(`🎲 1d6: [${r.rolls[0]}] = ${r.total}`, 'dice'); playSfx('dice'); },
    'f3': () => { const r = rollDice(2, 6,  0); addLog(`🎲 2d6: [${r.rolls.join(', ')}] = ${r.total}`, 'dice'); playSfx('dice'); },
    'f4': () => { const r = rollDice(3, 8,  0); addLog(`🎲 3d8: [${r.rolls.join(', ')}] = ${r.total}`, 'dice'); playSfx('dice'); },
    'f5': () => { const r = rollDice(1, 100, 0); addLog(`🎲 1d100: [${r.rolls[0]}] = ${r.total}`, 'dice'); playSfx('dice'); },
    // Macro shortcuts (Ctrl+1-5)
    ...Object.fromEntries([1,2,3,4,5].map(n => [`ctrl+${n}`, () => {
      const visible = macrosRef.current.filter(m =>
        (m.owner === (isGMRef.current ? 'gm' : playerNameRef.current)) || (m.isGlobal && !isGMRef.current)
      );
      const macro = visible[n - 1];
      if (!macro) return;
      const tok = tokensRef.current.find(t => t.id === selectedIdRef.current);
      const senderName = tok?.name ?? (isGMRef.current ? 'Mestre' : (playerNameRef.current ?? '?'));
      runMacroCommands(macro.commands.filter(c => c.trim()), { addLog, addChatMessage, senderName });
    }])),
  });

  // ── Map image upload ───────────────────────────────────────────────────────
  const onFileChange = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setBgImage(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const removeImage = useCallback(() => setBgImage(null), []);

  // ── Token selection + camera ───────────────────────────────────────────────
  const onSelectToken = useCallback((token) => {
    setSelectedId(token.id); centerOnCell(token.x, token.y);
  }, [setSelectedId, centerOnCell]);

  // ── Targeting: click on map token ─────────────────────────────────────────
  const onTargetToken = useCallback((tokenId) => {
    const target = tokensRef.current.find(t => t.id === tokenId);
    setTargetId(tokenId);
    setTargetingMode(false);
    if (target) showFeedback(`🎯 Alvo: ${target.name}`);
    addLog(`🎯 Alvo selecionado: ${target?.name ?? '?'}`, 'system');
  }, [tokensRef, addLog, showFeedback]);

  // ── Context menu handlers ──────────────────────────────────────────────────
  const handleDamage = useCallback((tokenId) => {
    setCtxMenu(null);
    const raw = window.prompt('Quantidade de dano:'); if (raw === null) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) {
      const token = tokensRef.current.find(t => t.id === tokenId);
      adjustHp(tokenId, -val);
      if (token) {
        const newHp = Math.max(0, token.hp - val);
        addLog(`${token.name} sofreu ${val} de dano. (HP: ${newHp}/${token.maxHp})`, 'damage');
        if (newHp === 0) { addLog(`💀 ${token.name} caiu!`, 'damage'); playSfx('death'); }
        else playSfx('hit');
      }
    }
  }, [adjustHp, addLog, tokensRef, playSfx]);

  const handleHeal = useCallback((tokenId) => {
    setCtxMenu(null);
    const raw = window.prompt('Quantidade de cura:'); if (raw === null) return;
    const val = parseInt(raw, 10);
    if (!isNaN(val) && val > 0) {
      const token = tokensRef.current.find(t => t.id === tokenId);
      adjustHp(tokenId, val);
      if (token) {
        const newHp = Math.min(token.maxHp, token.hp + val);
        addLog(`${token.name} recebeu ${val} de cura. (HP: ${newHp}/${token.maxHp})`, 'heal');
        playSfx('heal');
      }
    }
  }, [adjustHp, addLog, tokensRef, playSfx]);

  // ── Persistence ────────────────────────────────────────────────────────────
  const buildSaveState = useCallback(() => {
    const partyIds = new Set(party.order);
    const partyTokens = tokens.filter(t => partyIds.has(t.id));
    const sceneTokens  = tokens.filter(t => !partyIds.has(t.id));
    const partyPositions = Object.fromEntries(partyTokens.map(t => [t.id, { x: t.x, y: t.y }]));
    const currentSceneData = {
      ...sceneManager.activeScene,
      mapImage: bgImage,
      fog: { enabled: fogEnabled, revealedCells: [...revealedCells] },
      markers, paintedCells, weather,
      aoes: aoeState.aoes,
      walls,
      drawings: drawingState.drawings,
      tiles,
      tokens: sceneTokens, partyPositions,
    };
    const allScenes = sceneManager.scenes.map(s =>
      s.id === sceneManager.activeSceneId ? currentSceneData : s
    );
    return {
      scenes: allScenes,
      activeSceneId: sceneManager.activeSceneId,
      partyTokens,
      log, showGrid,
      combatActive, currentRound, currentTurnIndex, initiativeOrder,
      partyData: party.partyData,
      chatMessages: chatMessages.slice(-200),
      sheets: sheetState.sheets,
      customConditions,
      tokenGroups,
      journalEntries,
      compendiumEntries,
      rollableTables,
      macros,
      timerEnabled,
      timerDuration,
      timerSoundEnabled,
    };
  }, [
    tokens, bgImage, fogEnabled, revealedCells, markers, paintedCells, weather, log, showGrid,
    combatActive, currentRound, currentTurnIndex, initiativeOrder,
    party.order, party.partyData, sceneManager, chatMessages, aoeState.aoes, walls, drawingState.drawings,
    tiles, sheetState.sheets, customConditions, tokenGroups,
    journalEntries, compendiumEntries, rollableTables,
    macros, timerEnabled, timerDuration, timerSoundEnabled,
  ]);

  const handleSave = useCallback(() => {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(buildSaveState())); showToast('Sessão salva!'); }
    catch { showToast('Erro: dados muito grandes para salvar.'); }
  }, [buildSaveState, showToast]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildSaveState(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = 'sessao-crepusculo.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url); addLog('Sessão exportada.', 'system');
  }, [buildSaveState, addLog]);

  const handleImportChange = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = '';
    if (!window.confirm('Isto substituirá a sessão atual. Continuar?')) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const s = JSON.parse(ev.target.result);
        const hasScenes = Array.isArray(s.scenes) && s.scenes.length > 0;

        if (hasScenes) {
          const active = s.scenes.find(sc => sc.id === s.activeSceneId) ?? s.scenes[0];
          const allToks = [...(s.partyTokens ?? []), ...(active?.tokens ?? [])];
          setTokens(allToks); resetIdCounter(allToks); setSelectedId(null);
          setBgImage(active?.mapImage ?? null);
          setFogEnabled(active?.fog?.enabled ?? false);
          setRevealedCells(new Set(active?.fog?.revealedCells ?? []));
          setMarkers(active?.markers ?? []);
          setPaintedCells(active?.paintedCells ?? {});
          setWeather(active?.weather ?? 'none');
          aoeState.setAoes(active?.aoes ?? []);
          drawingState.setDrawings(active?.drawings ?? []);
          setTiles(active?.tiles ?? []);
          setSelectedTileId(null);
          setWalls(sanitizeWalls(active?.walls ?? []));
          setSelectedWallId(null);
          sceneManager.setScenes(s.scenes);
          sceneManager.setActiveSceneId(s.activeSceneId ?? s.scenes[0].id);
        } else {
          // Legacy format
          const t = s.tokens ?? [];
          setTokens(t); resetIdCounter(t); setSelectedId(null);
          setBgImage(s.bgImage ?? null);
          setFogEnabled(s.fogEnabled ?? false);
          setRevealedCells(new Set(s.revealedCells ?? []));
          setMarkers(s.markers ?? []);
          setPaintedCells(s.paintedCells ?? {});
          setWeather(s.weather ?? 'none');
          const partyIds = new Set(s.partyData?.order ?? []);
          const legacyScene = makeScene({
            name: 'Cena Principal',
            mapImage: s.bgImage ?? null,
            tokens: t.filter(tk => !partyIds.has(tk.id)),
            fog: { enabled: s.fogEnabled ?? false, revealedCells: s.revealedCells ?? [] },
            markers: s.markers ?? [],
            paintedCells: s.paintedCells ?? {},
            weather: s.weather ?? 'none',
          });
          sceneManager.setScenes([legacyScene]);
          sceneManager.setActiveSceneId(legacyScene.id);
        }

        setPaintHistory([]);
        setLog(s.log ?? []);
        setChatMessages(s.chatMessages ?? []);
        setShowGrid(s.showGrid ?? true);
        setCombatActive(s.combatActive ?? false);
        setCurrentRound(s.currentRound ?? 1);
        setCurrentTurnIndex(s.currentTurnIndex ?? 0);
        setInitiativeOrder(s.initiativeOrder ?? []);
        party.loadFromSave(s.partyData ?? null);
        sheetState.loadSheets(s.sheets ?? []);
        setCustomConditions(s.customConditions ?? []);
        setTokenGroups(s.tokenGroups ?? []);
        setJournalEntries(s.journalEntries ?? []);
        setCompendiumEntries(s.compendiumEntries ?? []);
        setRollableTables(s.rollableTables ?? []);
        setMacros(s.macros ?? []);
        setTimerEnabled(s.timerEnabled ?? false);
        setTimerDuration(s.timerDuration ?? 60);
        setTimerSoundEnabled(s.timerSoundEnabled ?? true);
        setOpenSheetIds([]);
        showToast('Sessão importada!');
      } catch { alert('Arquivo inválido ou corrompido.'); }
    };
    reader.readAsText(file);
  }, [setTokens, resetIdCounter, setSelectedId, showToast, party, sceneManager, aoeState, drawingState, sheetState,
      setJournalEntries, setCompendiumEntries, setRollableTables,
      setMacros, setTimerEnabled, setTimerDuration, setTimerSoundEnabled]);

  const handleNewSession = useCallback(() => {
    if (!window.confirm('Apagar tudo e começar nova sessão?')) return;
    const fresh = makeScene({ name: 'Cena Principal' });
    setTokens([]); resetIdCounter([]); setSelectedId(null); setBgImage(null);
    setLog([]); setShowGrid(true); setCombatActive(false); setInitiativeOrder([]);
    setCurrentRound(1); setCurrentTurnIndex(0); setFogEnabled(false); setRevealedCells(new Set());
    setMarkers([]); setPaintedCells({}); setPaintHistory([]); setWeather('none');
    setChatMessages([]); aoeState.clearAoes(); setWalls([]); setSelectedWallId(null);
    setTiles([]); setSelectedTileId(null); drawingState.clearDrawings();
    sceneManager.setScenes([fresh]);
    sceneManager.setActiveSceneId(fresh.id);
    party.resetParty();
    sheetState.loadSheets([]); setOpenSheetIds([]);
    setCustomConditions([]); setTokenGroups([]);
    setJournalEntries([]); setCompendiumEntries([]); setRollableTables([]);
    setMacros([]); setTimerEnabled(false); setTimerDuration(60); setTimerSoundEnabled(true);
    localStorage.removeItem(STATE_KEY); showToast('Sessão limpa!');
  }, [setTokens, resetIdCounter, setSelectedId, showToast, party, sceneManager, aoeState, sheetState,
      setJournalEntries, setCompendiumEntries, setRollableTables,
      setMacros, setTimerEnabled, setTimerDuration, setTimerSoundEnabled]);

  // ── Token groups ──────────────────────────────────────────────────────────
  const handleCreateGroup = useCallback((name, color) => {
    const id = `grp-${Date.now()}`;
    setTokenGroups(prev => [...prev, { id, name, color, tokenIds: [], isCollapsed: false }]);
    return id;
  }, []);

  const handleUpdateGroup = useCallback((groupId, changes) => {
    setTokenGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...changes } : g));
  }, []);

  const handleDeleteGroup = useCallback((groupId, deleteTokens) => {
    if (deleteTokens) {
      const group = tokenGroups.find(g => g.id === groupId);
      if (group) setTokens(prev => prev.filter(t => !group.tokenIds.includes(t.id)));
    }
    setTokenGroups(prev => prev.filter(g => g.id !== groupId));
  }, [tokenGroups, setTokens]);

  const handleBulkCreateTokens = useCallback((groupId, baseName, count, hp, ac, level, image = null) => {
    const group = tokenGroups.find(g => g.id === groupId);
    if (!group) return;
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    const newTokenIds = [];
    setTokens(prev => {
      const occupied = new Set(prev.map(t => `${t.x},${t.y}`));
      const created = [];
      let searchRadius = 0;
      for (let i = 0; i < count; i++) {
        let placed = false;
        while (!placed) {
          for (let dx = -searchRadius; dx <= searchRadius && !placed; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius && !placed; dy++) {
              if (Math.abs(dx) !== searchRadius && Math.abs(dy) !== searchRadius) continue;
              const nx = cx + dx, ny = cy + dy;
              if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && !occupied.has(`${nx},${ny}`)) {
                const id = `tok-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                newTokenIds.push(id);
                occupied.add(`${nx},${ny}`);
                created.push({
                  id, name: `${baseName} ${i + 1}`, type: 'npc', owner: null,
                  x: nx, y: ny, hp, maxHp: hp, mp: 0, maxMp: 0,
                  ac, movement: 9, color: group.color,
                  image: image ?? null, level, race: '', profession: '',
                  attributes: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 },
                  conditions: [], hidden: false, visibleToAll: true,
                  lightRadius: 0, lightColor: '#ffd700', darkvision: false,
                  size: 1, profBonus: 2, weaponDice: '1d6', initiative: 0,
                  techniques: [], proficiencies: [], inventory: [], gold: 0,
                  aura: '', notes: '',
                });
                placed = true;
              }
            }
          }
          searchRadius++;
        }
      }
      return [...prev, ...created];
    });
    setTimeout(() => {
      setTokenGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, tokenIds: [...g.tokenIds, ...newTokenIds] } : g
      ));
    }, 0);
  }, [tokenGroups, setTokens, COLS, ROWS]);

  // ── Journal handlers ─────────────────────────────────────────────────────
  const handleAddJournal    = useCallback((e)      => setJournalEntries(prev => [...prev, e]), []);
  const handleUpdateJournal = useCallback((id, p)  => setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, ...p } : e)), []);
  const handleDeleteJournal = useCallback((id)     => setJournalEntries(prev => prev.filter(e => e.id !== id)), []);

  // ── Compendium handlers ───────────────────────────────────────────────────
  const handleAddCompendium    = useCallback((e)     => setCompendiumEntries(prev => [...prev, e]), []);
  const handleUpdateCompendium = useCallback((id, p) => setCompendiumEntries(prev => prev.map(e => e.id === id ? { ...e, ...p } : e)), []);
  const handleDeleteCompendium = useCallback((id)    => setCompendiumEntries(prev => prev.filter(e => e.id !== id)), []);

  const handleCreateTokenFromCompendium = useCallback((entry) => {
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    const tok = {
      id: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      name: entry.name, type: 'npc', image: entry.image ?? null,
      level: entry.stats?.tier ?? 1, race: 'Criatura', profession: entry.name,
      hp: entry.stats?.hp ?? 10, maxHp: entry.stats?.hp ?? 10,
      mp: 0, maxMp: 0, ac: entry.stats?.ac ?? 10,
      initiative: 0, movement: entry.stats?.mov ?? 6,
      attributes: { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 },
      aura: '', conditions: [], notes: entry.description ?? '',
      lightBright: 0, lightDim: 0, lightColor: '#ffd700',
      visionRange: 18, darkvision: false,
      owner: 'gm', visibleToAll: false, hidden: false,
      x: cx, y: cy, color: '#e05555',
    };
    setTokens(prev => [...prev, tok]);
    setSelectedId(tok.id);
    addLog(`🎭 ${entry.name} adicionado ao mapa.`, 'system');
  }, [setTokens, setSelectedId, addLog]);

  // ── Rollable table handlers ───────────────────────────────────────────────
  const handleAddTable    = useCallback((t)     => setRollableTables(prev => [...prev, t]), []);
  const handleUpdateTable = useCallback((id, p) => setRollableTables(prev => prev.map(t => t.id === id ? { ...t, ...p } : t)), []);
  const handleDeleteTable = useCallback((id)    => setRollableTables(prev => prev.filter(t => t.id !== id)), []);

  // ── Waypoint start (Shift+Click on non-party token) ──────────────────────
  const handleWaypointStart = useCallback((token, col, row) => {
    setWaypointMode(true);
    setWaypointToken(token);
    setWaypoints([{ x: col, y: row }]);
    showFeedback('🗺 Rota: clique nos destinos, Enter confirma, Esc cancela');
  }, [showFeedback]);

  // ── Macro handlers ────────────────────────────────────────────────────────
  const handleAddMacro    = useCallback((m)     => setMacros(prev => [...prev, m]), []);
  const handleUpdateMacro = useCallback((id, p) => setMacros(prev => prev.map(m => m.id === id ? { ...m, ...p } : m)), []);
  const handleDeleteMacro = useCallback((id)    => setMacros(prev => prev.filter(m => m.id !== id)), []);

  // ── Active effect handlers ────────────────────────────────────────────────
  const handleAddEffect = useCallback((tokenId, effect) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    updateToken(tokenId, { activeEffects: [...(token.activeEffects ?? []), effect] });
  }, [updateToken, tokensRef]);

  const handleUpdateEffect = useCallback((tokenId, effectId, patch) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    updateToken(tokenId, { activeEffects: (token.activeEffects ?? []).map(e => e.id === effectId ? { ...e, ...patch } : e) });
  }, [updateToken, tokensRef]);

  const handleRemoveEffect = useCallback((tokenId, effectId) => {
    const token = tokensRef.current.find(t => t.id === tokenId);
    if (!token) return;
    updateToken(tokenId, { activeEffects: (token.activeEffects ?? []).filter(e => e.id !== effectId) });
  }, [updateToken, tokensRef]);

  // ── Player removal ────────────────────────────────────────────────────────
  const handleRemovePlayer = useCallback((pName) => {
    sheetState.sheets.filter(s => s.owner === pName)
      .forEach(s => sheetState.updateSheet(s.id, { owner: null, category: 'npc', sharedWith: [] }));
    setTokens(prev => prev.map(t => t.owner === pName ? { ...t, owner: null, type: 'npc' } : t));
    addLog(`🗑 Jogador ${pName} removido. Fichas transferidas ao Mestre.`, 'system');
  }, [sheetState, setTokens, addLog]);

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: 'var(--bg)' }}>

        {/* ── Header (32px) ── */}
        <div style={{
          height: 32, flexShrink: 0,
          background: 'var(--panel)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 600, fontStyle: 'italic', letterSpacing: '0.04em' }}>
              Crepúsculo dos Reinos
            </div>
            <RoleBadge onSwitch={clearRole} />
          </div>
          <div style={{ flex: 1, textAlign: 'center', fontSize: 11, minWidth: 0 }}>
            {combatActive && combatTurnToken ? (
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>
                Round {currentRound} · Turno de {combatTurnToken.name}
              </span>
            ) : combatActive ? (
              <span style={{ color: 'var(--sub)' }}>Round {currentRound}</span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {isGM && <button className="tbtn" title="Salvar"   onClick={handleSave}   style={{ padding: '2px 7px', fontSize: 13 }}>💾</button>}
            {isGM && <button className="tbtn" title="Exportar" onClick={handleExport} style={{ padding: '2px 7px', fontSize: 13 }}>📥</button>}
            {isGM && <button className="tbtn" title="Importar" onClick={() => importFileRef.current?.click()} style={{ padding: '2px 7px', fontSize: 13 }}>📤</button>}
            {isGM && <button className="tbtn" title="Nova sessão" onClick={handleNewSession} style={{ padding: '2px 7px', fontSize: 13 }}>🗑</button>}
            <button className="tbtn" title="Atalhos (?)" onClick={() => setShowShortcuts(v => !v)} style={{ padding: '2px 7px', fontSize: 13 }}>⌨</button>
          </div>
        </div>

        {/* ── Targeting banner ── */}
        {targetingMode && (
          <div style={{
            height: 28, flexShrink: 0,
            background: 'rgba(201,169,110,0.12)', borderBottom: '1px solid var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.04em',
          }}>
            🎯 Selecione um alvo... &nbsp;
            <span style={{ color: 'var(--sub)', fontWeight: 400 }}>(Esc para cancelar)</span>
          </div>
        )}

        {/* ── Preview banner ── */}
        {isPreviewMode && (
          <div style={{
            height: 28, flexShrink: 0,
            background: 'rgba(74,90,200,0.15)', borderBottom: '1px solid #4a5ac8',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 11, color: '#8090e8', fontWeight: 600, letterSpacing: '0.04em',
          }}>
            👁 VISUALIZANDO COMO: {previewAs}
            <button
              onClick={() => { stopPreview(); setPlayerView(false); }}
              style={{
                background: 'none', border: '1px solid #4a5ac8', color: '#8090e8',
                borderRadius: 4, padding: '1px 8px', cursor: 'pointer', fontSize: 10,
              }}
            >✕ Voltar</button>
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

          {/* ── Left: map + toolbar ── */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* ── Scene tab bar ── */}
            <SceneManager
              scenes={sceneManager.scenes}
              activeSceneId={sceneManager.activeSceneId}
              onSwitch={switchScene}
              onCreate={handleSceneCreate}
              onRename={sceneManager.renameScene}
              onDuplicate={handleSceneDuplicate}
              onDelete={sceneId => {
                const wasActive = sceneId === sceneManager.activeSceneId;
                sceneManager.deleteScene(sceneId);
                if (wasActive) {
                  const remaining = sceneManager.scenesRef.current.filter(s => s.id !== sceneId);
                  if (remaining.length > 0) switchScene(remaining[0].id);
                }
              }}
              onReorder={sceneManager.reorderScenes}
              onConfigGrid={handleSceneConfigGrid}
              notes={sceneManager.activeScene?.notes ?? ''}
              onUpdateNotes={handleSceneUpdateNotes}
            />

            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>

            {/* ── Aiming banner ── */}
            {aimingMode && (
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, zIndex: 180,
                background: 'rgba(201,169,110,0.12)', borderBottom: '1px solid var(--gold)',
                height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: 'var(--gold)', fontWeight: 600, letterSpacing: '0.04em',
                pointerEvents: 'none',
              }}>
                🎯 {aimingMode.sourceToken?.name} — Mire a técnica (clique para confirmar)&nbsp;
                <span style={{ color: 'var(--sub)', fontWeight: 400 }}>(Esc / Botão Dir. para cancelar)</span>
              </div>
            )}

            {/* ── Action bar (character-centric, shown when token selected + can control it) ── */}
            <ActionBar
              selectedToken={(() => {
                const t = tokens.find(tk => tk.id === selectedId);
                if (!t) return null;
                if (!isGM && t.owner !== rolePlayerName) return null;
                return t;
              })()}
              tokens={tokens}
              aoes={aoeState.aoes}
              addAoe={aoeState.addAoe}
              aimingMode={aimingMode}
              setAimingMode={setAimingMode}
              addChatMessage={addChatMessage}
              addLog={addLog}
              playSfx={playSfx}
              showTechniqueMenu={showTechniqueMenu}
              setShowTechniqueMenu={setShowTechniqueMenu}
              currentRound={currentRound}
              targetingMode={targetingMode}
              setTargetingMode={setTargetingMode}
            />

            {/* Fade overlay for scene transitions */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 200,
              background: 'var(--bg)',
              opacity: fading ? 1 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: fading ? 'all' : 'none',
            }} />

            <MapCanvas
              containerRef={containerRef}
              camera={camera}
              tokenState={tokenState}
              tool={tool}
              toolRef={toolRef}
              showGrid={showGrid}
              bgImage={bgImage}
              setCtxMenu={setCtxMenu}
              combatTurnTokenId={combatTurnTokenId}
              addLog={addLog}
              fogEnabled={fogEnabled}
              revealedCells={revealedCells}
              setRevealedCells={setRevealedCells}
              measurements={measurements}
              setMeasurements={setMeasurements}
              measuring={measuring}
              setMeasuring={setMeasuring}
              targetingMode={targetingMode}
              targetId={targetId}
              onTargetToken={onTargetToken}
              partyOrderRef={partyOrderRef}
              onGroupMove={onGroupMove}
              onOpenSheet={handleOpenSheetForToken}
              markers={markers}
              setMarkers={setMarkers}
              paintedCells={paintedCells}
              setPaintedCells={setPaintedCells}
              setPaintHistory={setPaintHistory}
              paintColor={paintColor}
              floatingNums={floatingNums}
              weather={weather}
              gridCols={sceneCols}
              gridRows={sceneRows}
              aoes={aoeState.aoes}
              onUpdateAoe={aoeState.updateAoe}
              onRemoveAoe={aoeState.removeAoe}
              onClearAllAoes={aoeState.clearAoes}
              aimingMode={aimingMode}
              onAoeConfirm={handleAoeConfirm}
              onAoeCancel={handleAoeCancel}
              walls={walls}
              selectedWallId={selectedWallId}
              onSelectWall={onSelectWall}
              onAddWall={onAddWall}
              showWalls={showWalls}
              lightingEnabled={lightingEnabled}
              playerView={playerView || isPreviewMode}
              blockedWallId={blockedWallId}
              onDragBlocked={handleDragBlocked}
              sheets={sheetState.sheets}
              tokenGroups={tokenGroups}
              tiles={tiles}
              selectedTileId={selectedTileId}
              onSelectTile={setSelectedTileId}
              onUpdateTile={handleUpdateTile}
              onRemoveTile={handleRemoveTile}
              onAddTile={handleAddTile}
              activeTileTemplate={activeTileTemplate}
              wallDrawMode={wallDrawMode}
              onDoorInteract={handleDoorInteract}
              onWallConvert={handleWallConvert}
              onWallContextMenu={handleWallContextMenu}
              hexGrid={hexGrid}
              drawings={drawingState.drawings}
              drawingTool={drawingTool}
              drawingConfig={drawingConfig}
              drawingAuthor={drawingAuthor}
              canDraw={canDraw}
              onAddDrawing={drawingState.addDrawing}
              onRemoveByIds={drawingState.removeByIds}
              pings={pings}
              onMapPing={(mx, my) => addPing(mx, my, pointerColor, drawingAuthor)}
              pointerPos={isGM ? pointerPos : null}
              pointerColor={pointerColor}
              onPointerMove={isGM ? setPointerPos : null}
              onPointerClear={isGM ? () => setPointerPos(null) : null}
              waypointMode={waypointMode}
              waypointToken={waypointToken}
              waypoints={waypoints}
              onWaypointAdd={(col, row) => setWaypoints(prev => [...prev, { x: col, y: row }])}
              onWaypointConfirm={confirmWaypoints}
              onWaypointCancel={cancelWaypoints}
              onWaypointStart={handleWaypointStart}
              zKeyRef={zKeyRef}
            />

            {/* ── Toolbar ── */}
            <div style={{
              height: 48, flexShrink: 0,
              background: 'var(--panel)', borderTop: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', overflow: 'hidden',
            }}>
              <button className={`tbtn${tool === 'select'     ? ' active' : ''}`} onClick={() => setTool('select')} title="Selecionar (T)">Sel.</button>
              <LockedTool locked={!isGM}><button className={`tbtn${tool === 'add-player' ? ' active' : ''}`} onClick={() => setTool('add-player')}>+ Jog.</button></LockedTool>
              <LockedTool locked={!isGM}><button className={`tbtn${tool === 'add-npc'    ? ' active' : ''}`} onClick={() => setTool('add-npc')}>+ NPC</button></LockedTool>
              <button className={`tbtn${tool === 'measure'    ? ' active' : ''}`} onClick={() => setTool(t => t === 'measure' ? 'select' : 'measure')} title="Medir (M)">Medir</button>
              <LockedTool locked={!isGM}><button className={`tbtn${tool === 'marker'     ? ' active' : ''}`} onClick={() => setTool(t => t === 'marker' ? 'select' : 'marker')} title="Marcador (K)">📌</button></LockedTool>
              <LockedTool locked={!isGM}><button className={`tbtn${tool === 'paint'      ? ' active' : ''}`} onClick={() => setTool(t => t === 'paint'  ? 'select' : 'paint')}  title="Pintar (J)">🎨</button></LockedTool>

              {/* Paint colors — visible when paint tool is active (GM only) */}
              {isGM && tool === 'paint' && (
                <>
                  {[
                    { color: '#c43030', label: 'Perigo' },
                    { color: '#4a9a5a', label: 'Seguro' },
                    { color: '#3a6abf', label: 'Água' },
                    { color: '#c47830', label: 'Terreno Difícil' },
                    { color: '#8a4abd', label: 'Zona Mágica' },
                    { color: '#555566', label: 'Parede' },
                  ].map(p => (
                    <button key={p.color} title={p.label} onClick={() => setPaintColor(p.color)} style={{
                      width: 18, height: 18, borderRadius: 3, flexShrink: 0,
                      background: p.color, cursor: 'pointer', padding: 0, border: 'none',
                      outline: paintColor === p.color ? '2px solid white' : '2px solid transparent',
                      outlineOffset: 1,
                    }} />
                  ))}
                  <input
                    type="color"
                    value={paintColor}
                    onChange={e => setPaintColor(e.target.value)}
                    title="Cor personalizada"
                    style={{ width: 22, height: 22, cursor: 'pointer', padding: 0, border: 'none', background: 'none', flexShrink: 0 }}
                  />
                </>
              )}

              <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
              <LockedTool locked={!isGM}><button className={`tbtn${tool === 'wall' ? ' active' : ''}`} onClick={() => setTool(t => t === 'wall' ? 'select' : 'wall')} title="Paredes (B)">🧱</button></LockedTool>
              {/* Wall/Door mode toggle (GM only, wall tool active) */}
              {isGM && tool === 'wall' && (
                <>
                  <button
                    className={`tbtn${wallDrawMode === 'wall' ? ' active' : ''}`}
                    onClick={() => setWallDrawMode('wall')}
                    title="Desenhar parede">🧱 Parede</button>
                  <button
                    className={`tbtn${wallDrawMode === 'door' ? ' active' : ''}`}
                    onClick={() => setWallDrawMode('door')}
                    title="Desenhar porta">🚪 Porta</button>
                </>
              )}
              {isGM && selectedWallId && (() => {
                const selWall = walls.find(w => w.id === selectedWallId);
                if (!selWall) return null;
                const isDoor = selWall.type === 'door';
                return (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--sub)', padding: '0 2px', whiteSpace: 'nowrap' }}>
                      {isDoor
                        ? (selWall.state === 'open' ? '🚪 Aberta' : selWall.state === 'locked' ? '🔒 Trancada' : '🚪 Fechada')
                        : '🧱 Parede'}
                    </span>
                    {isDoor && selWall.state !== 'open' && (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, state: 'open' } : w))}>
                        Abrir
                      </button>
                    )}
                    {isDoor && selWall.state === 'open' && (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, state: 'closed' } : w))}>
                        Fechar
                      </button>
                    )}
                    {isDoor && selWall.state !== 'locked' && (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, state: 'locked' } : w))}>
                        Trancar
                      </button>
                    )}
                    {isDoor && selWall.state === 'locked' && (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, state: 'closed' } : w))}>
                        Destrancar
                      </button>
                    )}
                    {isDoor ? (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        title="Converter para parede"
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, type: 'wall', state: undefined } : w))}>
                        🧱
                      </button>
                    ) : (
                      <button className="tbtn" style={{ fontSize: 10 }}
                        title="Converter para porta"
                        onClick={() => setWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, type: 'door', state: 'closed' } : w))}>
                        🚪
                      </button>
                    )}
                    <button className="tbtn" style={{ fontSize: 10, color: '#e05555' }}
                      title="Remover"
                      onClick={() => { setWalls(prev => prev.filter(w => w.id !== selectedWallId)); setSelectedWallId(null); }}>
                      🗑
                    </button>
                  </>
                );
              })()}
              {isGM && aoeState.aoes.length > 0 && (
                <button className="tbtn" style={{ color: '#e05555' }}
                  onClick={() => { if (window.confirm('Remover todas as áreas de efeito do mapa?')) aoeState.clearAoes(); }}
                  title="Limpar todas as áreas de efeito">🗑 AoEs</button>
              )}

              {/* ── Drawing tools panel (X) ── */}
              {canDraw && (
                <>
                  <button
                    className={`tbtn${showDrawingPanel ? ' active' : ''}`}
                    onClick={() => setShowDrawingPanel(v => !v)}
                    title="Ferramentas de desenho (X)"
                  >✏ Desenho</button>
                  {showDrawingPanel && (
                    <>
                      {[
                        { id: 'freehand',   label: '✏' , title: 'Livre' },
                        { id: 'line',       label: '╱' , title: 'Linha' },
                        { id: 'circle',     label: '○' , title: 'Círculo' },
                        { id: 'rect',       label: '□' , title: 'Retângulo' },
                        { id: 'filledRect', label: '■' , title: 'Retângulo Preenchido' },
                        { id: 'text',       label: 'T' , title: 'Texto' },
                        { id: 'eraser',     label: '⌫' , title: 'Borracha' },
                      ].map(dt => (
                        <button
                          key={dt.id}
                          className={`tbtn${drawingTool === dt.id ? ' active' : ''}`}
                          title={dt.title}
                          onClick={() => setDrawingTool(t => t === dt.id ? null : dt.id)}
                          style={{ padding: '4px 7px', fontSize: 13 }}
                        >{dt.label}</button>
                      ))}
                      <input
                        type="color"
                        value={drawingConfig.color}
                        onChange={e => setDrawingConfig(c => ({ ...c, color: e.target.value }))}
                        title="Cor do desenho"
                        style={{ width: 22, height: 22, cursor: 'pointer', padding: 0, border: 'none', background: 'none', flexShrink: 0 }}
                      />
                      <input
                        type="range" min={1} max={12}
                        value={drawingConfig.strokeWidth}
                        onChange={e => setDrawingConfig(c => ({ ...c, strokeWidth: +e.target.value }))}
                        title={`Espessura: ${drawingConfig.strokeWidth}px`}
                        style={{ width: 60, flexShrink: 0 }}
                      />
                      {drawingState.drawings.length > 0 && (
                        <button className="tbtn" style={{ color: '#e05555' }}
                          onClick={() => { if (window.confirm('Apagar todos os desenhos?')) drawingState.clearDrawings(); }}
                          title="Apagar todos os desenhos">🗑 Desen.</button>
                      )}
                      {isGM && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={playersCanDraw}
                            onChange={e => setPlayersCanDraw(e.target.checked)}
                          />
                          Jogadores
                        </label>
                      )}
                    </>
                  )}
                </>
              )}

              <LockedTool locked={!isGM}><button className={`tbtn${lightingEnabled ? ' active' : ''}`} onClick={() => setLightingEnabled(v => !v)} title="Iluminação dinâmica">💡</button></LockedTool>
              <LockedTool locked={!isGM}><button className={`tbtn${playerView || isPreviewMode ? ' active' : ''}`} onClick={() => setPlayerView(v => !v)} title="Alternar visão Mestre/Jogador (V)">{playerView || isPreviewMode ? '👤' : '🧙'}</button></LockedTool>
              {isGM && players.length > 0 && (
                <select
                  className="vtt-select"
                  value={previewAs ?? ''}
                  onChange={e => {
                    if (!e.target.value) { stopPreview(); setPlayerView(false); }
                    else { startPreview(e.target.value); setPlayerView(true); }
                  }}
                  title="Ver como jogador (V)"
                  style={{ fontSize: 11, padding: '2px 20px 2px 6px', height: 26, flexShrink: 0, maxWidth: 120 }}
                >
                  <option value="">👁 Ver como...</option>
                  {players.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              )}
              <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
              <button className={`tbtn${showGrid   ? ' active' : ''}`} onClick={() => setShowGrid(g => !g)} title="Grade (G)">Grade</button>
              <LockedTool locked={!isGM}><button className={`tbtn${fogEnabled ? ' active' : ''}`} onClick={() => setFogEnabled(f => !f)} title="Névoa (F)">Névoa</button></LockedTool>
              <LockedTool locked={!isGM}>
                <select
                  className="vtt-select"
                  value={weather}
                  onChange={e => setWeather(e.target.value)}
                  title="Clima"
                  style={{ fontSize: 11, padding: '2px 20px 2px 6px', height: 26, flexShrink: 0 }}
                >
                  <option value="none">☁ Clima</option>
                  <option value="rain">🌧 Chuva</option>
                  <option value="snow">❄ Neve</option>
                  <option value="fog">🌫 Névoa</option>
                  <option value="storm">⛈ Tempestade</option>
                </select>
              </LockedTool>
              {/* Tile objects (GM only) */}
              {isGM && (
                <button
                  className={`tbtn${showTilePanel ? ' active' : ''}`}
                  onClick={() => setShowTilePanel(v => !v)}
                  title="Objetos (O)">📦 Obj.</button>
              )}
              {/* Hex grid toggle (GM only) */}
              {isGM && (
                <button
                  className={`tbtn${hexGrid ? ' active' : ''}`}
                  onClick={() => setHexGrid(!hexGrid)}
                  title="Alternar grade hexagonal">⬡ Hex</button>
              )}
              <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
              <button className="tbtn" onClick={() => zoomAtCenter(0.1)}>+</button>
              <button className="tbtn" onClick={() => zoomAtCenter(-0.1)}>−</button>
              <button className="tbtn" title="Resetar zoom" onClick={resetZoom}>Zoom</button>
              <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />
              <LockedTool locked={!isGM}><button className={`tbtn${bgImage ? ' active' : ''}`} onClick={() => fileInputRef.current?.click()}>
                {bgImage ? 'Trocar' : 'Mapa'}
              </button></LockedTool>
              {isGM && bgImage && <button className="tbtn" onClick={removeImage}>✕</button>}
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: 'none' }} onChange={onFileChange} />
              <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0, marginLeft: 'auto' }} />
              <button
                className={`tbtn${openSheetIds.length > 0 ? ' active' : ''}`}
                style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
                title="Abrir Ficha (Ctrl+Shift+F)"
                onClick={handleOpenCharacterSheet}
              >📋 Ficha</button>
              {isGM && (
                <button
                  style={{
                    background: showGMPanel ? 'rgba(201,169,110,0.2)' : 'rgba(201,169,110,0.08)',
                    border: `1px solid ${showGMPanel ? '#c9a96e88' : '#c9a96e33'}`,
                    color: '#c9a96e', padding: '5px 11px', borderRadius: 5,
                    fontSize: 11, fontFamily: "'Cinzel', serif",
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  title="Painel do Mestre (Ctrl+Shift+M)"
                  onClick={() => { setShowGMPanel(v => { const next = !v; if (next) setTopModal('gm'); return next; }); }}
                >🎭 Mestre</button>
              )}
              <div style={{ color: 'var(--sub)', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 1 }}>
                ? → atalhos · T K J M F G · N · F1-F5
              </div>
            </div>
            </div>{/* close flex wrapper for map+fade */}
          </div>

          {/* ── Sidebar ── */}
          {sidebarOpen ? (
            <Sidebar
              tokenState={tokenState}
              onSelectToken={onSelectToken}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              combatActive={combatActive}
              setCombatActive={setCombatActive}
              currentRound={currentRound}
              setCurrentRound={setCurrentRound}
              currentTurnIndex={currentTurnIndex}
              setCurrentTurnIndex={setCurrentTurnIndex}
              initiativeOrder={initiativeOrder}
              setInitiativeOrder={setInitiativeOrder}
              advanceTurn={advanceTurn}
              addLog={addLog}
              playSfx={playSfx}
              log={log}
              clearLog={clearLog}
              chatMessages={chatMessages}
              addChatMessage={addChatMessage}
              clearChat={clearChat}
              audioManagerRef={audioManagerRef}
              targetId={targetId}
              setTargetId={setTargetId}
              partyOrder={party.order}
              isMember={party.isMember}
              addMember={party.addMember}
              removeMember={party.removeMember}
              reorderMembers={party.reorderMembers}
              partyFull={party.order.length >= MAX_PARTY}
              sharedGold={party.sharedGold}
              setSharedGold={party.setSharedGold}
              onShortRest={handleShortRest}
              onLongRest={handleLongRest}
              onDivideGold={handleDivideGold}
              combatTurnTokenId={combatTurnTokenId}
              sheetState={sheetState}
              onOpenSheet={handleOpenSheetForToken}
              onOpenSheetById={openSheet}
              customConditions={customConditions}
              onUpdateCustomConditions={setCustomConditions}
              onRemovePlayer={handleRemovePlayer}
              tokenGroups={tokenGroups}
              onCreateGroup={handleCreateGroup}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              onBulkCreateTokens={handleBulkCreateTokens}
              journalEntries={journalEntries}
              onAddJournal={handleAddJournal}
              onUpdateJournal={handleUpdateJournal}
              onDeleteJournal={handleDeleteJournal}
              compendiumEntries={compendiumEntries}
              onAddCompendium={handleAddCompendium}
              onUpdateCompendium={handleUpdateCompendium}
              onDeleteCompendium={handleDeleteCompendium}
              onCreateTokenFromCompendium={handleCreateTokenFromCompendium}
              rollableTables={rollableTables}
              onAddTable={handleAddTable}
              onUpdateTable={handleUpdateTable}
              onDeleteTable={handleDeleteTable}
              timerEnabled={timerEnabled}
              setTimerEnabled={setTimerEnabled}
              timerDuration={timerDuration}
              setTimerDuration={setTimerDuration}
              timerSoundEnabled={timerSoundEnabled}
              setTimerSoundEnabled={setTimerSoundEnabled}
              onAddEffect={handleAddEffect}
              onUpdateEffect={handleUpdateEffect}
              onRemoveEffect={handleRemoveEffect}
            />
          ) : (
            <button
              onClick={() => setSidebarOpen(true)}
              title="Expandir painel"
              style={{
                width: 14, flexShrink: 0, background: 'var(--panel)',
                border: 'none', borderLeft: '1px solid var(--border)',
                color: 'var(--sub)', cursor: 'pointer', fontSize: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                writingMode: 'vertical-rl',
              }}
            >◀</button>
          )}
        </div>
      </div>

      {/* ── Character sheets (multi-open) ── */}
      {openSheetIds.map((sheetId, idx) => {
        const sheet = sheetState.sheets.find(s => s.id === sheetId);
        if (!sheet) return null;
        const linkedToken = sheet.linkedTokenId
          ? tokens.find(t => t.id === sheet.linkedTokenId) ?? null
          : null;
        const tgt = targetId ? tokens.find(t => t.id === targetId) ?? null : null;
        return (
          <CharacterSheet
            key={sheetId}
            sheet={sheet}
            onUpdate={(changes) => sheetState.updateSheet(sheetId, changes)}
            onClose={() => closeSheet(sheetId)}
            isReadOnly={!isGM && sheet.owner !== rolePlayerName}
            isGM={isGM}
            addLog={addLog}
            playSfx={playSfx}
            targetToken={tgt}
            combatActive={combatActive}
            linkedToken={linkedToken}
            onTokenUpdate={(updates) => { if (linkedToken) updateToken(linkedToken.id, updates); }}
            offsetIndex={idx}
          />
        );
      })}

      {/* ── Party stats overlay (P key) ── */}
      {showPartyOverlay && (
        <PartyStatsOverlay
          partyOrder={party.order}
          tokens={tokens}
          selectedId={selectedId}
          onSelectToken={onSelectToken}
          onClose={() => setShowPartyOverlay(false)}
        />
      )}

      {/* ── Hidden inputs ── */}
      <input ref={importFileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleImportChange} />

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onMouseDown={() => setCtxMenu(null)} />
          <div className="ctx-menu" style={{ left: ctxMenu.x + 2, top: ctxMenu.y + 2 }} onMouseDown={e => e.stopPropagation()}>
            {ctxMenu.type === 'marker' ? (
              <>
                <button className="ctx-btn" onClick={() => {
                  const m = markers.find(mk => mk.id === ctxMenu.markerId);
                  const text = window.prompt('Texto do marcador:', m?.text ?? '');
                  if (text !== null) setMarkers(prev => prev.map(mk => mk.id === ctxMenu.markerId ? { ...mk, text } : mk));
                  setCtxMenu(null);
                }}>Editar texto</button>
                <div className="ctx-sep" />
                <button className="ctx-btn danger" onClick={() => {
                  setMarkers(prev => prev.filter(mk => mk.id !== ctxMenu.markerId));
                  setCtxMenu(null);
                }}>Remover</button>
              </>
            ) : ctxMenu.type === 'door' ? (
              <>
                {ctxMenu.wall.state === 'closed' && <button className="ctx-btn" onClick={() => { setWalls(p => p.map(w => w.id === ctxMenu.wallId ? { ...w, state: 'open' } : w)); addLog('🚪 Porta aberta.', 'system'); setCtxMenu(null); }}>🚪 Abrir</button>}
                {ctxMenu.wall.state === 'open'   && <button className="ctx-btn" onClick={() => { setWalls(p => p.map(w => w.id === ctxMenu.wallId ? { ...w, state: 'closed' } : w)); addLog('🚪 Porta fechada.', 'system'); setCtxMenu(null); }}>🚪 Fechar</button>}
                {isGM && ctxMenu.wall.state !== 'locked' && <button className="ctx-btn" onClick={() => { setWalls(p => p.map(w => w.id === ctxMenu.wallId ? { ...w, state: 'locked' } : w)); addLog('🔒 Porta trancada.', 'system'); setCtxMenu(null); }}>🔒 Trancar</button>}
                {isGM && ctxMenu.wall.state === 'locked'  && <button className="ctx-btn" onClick={() => { setWalls(p => p.map(w => w.id === ctxMenu.wallId ? { ...w, state: 'closed' } : w)); addLog('🔓 Porta destrancada.', 'system'); setCtxMenu(null); }}>🔓 Destrancar</button>}
                {isGM && <><div className="ctx-sep" /><button className="ctx-btn" onClick={() => { handleWallConvert(ctxMenu.wall); setCtxMenu(null); }}>🧱 Converter em Parede</button></>}
                {isGM && <button className="ctx-btn danger" onClick={() => { setWalls(p => p.filter(w => w.id !== ctxMenu.wallId)); addLog('🗑 Porta removida.', 'system'); setCtxMenu(null); }}>🗑 Deletar</button>}
              </>
            ) : ctxMenu.type === 'wall' ? (
              <>
                {isGM && <button className="ctx-btn" onClick={() => { handleWallConvert(ctxMenu.wall); setCtxMenu(null); }}>🚪 Converter em Porta</button>}
                {isGM && <button className="ctx-btn danger" onClick={() => { setWalls(p => p.filter(w => w.id !== ctxMenu.wallId)); addLog('🗑 Parede removida.', 'system'); setCtxMenu(null); }}>🗑 Deletar Parede</button>}
              </>
            ) : (
              <>
                <button className="ctx-btn" onClick={() => handleDamage(ctxMenu.tokenId)}>Dano</button>
                <button className="ctx-btn" onClick={() => handleHeal(ctxMenu.tokenId)}>Curar</button>
                <div className="ctx-sep" />
                {isGM && (() => {
                  const tok = tokensRef.current.find(t => t.id === ctxMenu.tokenId);
                  const next = !tok?.canPhaseWalls;
                  return (
                    <button className="ctx-btn" onClick={() => {
                      updateToken(ctxMenu.tokenId, { canPhaseWalls: next });
                      addLog(`👻 ${tok?.name} ${next ? 'pode' : 'não pode mais'} atravessar paredes.`, 'system');
                      setCtxMenu(null);
                    }}>
                      {tok?.canPhaseWalls ? '👻 Desativar Travessia' : '👻 Ativar Travessia'}
                    </button>
                  );
                })()}
                <div className="ctx-sep" />
                <button className="ctx-btn" onClick={() => { setCtxMenu(null); tokenState.duplicateToken(ctxMenu.tokenId); }}>Duplicar</button>
                <button className="ctx-btn danger" onClick={() => {
                  const token = tokensRef.current.find(t => t.id === ctxMenu.tokenId);
                  setCtxMenu(null); deleteToken(ctxMenu.tokenId);
                  if (token) addLog(`${token.name} removido.`, 'system');
                }}>Deletar</button>
              </>
            )}
          </div>
        </>
      )}

      {/* ── AoE context menu ── */}
      {aoeCtxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onMouseDown={() => setAoeCtxMenu(null)} />
          <div className="ctx-menu" style={{ left: aoeCtxMenu.x + 2, top: aoeCtxMenu.y + 2, zIndex: 1100 }}
            onMouseDown={e => e.stopPropagation()}>
            {aoeCtxMenu.items.map((item, i) => (
              item === 'sep'
                ? <div key={i} className="ctx-sep" />
                : <button key={i} className={`ctx-btn${item.danger ? ' danger' : ''}`}
                    onClick={() => { item.action(); setAoeCtxMenu(null); }}>
                    {item.label}
                  </button>
            ))}
          </div>
        </>
      )}

      {/* ── Session toast (top, below header) ── */}
      {toast && (
        <div key={toast} style={{
          position: 'fixed', top: 52, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--panel)', border: '1px solid var(--gold)',
          color: 'var(--gold)', padding: '8px 22px', borderRadius: 6,
          fontSize: 12, fontWeight: 600, letterSpacing: '0.04em',
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
          animation: 'toastIn 0.2s ease forwards',
        }}>
          {toast}
        </div>
      )}

      {/* ── Feedback toast (bottom, for shortcuts) ── */}
      {feedbackToast && (
        <div key={feedbackToast + Date.now()} style={{
          position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,16,0.92)', border: '1px solid var(--border)',
          color: 'var(--text)', padding: '5px 16px', borderRadius: 20,
          fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
          zIndex: 9998, pointerEvents: 'none',
          boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          animation: 'feedbackIn 0.15s ease forwards',
        }}>
          {feedbackToast}
        </div>
      )}

      {/* ── Shortcut overlay ── */}
      {showShortcuts && <ShortcutOverlay onClose={() => setShowShortcuts(false)} />}

      {/* ── GM panel modal ── */}
      {isGM && showGMPanel && (
        <GMPanel
          onClose={() => { setShowGMPanel(false); setTopModal(null); }}
          zIndex={topModal === 'gm' ? 100000 : 99998}
          onFocus={() => setTopModal('gm')}
        />
      )}

      {/* ── Macro bar (fixed overlay) ── */}
      <MacroBar
        macros={macros}
        onAdd={handleAddMacro}
        onUpdate={handleUpdateMacro}
        onDelete={handleDeleteMacro}
        addLog={addLog}
        addChatMessage={addChatMessage}
        selectedToken={tokens.find(t => t.id === selectedId) ?? null}
      />

      {/* ── Tile panel (floating inside map area) ── */}
      {showTilePanel && isGM && (
        <div style={{ position: 'fixed', top: 80, left: sidebarOpen ? 'calc(100vw - 300px - 260px)' : 'calc(100vw - 260px)', zIndex: 170 }}>
          <TilePanel
            onClose={() => { setShowTilePanel(false); setActiveTileTemplate(null); }}
            onSelectTemplate={tpl => setActiveTileTemplate(prev => prev?.id === tpl.id ? null : tpl)}
            selectedTemplate={activeTileTemplate}
            customTiles={customTiles}
            onAddCustomTile={ct => setCustomTiles(prev => [...prev, ct])}
          />
        </div>
      )}
    </>
  );
}
