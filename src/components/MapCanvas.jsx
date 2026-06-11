import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { GRID, LABEL_W, LABEL_H, MOVEMENT } from '../utils/constants';
import { CellPaintLayer, WeatherOverlay } from './MapEffects';
import { AoeMapLayer } from './AoeSystem';
import { DrawingLayer, WaypointLayer } from './DrawingLayer';
import { PingLayer } from './PingSystem';
import { TileLayer } from './TileLayer';
import WallTool from './WallTool';
import LightingEngine from './LightingEngine';
import { distPointToSegment } from '../utils/raycasting';
import { findBlockingWall } from '../utils/collision';
import { useRole } from '../hooks/useRole';
import { calcEncumbrance } from '../utils/encumbrance';

const { cellSize: CELL, cols: _DCOLS, rows: _DROWS } = GRID;

const GRID_BG = `
  linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)
`;
const DOT_BG = `radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)`;

function getAuraStyle(aura) {
  if (!aura || !aura.trim()) return null;
  const a = aura.toLowerCase();
  let color, isHue = false;
  if (a.includes('caóti') || a.includes('caoti')) {
    isHue = true; color = 'hsla(40,100%,60%,0.42)';
  } else if (a.includes('divin') || a.includes('sagrad') || a.includes('celest')) {
    color = 'rgba(255,225,80,0.4)';
  } else if (a.includes('sombri') || a.includes('trevas') || a.includes('escuridão') || a.includes('escuridao')) {
    color = 'rgba(120,40,180,0.42)';
  } else if (a.includes('maligna') || a.includes('sangue')) {
    color = 'rgba(200,30,30,0.42)';
  } else if (a.includes('proteç') || a.includes('protec') || a.includes('escudo') || a.includes('cura')) {
    color = 'rgba(40,185,155,0.42)';
  } else if (a.includes('veneno') || a.includes('toxina')) {
    color = 'rgba(80,205,60,0.42)';
  } else if (a.includes('fogo') || a.includes('chamas')) {
    color = 'rgba(255,90,30,0.42)';
  } else if (a.includes('gelo') || a.includes('frio') || a.includes('neve')) {
    color = 'rgba(120,200,255,0.42)';
  } else if (a.includes('elétri') || a.includes('eletri') || a.includes('relâmp') || a.includes('relamp')) {
    color = 'rgba(190,190,255,0.48)';
  } else {
    color = 'rgba(201,169,110,0.38)';
  }
  return { color, isHue };
}

function cellDist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const d = Math.sqrt(dx * dx + dy * dy) * 1.5;
  return d % 1 === 0 ? `${d.toFixed(0)}` : d.toFixed(1);
}

export default function MapCanvas({
  containerRef,
  camera,
  tokenState,
  tool,
  toolRef,
  showGrid,
  bgImage,
  setCtxMenu,
  combatTurnTokenId,
  addLog,
  // Fog of war
  fogEnabled,
  revealedCells,
  setRevealedCells,
  // Measurement
  measurements,
  setMeasurements,
  measuring,
  setMeasuring,
  // Targeting
  targetingMode,
  targetId,
  onTargetToken,
  // Party
  partyOrderRef,
  onGroupMove,
  // Character sheet
  onOpenSheet,
  sheets,
  tokenGroups,
  // Map effects
  markers,
  setMarkers,
  paintedCells,
  setPaintedCells,
  setPaintHistory,
  paintColor,
  floatingNums,
  weather,
  // Per-scene grid size (optional, defaults to GRID constant)
  gridCols,
  gridRows,
  // AoE
  aoes,
  onUpdateAoe,
  onRemoveAoe,
  onClearAllAoes,
  // Aiming mode (character-centric AoE)
  aimingMode,
  onAoeConfirm,
  onAoeCancel,
  // Walls & lighting
  walls,
  selectedWallId,
  onSelectWall,
  onAddWall,
  showWalls,
  lightingEnabled,
  playerView,
  blockedWallId,
  onDragBlocked,
  // Door interaction
  wallDrawMode,
  onDoorInteract,
  onWallConvert,
  onWallContextMenu,
  // Tiles
  tiles,
  selectedTileId,
  onSelectTile,
  onUpdateTile,
  onRemoveTile,
  activeTileTemplate,
  onAddTile,
  // Hex grid
  hexGrid,
  // Drawing
  drawings,
  drawingTool,
  drawingConfig,
  drawingAuthor,
  canDraw,
  onAddDrawing,
  onRemoveByIds,
  // Ping / pointer
  pings,
  onMapPing,
  pointerPos,
  pointerColor,
  onPointerMove,
  onPointerClear,
  // Waypoints
  waypointMode,
  waypointToken,
  waypoints,
  onWaypointAdd,
  onWaypointConfirm,
  onWaypointCancel,
  onWaypointStart,
  // Z key (for ping)
  zKeyRef,
}) {
  const COLS = gridCols ?? _DCOLS;
  const ROWS = gridRows ?? _DROWS;
  const { isGM, canSeeToken, canControlToken } = useRole();
  const COL_LABELS = useMemo(() =>
    Array.from({ length: COLS }, (_, i) =>
      i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26)
    ),
  [COLS]);

  const {
    zoom, pan, spaceDown, mapDragging,
    panRef, isPanningRef, lastMouseRef, spaceRef,
    setPan, setMapDragging,
    applyZoom, screenToGrid,
  } = camera;

  const {
    tokens, selectedId, dragPos, shakingId,
    setSelectedId, setDragPos,
    tokensRef, isDraggingTokenRef, dragTokenIdRef,
    addToken, startDrag, commitDrag, cancelDrag, shakeToken,
  } = tokenState;

  // ── Local state ───────────────────────────────────────────────────────────
  const [measureCursor,  setMeasureCursor]  = useState(null); // { col, row }
  const [fogDragRect,    setFogDragRect]    = useState(null); // { col1,row1,col2,row2 }
  const [hoveredTokenId, setHoveredTokenId] = useState(null);
  const [markerDragPos,  setMarkerDragPos]  = useState(null); // { col, row }
  const [nearDoor,       setNearDoor]       = useState(null); // door segment or null

  // ── Refs ──────────────────────────────────────────────────────────────────
  const [aimingCursor, setAimingCursor] = useState(null);
  const aimingModeRef = useRef(aimingMode);
  const [wallStart, setWallStart] = useState(null); // { ix, iy }
  const [wallHover, setWallHover] = useState(null); // { ix, iy }

  const fogCanvasRef           = useRef(null);
  const measuringRef           = useRef(measuring);
  const fogEnabledRef          = useRef(fogEnabled);
  const fogDragRef             = useRef(null);
  const hoverTimerRef          = useRef(null);
  const selectedIdRef          = useRef(selectedId);
  const isPaintingRef          = useRef(false);
  const isErasingRef           = useRef(false);
  const isDraggingMarkerRef    = useRef(false);
  const dragMarkerIdRef        = useRef(null);
  const paintColorRef          = useRef(paintColor);
  const paintedCellsRef        = useRef(paintedCells);
  const paintStrokeSnapshotRef = useRef(null);

  useEffect(() => { aimingModeRef.current = aimingMode; }, [aimingMode]);
  useEffect(() => { if (!aimingMode) setAimingCursor(null); }, [aimingMode]);

  // Refs for stale-closure safety inside the global mouse effect
  const wallsRef  = useRef(walls);
  const isGMRef   = useRef(isGM);
  useEffect(() => { wallsRef.current = walls; }, [walls]);
  useEffect(() => { isGMRef.current  = isGM;  }, [isGM]);

  // Mirror props to refs (safe to read inside stale closures)
  useEffect(() => { measuringRef.current     = measuring;    }, [measuring]);
  useEffect(() => { fogEnabledRef.current    = fogEnabled;   }, [fogEnabled]);
  useEffect(() => { selectedIdRef.current    = selectedId;   }, [selectedId]);
  useEffect(() => { paintColorRef.current    = paintColor;   }, [paintColor]);
  useEffect(() => { paintedCellsRef.current  = paintedCells; }, [paintedCells]);

  // Clear wall drawing state when switching away from wall tool
  useEffect(() => {
    if (tool !== 'wall') { setWallStart(null); setWallHover(null); }
  }, [tool]);

  // Convert screen coordinates to nearest grid intersection
  const screenToIntersection = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { ix: 0, iy: 0 };
    const lx = (clientX - rect.left - panRef.current.x) / camera.zoom - LABEL_W;
    const ly = (clientY - rect.top  - panRef.current.y) / camera.zoom - LABEL_H;
    return {
      ix: Math.max(0, Math.min(COLS, Math.round(lx / CELL))),
      iy: Math.max(0, Math.min(ROWS, Math.round(ly / CELL))),
    };
  }, [containerRef, panRef, camera.zoom, COLS, ROWS]);

  // Clear measure cursor when active measurement is cancelled
  useEffect(() => {
    if (!measuring) setMeasureCursor(null);
  }, [measuring]);

  // ── Fog canvas redraw ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fogCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, COLS * CELL, ROWS * CELL);
    if (fogEnabled) {
      ctx.fillStyle = 'rgba(10,10,16,0.92)';
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
      for (const key of revealedCells) {
        const [c, r] = key.split(',').map(Number);
        ctx.clearRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fogEnabled, revealedCells, COLS, ROWS]);

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      applyZoom(e.deltaY < 0 ? 0.1 : -0.1, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef, applyZoom]);

  // ── Global mouse move/up ──────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      // Wall tool: snap to nearest intersection
      if (toolRef.current === 'wall') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const lx = (e.clientX - rect.left - panRef.current.x) / camera.zoom - LABEL_W;
          const ly = (e.clientY - rect.top  - panRef.current.y) / camera.zoom - LABEL_H;
          setWallHover({
            ix: Math.max(0, Math.min(COLS, Math.round(lx / CELL))),
            iy: Math.max(0, Math.min(ROWS, Math.round(ly / CELL))),
          });
        }
      }

      // Door hover cursor detection (non-wall-tool mode)
      if (toolRef.current !== 'wall' && toolRef.current !== 'paint') {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const gx = (e.clientX - rect.left - panRef.current.x) / camera.zoom - LABEL_W;
          const gy = (e.clientY - rect.top  - panRef.current.y) / camera.zoom - LABEL_H;
          const door = (wallsRef.current ?? []).find(
            w => w.type === 'door' && distPointToSegment(gx, gy, w.x1 * CELL, w.y1 * CELL, w.x2 * CELL, w.y2 * CELL) < 14
          );
          setNearDoor(door ?? null);
        }
      } else {
        setNearDoor(null);
      }

      // Aiming mode: track cursor grid position
      if (aimingModeRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        setAimingCursor({
          col: Math.max(0, Math.min(COLS - 1, col)),
          row: Math.max(0, Math.min(ROWS - 1, row)),
        });
      }

      // Token drag
      if (isDraggingTokenRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        setDragPos({
          col: Math.max(0, Math.min(COLS - 1, col)),
          row: Math.max(0, Math.min(ROWS - 1, row)),
        });
        return;
      }

      // Marker drag
      if (isDraggingMarkerRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        setMarkerDragPos({
          col: Math.max(0, Math.min(COLS - 1, col)),
          row: Math.max(0, Math.min(ROWS - 1, row)),
        });
        return;
      }

      // Paint drag
      if (isPaintingRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        const c = Math.max(0, Math.min(COLS - 1, col));
        const r = Math.max(0, Math.min(ROWS - 1, row));
        const key = `${c},${r}`;
        if (isErasingRef.current) {
          setPaintedCells?.(prev => { const n = { ...prev }; delete n[key]; return n; });
        } else {
          setPaintedCells?.(prev => ({ ...prev, [key]: paintColorRef.current }));
        }
        return;
      }

      // Fog rectangle drag
      if (fogDragRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        const col2 = Math.max(0, Math.min(COLS - 1, col));
        const row2 = Math.max(0, Math.min(ROWS - 1, row));
        fogDragRef.current.col2 = col2;
        fogDragRef.current.row2 = row2;
        setFogDragRect({ ...fogDragRef.current });
        return;
      }

      // Measurement cursor tracking
      if (measuringRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        setMeasureCursor({
          col: Math.max(0, Math.min(COLS - 1, col)),
          row: Math.max(0, Math.min(ROWS - 1, row)),
        });
      }

      // GM laser pointer: track cursor while Ctrl held
      if (isGM && e.ctrlKey && onPointerMove && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panRef.current.x) / zoom;
        const my = (e.clientY - rect.top  - panRef.current.y) / zoom;
        onPointerMove({ x: mx, y: my });
      }

      if (!isPanningRef.current) return;
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      const np = { x: panRef.current.x + dx, y: panRef.current.y + dy };
      panRef.current = np;
      setPan({ ...np });
    };

    const onUp = (e) => {
      // Marker drag release
      if (isDraggingMarkerRef.current) {
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        const markerId = dragMarkerIdRef.current;
        const c = Math.max(0, Math.min(COLS - 1, col));
        const r = Math.max(0, Math.min(ROWS - 1, row));
        setMarkers?.(prev => prev.map(m => m.id === markerId ? { ...m, x: c, y: r } : m));
        isDraggingMarkerRef.current = false;
        dragMarkerIdRef.current = null;
        setMarkerDragPos(null);
        return;
      }

      // Paint stroke end — commit to history
      if (isPaintingRef.current) {
        if (paintStrokeSnapshotRef.current !== null) {
          setPaintHistory?.(prev => [...prev.slice(-19), paintStrokeSnapshotRef.current]);
          paintStrokeSnapshotRef.current = null;
        }
        isPaintingRef.current = false;
        isErasingRef.current = false;
        return;
      }

      // Token drag release
      if (isDraggingTokenRef.current) {
        const draggedId    = dragTokenIdRef.current;
        const draggedToken = tokensRef.current.find(t => t.id === draggedId);
        const { col, row } = screenToGrid(e.clientX, e.clientY);
        const snapCol   = Math.max(0, Math.min(COLS - 1, col));
        const snapRow   = Math.max(0, Math.min(ROWS - 1, row));
        const hasMoved  = draggedToken && (snapCol !== draggedToken.x || snapRow !== draggedToken.y);

        // Wall collision check (Ctrl bypasses for GM, canPhaseWalls bypasses always)
        if (hasMoved && draggedToken && wallsRef.current.length > 0) {
          const bypassWall = (isGMRef.current && e.ctrlKey) || !!draggedToken.canPhaseWalls;
          if (!bypassWall) {
            const blockingWall = findBlockingWall(draggedToken.x, draggedToken.y, snapCol, snapRow, wallsRef.current, draggedToken);
            if (blockingWall) {
              cancelDrag();
              shakeToken(draggedId);
              onDragBlocked?.(blockingWall);
              return;
            }
          } else if (isGMRef.current && e.ctrlKey && !draggedToken.canPhaseWalls) {
            addLog?.(`🎭 ${draggedToken.name} movido pelo Mestre (ignorando paredes).`, 'system');
          }
        }

        const isBlocked = tokensRef.current.some(t => t.id !== draggedId && t.x === snapCol && t.y === snapRow);
        commitDrag(snapCol, snapRow);
        if (hasMoved && !isBlocked && draggedToken) {
          addLog?.(`${draggedToken.name} moveu para ${COL_LABELS[snapCol]}${snapRow + 1}.`, 'system');
        }
        return;
      }

      // Fog rectangle release → reveal all cells in rect
      if (fogDragRef.current) {
        const { col1, row1, col2, row2 } = fogDragRef.current;
        const minCol = Math.min(col1, col2), maxCol = Math.max(col1, col2);
        const minRow = Math.min(row1, row2), maxRow = Math.max(row1, row2);
        setRevealedCells(prev => {
          const next = new Set(prev);
          for (let c = minCol; c <= maxCol; c++)
            for (let r = minRow; r <= maxRow; r++)
              next.add(`${c},${r}`);
          return next;
        });
        fogDragRef.current = null;
        setFogDragRect(null);
        return;
      }

      if (isPanningRef.current) {
        isPanningRef.current = false;
        setMapDragging(false);
      }
    };

    const onCtrlUp = (e) => {
      if (e.key === 'Control') onPointerClear?.();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keyup', onCtrlUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keyup', onCtrlUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    screenToGrid, isDraggingTokenRef, dragTokenIdRef, tokensRef,
    isPanningRef, panRef, lastMouseRef, setPan, setMapDragging,
    setDragPos, commitDrag, cancelDrag, shakeToken, onDragBlocked, addLog,
    setRevealedCells, setMeasureCursor,
    setPaintedCells, setPaintHistory, setMarkers,
    COLS, ROWS, COL_LABELS,
  ]);

  // ── Map area mousedown ────────────────────────────────────────────────────
  const onMapMouseDown = useCallback((e) => {
    setCtxMenu(null);

    // Ping: Ctrl+Click or Z+Click (not while aiming/painting/wall)
    if (e.button === 0 && (e.ctrlKey || zKeyRef?.current) &&
        !aimingModeRef.current && toolRef.current !== 'wall' && toolRef.current !== 'paint') {
      if (containerRef.current && onMapPing) {
        const rect = containerRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left - panRef.current.x) / zoom;
        const my = (e.clientY - rect.top  - panRef.current.y) / zoom;
        onMapPing(mx, my);
      }
      return;
    }

    // Aiming mode: left click confirms, right click / middle cancels
    if (aimingModeRef.current) {
      const { col, row } = screenToGrid(e.clientX, e.clientY);
      const c = Math.max(0, Math.min(COLS - 1, col));
      const r = Math.max(0, Math.min(ROWS - 1, row));
      if (e.button === 0) { onAoeConfirm?.(c, r); return; }
      if (e.button === 2 || e.button === 1) { onAoeCancel?.(); return; }
      return;
    }

    // Wall tool: click on intersections to draw wall/door segments (GM only)
    if (toolRef.current === 'wall' && isGM) {
      if (e.button === 2) {
        // Right-click near existing segment → convert it
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          const gx = (e.clientX - rect.left - panRef.current.x) / zoom - LABEL_W;
          const gy = (e.clientY - rect.top  - panRef.current.y) / zoom - LABEL_H;
          const THRESH = 12;
          const near = (walls ?? []).find(w => distPointToSegment(gx, gy, w.x1 * CELL, w.y1 * CELL, w.x2 * CELL, w.y2 * CELL) < THRESH);
          if (near) { onWallConvert?.(near); return; }
        }
        setWallStart(null); return;
      }
      if (e.button !== 0) return;
      const is = screenToIntersection(e.clientX, e.clientY);
      setWallStart(prev => {
        if (!prev) return is;
        if (prev.ix !== is.ix || prev.iy !== is.iy) {
          const seg = {
            id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            x1: prev.ix, y1: prev.iy, x2: is.ix, y2: is.iy,
          };
          if (wallDrawMode === 'door') {
            seg.type  = 'door';
            seg.state = 'closed';
            seg.secret = false;
          }
          onAddWall?.(seg);
        }
        return is;
      });
      return;
    }

    // Right-click near a wall/door in non-wall-tool mode → context menu
    if (e.button === 2 && !aimingModeRef.current && toolRef.current !== 'wall' && toolRef.current !== 'paint' && onWallContextMenu) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const gx = (e.clientX - rect.left - panRef.current.x) / zoom - LABEL_W;
        const gy = (e.clientY - rect.top  - panRef.current.y) / zoom - LABEL_H;
        const seg = (walls ?? []).find(w => distPointToSegment(gx, gy, w.x1 * CELL, w.y1 * CELL, w.x2 * CELL, w.y2 * CELL) < 14);
        if (seg) { e.preventDefault(); onWallContextMenu(seg, e.clientX, e.clientY); return; }
      }
    }

    // Door interaction: click near a door in non-wall-tool mode
    if (e.button === 0 && !aimingModeRef.current && toolRef.current !== 'wall' && toolRef.current !== 'paint') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const gx = (e.clientX - rect.left - panRef.current.x) / zoom - LABEL_W;
        const gy = (e.clientY - rect.top  - panRef.current.y) / zoom - LABEL_H;
        const THRESH = 14;
        const door = (walls ?? []).find(w => w.type === 'door' && distPointToSegment(gx, gy, w.x1 * CELL, w.y1 * CELL, w.x2 * CELL, w.y2 * CELL) < THRESH);
        if (door) { onDoorInteract?.(door); return; }
      }
    }

    // Tile placement: if a template is active, click places it
    if (e.button === 0 && activeTileTemplate && isGM && !aimingModeRef.current) {
      const { col: rawC, row: rawR } = screenToGrid(e.clientX, e.clientY);
      const c = Math.max(0, Math.min(COLS - 1, rawC));
      const r = Math.max(0, Math.min(ROWS - 1, rawR));
      onAddTile?.({
        id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type:    activeTileTemplate.type ?? 'builtin',
        icon:    activeTileTemplate.icon,
        name:    activeTileTemplate.name ?? '',
        x: c, y: r,
        width:   activeTileTemplate.w ?? 1,
        height:  activeTileTemplate.h ?? 1,
        rotation: activeTileTemplate.rotation ?? 0,
        zIndex: 0, visible: true, lightRadius: 0, lightColor: '#ffd700', locked: false,
      });
      return;
    }

    // Middle click or Space+click → pan
    if (e.button === 1 || (e.button === 0 && spaceRef.current)) {
      e.preventDefault();
      isPanningRef.current = true;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
      setMapDragging(true);
      return;
    }

    // Paint tool handles both left (paint) and right (erase) buttons
    if (toolRef.current === 'paint') {
      const { col: rawC, row: rawR } = screenToGrid(e.clientX, e.clientY);
      const c = Math.max(0, Math.min(COLS - 1, rawC));
      const r = Math.max(0, Math.min(ROWS - 1, rawR));
      isPaintingRef.current = true;
      isErasingRef.current = e.button === 2;
      paintStrokeSnapshotRef.current = paintedCellsRef.current;
      const key = `${c},${r}`;
      if (e.button === 2) {
        setPaintedCells?.(prev => { const n = { ...prev }; delete n[key]; return n; });
      } else {
        setPaintedCells?.(prev => ({ ...prev, [key]: paintColorRef.current }));
      }
      return;
    }

    if (e.button !== 0) return;

    const { col: rawCol, row: rawRow } = screenToGrid(e.clientX, e.clientY);

    // Fog shift+drag → start rectangle reveal
    if (fogEnabledRef.current && e.shiftKey && toolRef.current === 'select') {
      const c = Math.max(0, Math.min(COLS - 1, rawCol));
      const r = Math.max(0, Math.min(ROWS - 1, rawRow));
      fogDragRef.current = { col1: c, row1: r, col2: c, row2: r };
      setFogDragRect({ col1: c, row1: r, col2: c, row2: r });
      return;
    }

    // Group formation move: shift+click on empty cell, fog off, party member selected
    if (e.shiftKey && !fogEnabledRef.current && toolRef.current === 'select') {
      const sid = selectedIdRef.current;
      if (sid && partyOrderRef?.current?.includes(sid)) {
        const col = Math.max(0, Math.min(COLS - 1, rawCol));
        const row = Math.max(0, Math.min(ROWS - 1, rawRow));
        onGroupMove?.(col, row);
        return;
      }
      if (sid && !partyOrderRef?.current?.includes(sid)) {
        const selToken = tokensRef.current.find(tk => tk.id === sid);
        if (selToken) {
          const col = Math.max(0, Math.min(COLS - 1, rawCol));
          const row = Math.max(0, Math.min(ROWS - 1, rawRow));
          onWaypointStart?.(selToken, col, row);
          return;
        }
      }
    }

    // Out-of-bounds → deselect
    if (rawCol < 0 || rawCol >= COLS || rawRow < 0 || rawRow >= ROWS) {
      setSelectedId(null);
      return;
    }
    const col = rawCol, row = rawRow;
    const t = toolRef.current;

    // Measurement tool
    if (t === 'measure') {
      if (!measuringRef.current) {
        setMeasuring({ col, row });
      } else {
        const m = measuringRef.current;
        if (m.col !== col || m.row !== row) {
          setMeasurements(prev => [
            ...prev,
            { id: Date.now(), x1: m.col, y1: m.row, x2: col, y2: row },
          ]);
        }
        setMeasuring(null);
      }
      return;
    }

    // Fog cell toggle (select tool, no shift)
    if (fogEnabledRef.current && t === 'select' && !e.shiftKey) {
      const key = `${col},${row}`;
      setRevealedCells(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      return;
    }

    // Marker tool
    if (t === 'marker') {
      const text = window.prompt('Texto do marcador:');
      if (text !== null) {
        setMarkers?.(prev => [...prev, {
          id: `mk${Date.now()}`, x: col, y: row, text, color: '#c9a96e',
        }]);
      }
      return;
    }

    // Wall selection (select tool, no fog, no shift, walls present)
    if (t === 'select' && !fogEnabledRef.current && !e.shiftKey && walls?.length > 0) {
      const is = screenToIntersection(e.clientX, e.clientY);
      const near = (walls ?? []).find(w =>
        distPointToSegment(is.ix, is.iy, w.x1, w.y1, w.x2, w.y2) < 0.45
      );
      if (near) { onSelectWall?.(near.id); return; }
    }

    // Add token
    if (t === 'add-player' || t === 'add-npc') {
      const occupied = tokensRef.current.some(tk => tk.x === col && tk.y === row);
      if (!occupied) {
        addToken(t === 'add-player' ? 'player' : 'npc', col, row);
        addLog?.(`${t === 'add-player' ? 'Jogador' : 'NPC'} adicionado em ${COL_LABELS[col]}${row + 1}.`, 'system');
      }
    } else {
      setSelectedId(null);
    }
  }, [
    screenToGrid, spaceRef, isPanningRef, lastMouseRef, setMapDragging,
    setSelectedId, tokensRef, addToken, setCtxMenu, toolRef, addLog,
    setRevealedCells, setMeasuring, setMeasurements,
    partyOrderRef, onGroupMove, setMarkers, setPaintedCells,
    onAoeConfirm, onAoeCancel,
    screenToIntersection, onAddWall, onSelectWall, walls, isGM,
    wallDrawMode, onDoorInteract, onWallConvert, activeTileTemplate, onAddTile,
    COLS, ROWS, COL_LABELS,
  ]);

  // ── Token mousedown ───────────────────────────────────────────────────────
  const onTokenMouseDown = useCallback((e, token) => {
    if (spaceRef.current || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // In targeting mode, clicking a non-selected token targets it
    if (targetingMode && token.id !== selectedId) {
      onTargetToken?.(token.id);
      return;
    }
    // Players can only select their own tokens
    if (!isGM && !canControlToken(token)) return;
    setSelectedId(token.id);
    if (canControlToken(token)) startDrag(token.id, token.x, token.y);
  }, [spaceRef, setSelectedId, startDrag, targetingMode, selectedId, onTargetToken, canControlToken, isGM]);

  // ── Token right-click ─────────────────────────────────────────────────────
  const onTokenContextMenu = useCallback((e, tokenId) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(tokenId);
    setCtxMenu({ type: 'token', tokenId, x: e.clientX, y: e.clientY });
  }, [setSelectedId, setCtxMenu]);

  // ── Cursor ────────────────────────────────────────────────────────────────
  const doorCursor = nearDoor
    ? (nearDoor.state === 'locked' && !isGM ? 'not-allowed' : 'pointer')
    : null;
  const cursor = aimingMode ? 'crosshair'
    : (mapDragging || dragPos !== null || markerDragPos !== null) ? 'grabbing'
    : spaceDown ? 'grab'
    : fogDragRect ? 'cell'
    : tool === 'paint' ? 'crosshair'
    : tool === 'marker' ? 'copy'
    : (tool === 'add-player' || tool === 'add-npc' || tool === 'measure') ? 'crosshair'
    : activeTileTemplate ? 'copy'
    : doorCursor ?? ((fogEnabled && tool === 'select') ? 'cell' : 'default');

  const selectedToken = tokens.find(t => t.id === selectedId);
  const hoveredToken  = hoveredTokenId ? tokens.find(t => t.id === hoveredTokenId) ?? null : null;
  const rangeRadius   = selectedToken
    ? (selectedToken.movement / MOVEMENT.metersPerCell) * CELL
    : 0;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor, userSelect: 'none' }}
      onMouseDown={onMapMouseDown}
      onDoubleClick={(e) => { if (tool === 'wall') { setWallStart(null); setWallHover(null); } }}
      onContextMenu={(e) => { e.preventDefault(); if (aimingModeRef.current) onAoeCancel?.(); }}
      onAuxClick={(e) => e.preventDefault()}
    >
      {/* ── Transform layer ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        transformOrigin: '0 0',
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}>
        {/* Column labels */}
        <div style={{ display: 'flex', paddingLeft: LABEL_W }}>
          {COL_LABELS.map(label => (
            <div key={label} style={{
              width: CELL, height: LABEL_H, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--sub)', fontSize: 9, letterSpacing: '0.05em',
            }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex' }}>
          {/* Row labels */}
          <div style={{ display: 'flex', flexDirection: 'column', width: LABEL_W, flexShrink: 0 }}>
            {Array.from({ length: ROWS }, (_, i) => (
              <div key={i} style={{
                height: CELL, flexShrink: 0,
                display: 'flex', alignItems: 'center',
                justifyContent: 'flex-end', paddingRight: 5,
                color: 'var(--sub)', fontSize: 9, letterSpacing: '0.04em',
              }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* ── Grid area ── */}
          <div style={{
            position: 'relative',
            width: COLS * CELL, height: ROWS * CELL, flexShrink: 0,
            backgroundColor: '#0c0c14',
            backgroundImage: bgImage ? 'none' : DOT_BG,
            backgroundSize: bgImage ? 'auto' : '20px 20px',
          }}>
            {/* Background map image */}
            {bgImage && (
              <img src={bgImage} alt="" draggable={false} style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', display: 'block', zIndex: 0,
              }} />
            )}

            {/* Grid lines */}
            {showGrid && !hexGrid && (
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: GRID_BG,
                backgroundSize: `${CELL}px ${CELL}px`,
                zIndex: 1, pointerEvents: 'none',
              }} />
            )}

            {/* Hex grid overlay */}
            {showGrid && hexGrid && (() => {
              const hexH = CELL * Math.sqrt(3) / 2;
              const hexes = [];
              for (let col = 0; col < COLS; col++) {
                for (let row = 0; row < ROWS; row++) {
                  const cx = col * CELL * 0.75 + CELL / 2;
                  const cy = row * hexH + (col % 2 === 1 ? hexH / 2 : 0) + hexH / 2;
                  const size = CELL / 2;
                  const pts = Array.from({ length: 6 }, (_, i) => {
                    const a = (Math.PI / 3) * i - Math.PI / 6;
                    return `${cx + size * Math.cos(a)},${cy + size * Math.sin(a)}`;
                  }).join(' ');
                  hexes.push(<polygon key={`h${col}-${row}`} points={pts} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={0.8} />);
                }
              }
              return (
                <svg width={COLS * CELL} height={ROWS * CELL}
                  style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
                  {hexes}
                </svg>
              );
            })()}

            {/* Dynamic lighting canvas (z 24 — below fog) */}
            <LightingEngine
              tokens={tokens}
              walls={walls ?? []}
              COLS={COLS} ROWS={ROWS} CELL={CELL}
              lightingEnabled={lightingEnabled}
              playerView={playerView}
            />

            {/* Cell paint layer (z 3) */}
            <CellPaintLayer paintedCells={paintedCells} />

            {/* ── Tile layer (z 7-9, below tokens) ── */}
            <TileLayer
              tiles={tiles}
              isGM={isGM}
              playerView={playerView}
              selectedTileId={selectedTileId}
              onSelect={onSelectTile}
              onUpdate={onUpdateTile}
              onRemove={onRemoveTile}
            />

            {/* Movement range indicator */}
            {selectedToken && rangeRadius > 0 && (
              <svg
                width={COLS * CELL} height={ROWS * CELL}
                style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'visible' }}
              >
                <circle
                  cx={(selectedToken.x + 0.5) * CELL}
                  cy={(selectedToken.y + 0.5) * CELL}
                  r={rangeRadius}
                  fill="rgba(201,169,110,0.07)"
                  stroke="rgba(201,169,110,0.38)"
                  strokeWidth="1"
                  strokeDasharray="5 3"
                />
              </svg>
            )}

            {/* ── Tokens (z 10-20) ── */}
            {tokens.map(token => {
              // Visibility: players skip tokens they can't see; GM sees all (hidden = dimmed)
              if (!isGM && !canSeeToken(token)) return null;
              const isHiddenFromPlayers = isGM && token.hidden;
              const isBeingDragged = isDraggingTokenRef.current && dragTokenIdRef.current === token.id;
              const displayCol = (isBeingDragged && dragPos) ? dragPos.col : token.x;
              const displayRow = (isBeingDragged && dragPos) ? dragPos.row : token.y;
              const isSelected    = selectedId === token.id;
              const isShaking     = shakingId === token.id;
              const isCombatTurn  = combatTurnTokenId === token.id;
              const isDead        = token.hp <= 0;
              const isTarget      = targetId === token.id;
              const isTargetable  = targetingMode && !isSelected;
              const hpPct         = token.maxHp > 0 ? token.hp / token.maxHp : 0;
              const hpColor       = hpPct > 0.5 ? '#4a9a5a' : hpPct > 0.2 ? '#c47830' : '#c43030';

              const enc           = calcEncumbrance(token);
              const encLevel      = enc.level;
              const tokenGroup    = tokenGroups?.find(g => g.tokenIds.includes(token.id));

              return (
                <div
                  key={token.id}
                  style={{
                    position: 'absolute',
                    left: displayCol * CELL,
                    top: displayRow * CELL,
                    width: CELL,
                    zIndex: isBeingDragged ? 20 : isSelected ? 12 : 10,
                    opacity: isHiddenFromPlayers ? 0.45 : isDead ? 0.4 : isBeingDragged ? 0.78 : 1,
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    pointerEvents: dragPos !== null ? 'none' : 'auto',
                    cursor: (isGM || canControlToken(token)) ? 'pointer' : 'default',
                    transition: isBeingDragged ? 'none'
                      : encLevel === 'overloaded' ? 'left 0.6s ease, top 0.6s ease'
                      : encLevel === 'heavy'      ? 'left 0.4s ease, top 0.4s ease'
                      : encLevel === 'moderate'   ? 'left 0.25s ease, top 0.25s ease'
                      : 'left 0.15s ease, top 0.15s ease',
                    animation: isShaking ? 'tokenShake 0.38s ease' : token.canPhaseWalls ? 'phaseShimmer 2s ease-in-out infinite' : 'none',
                  }}
                  onMouseDown={(e) => {
                    clearTimeout(hoverTimerRef.current);
                    setHoveredTokenId(null);
                    onTokenMouseDown(e, token);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (!targetingMode && (isGM || canControlToken(token))) onOpenSheet?.(token.id);
                  }}
                  onMouseEnter={() => {
                    clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = setTimeout(() => setHoveredTokenId(token.id), 300);
                  }}
                  onMouseLeave={() => {
                    clearTimeout(hoverTimerRef.current);
                    setHoveredTokenId(null);
                  }}
                  onContextMenu={(e) => onTokenContextMenu(e, token.id)}
                >
                  {/* Aura wrapper — provides aura ring behind circle */}
                  {(() => {
                    const aura = getAuraStyle(token.aura);
                    return (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {aura && (
                          <div style={{
                            position: 'absolute',
                            inset: -9,
                            borderRadius: '50%',
                            boxShadow: `0 0 0 7px ${aura.color}, 0 0 22px ${aura.color}`,
                            animation: aura.isHue
                              ? 'auraHueShift 4s linear infinite'
                              : 'auraPulse 3s ease-in-out infinite',
                            pointerEvents: 'none',
                          }} />
                        )}
                        {encLevel !== 'light' && (
                          <div style={{
                            position: 'absolute', top: -14, left: '50%',
                            transform: 'translateX(-50%)',
                            fontSize: 8, lineHeight: 1,
                            pointerEvents: 'none', userSelect: 'none', zIndex: 5,
                          }}>
                            {encLevel === 'overloaded' ? '⛓❗' : encLevel === 'heavy' ? '⛓' : '⚠'}
                          </div>
                        )}
                        {tokenGroup && (
                          <div style={{
                            position: 'absolute', bottom: -3, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 14, height: 3, borderRadius: 2,
                            background: tokenGroup.color,
                            pointerEvents: 'none', zIndex: 5,
                          }} />
                        )}
                        <div style={{
                          position: 'relative',
                          width: CELL, height: CELL, borderRadius: '50%',
                          border: isHiddenFromPlayers
                            ? `3px dashed ${token.color || '#888'}`
                            : `3px solid ${token.color || '#888'}`,
                          background: token.image
                            ? `url(${token.image}) center/cover`
                            : 'radial-gradient(circle at 35% 35%, #252538, #111120)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                          boxShadow: token.canPhaseWalls
                            ? '0 0 0 2px rgba(168,85,247,0.8), 0 0 18px rgba(168,85,247,0.5), 0 2px 8px rgba(0,0,0,0.55)'
                            : isCombatTurn
                            ? undefined
                            : isSelected
                            ? '0 0 0 2px var(--gold), 0 0 16px rgba(201,169,110,0.5), 0 2px 8px rgba(0,0,0,0.7)'
                            : encLevel === 'overloaded' ? '0 0 12px rgba(196,48,48,0.75), 0 2px 8px rgba(0,0,0,0.55)'
                            : encLevel === 'heavy'      ? '0 0 10px rgba(224,112,32,0.65), 0 2px 8px rgba(0,0,0,0.55)'
                            : encLevel === 'moderate'   ? '0 0 8px rgba(201,169,110,0.5), 0 2px 8px rgba(0,0,0,0.55)'
                            : '0 2px 8px rgba(0,0,0,0.55)',
                          animation: isCombatTurn ? 'combatPulse 1.5s ease-in-out infinite'
                            : encLevel === 'overloaded' ? 'overloadPulse 2s ease-in-out infinite'
                            : 'none',
                        }}>
                          {!token.image && (
                            <span style={{
                              color: '#fff', fontSize: 13, fontWeight: 700,
                              letterSpacing: '0.02em', lineHeight: 1,
                              pointerEvents: 'none', userSelect: 'none',
                            }}>
                              {token.name.substring(0, 2).toUpperCase()}
                            </span>
                          )}
                          {isDead && (
                            <div style={{
                              position: 'absolute', inset: 0,
                              background: 'rgba(0,0,0,0.65)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 18, pointerEvents: 'none',
                            }}>
                              💀
                            </div>
                          )}
                          {/* Facing indicator (shown when angular vision is set) */}
                          {(token.visionAngle ?? 360) < 360 && (
                            <div style={{
                              position: 'absolute', top: '50%', left: '50%',
                              width: 0, height: 0,
                              borderLeft: '4px solid transparent',
                              borderRight: '4px solid transparent',
                              borderBottom: `8px solid rgba(255,255,255,0.72)`,
                              transform: `translate(-50%, -100%) rotate(${(token.facingAngle ?? 0) + 180}deg)`,
                              transformOrigin: '50% 100%',
                              pointerEvents: 'none',
                            }} />
                          )}

                          {/* Targeting ring */}
                          {(isTargetable || isTarget) && (
                            <div style={{
                              position: 'absolute', inset: -4, borderRadius: '50%',
                              border: `2px solid ${
                                isTarget ? 'var(--gold)' :
                                token.type === 'player' ? '#4a9aba' : '#e05555'
                              }`,
                              animation: isTargetable ? 'targetPulse 1s ease-in-out infinite' : 'none',
                              opacity: isTarget ? 1 : 0.85,
                              pointerEvents: 'none',
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div style={{
                    width: 30, height: 3, marginTop: 2, flexShrink: 0,
                    background: 'rgba(0,0,0,0.6)', borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${hpPct * 100}%`, height: '100%',
                      background: hpColor, borderRadius: 2,
                      transition: 'width 0.25s, background 0.25s',
                    }} />
                  </div>

                  {token.maxMp > 0 && (
                    <div style={{
                      width: 30, height: 3, marginTop: 1, flexShrink: 0,
                      background: 'rgba(0,0,0,0.6)', borderRadius: 2, overflow: 'hidden',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: `${token.maxMp > 0 ? (token.mp / token.maxMp) * 100 : 0}%`, height: '100%',
                        background: '#3a6aaa', borderRadius: 2, transition: 'width 0.25s',
                      }} />
                    </div>
                  )}

                  {token.conditions.length > 0 && (
                    <div style={{ display: 'flex', gap: 2, marginTop: 2, justifyContent: 'center' }}>
                      {token.conditions.slice(0, 5).map((_, ci) => (
                        <div key={ci} style={{
                          width: 4, height: 4, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(201,169,110,0.85)',
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Map Markers (z 22) ── */}
            {markers?.map(marker => {
              const isDraggingThis = isDraggingMarkerRef.current && dragMarkerIdRef.current === marker.id;
              const dispC = (isDraggingThis && markerDragPos) ? markerDragPos.col : marker.x;
              const dispR = (isDraggingThis && markerDragPos) ? markerDragPos.row : marker.y;
              return (
                <div
                  key={marker.id}
                  style={{
                    position: 'absolute',
                    left: (dispC + 0.5) * CELL,
                    top: dispR * CELL,
                    transform: 'translate(-50%, -100%)',
                    zIndex: 22,
                    cursor: isDraggingThis ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    transition: isDraggingThis ? 'none' : 'left 0.1s ease, top 0.1s ease',
                  }}
                  onMouseDown={e => {
                    if (e.button !== 0) return;
                    e.stopPropagation();
                    isDraggingMarkerRef.current = true;
                    dragMarkerIdRef.current = marker.id;
                  }}
                  onDoubleClick={e => {
                    e.stopPropagation();
                    const text = window.prompt('Texto do marcador:', marker.text ?? '');
                    if (text !== null) setMarkers(prev => prev.map(m => m.id === marker.id ? { ...m, text } : m));
                  }}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCtxMenu({ type: 'marker', markerId: marker.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <span style={{
                    fontSize: Math.round(CELL * 0.46),
                    lineHeight: 1,
                    filter: 'drop-shadow(0 2px 5px rgba(0,0,0,0.75))',
                  }}>
                    📌
                  </span>
                  {marker.text && (
                    <div style={{
                      background: 'rgba(10,10,16,0.88)',
                      border: `1px solid ${marker.color || 'var(--border)'}`,
                      borderRadius: 3, padding: '1px 5px', marginTop: 1,
                      fontSize: 9, color: 'var(--text)', whiteSpace: 'nowrap',
                      maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {marker.text}
                    </div>
                  )}
                </div>
              );
            })}

            {/* ── Fog of War canvas (z 25) — pointer-events:none so tokens remain clickable ── */}
            <canvas
              ref={fogCanvasRef}
              width={COLS * CELL}
              height={ROWS * CELL}
              style={{
                position: 'absolute', inset: 0, zIndex: 25,
                pointerEvents: 'none',
                opacity: fogEnabled ? 1 : 0,
                transition: 'opacity 0.35s ease',
              }}
            />

            {/* Fog drag selection rect (z 26) */}
            {fogDragRect && (() => {
              const minC = Math.min(fogDragRect.col1, fogDragRect.col2);
              const maxC = Math.max(fogDragRect.col1, fogDragRect.col2);
              const minR = Math.min(fogDragRect.row1, fogDragRect.row2);
              const maxR = Math.max(fogDragRect.row1, fogDragRect.row2);
              return (
                <div style={{
                  position: 'absolute',
                  left: minC * CELL, top: minR * CELL,
                  width: (maxC - minC + 1) * CELL, height: (maxR - minR + 1) * CELL,
                  border: '2px dashed rgba(201,169,110,0.75)',
                  background: 'rgba(201,169,110,0.12)',
                  pointerEvents: 'none', zIndex: 26,
                }} />
              );
            })()}

            {/* ── Drawing layer (z 24 / z 50 when active) ── */}
            <DrawingLayer
              drawings={drawings ?? []}
              activeTool={drawingTool}
              config={drawingConfig ?? { color: '#c9a96e', strokeWidth: 2, opacity: 1, fontSize: 16, eraserSize: 20 }}
              COLS={COLS} ROWS={ROWS}
              author={drawingAuthor}
              canDraw={!!canDraw}
              isGM={isGM}
              onAddDrawing={onAddDrawing}
              onRemoveByIds={onRemoveByIds}
            />

            {/* ── Ping / pointer layer (z 45) ── */}
            <PingLayer pings={pings} pointerPos={pointerPos} pointerColor={pointerColor} />

            {/* ── AoE layer (z 27-28) ── */}
            {(aoes?.length > 0 || aimingMode) && (
              <AoeMapLayer
                aoes={aoes ?? []}
                aimingMode={aimingMode}
                aimingCursor={aimingCursor}
                tokens={tokens}
                COLS={COLS}
                ROWS={ROWS}
                onUpdateAoe={onUpdateAoe}
                onRemoveAoe={onRemoveAoe}
                onClearAllAoes={onClearAllAoes}
              />
            )}

            {/* ── Floating damage / heal numbers (z 29) ── */}
            {floatingNums?.map(fn => {
              const tok = tokens.find(t => t.id === fn.tokenId);
              if (!tok) return null;
              const color = fn.type === 'heal' ? '#4db870' : '#e05555';
              return (
                <div key={fn.id} style={{
                  position: 'absolute',
                  left: (tok.x + 0.5) * CELL,
                  top: tok.y * CELL - 8,
                  zIndex: 28,
                  pointerEvents: 'none',
                  color,
                  fontWeight: 800,
                  fontSize: 15,
                  fontFamily: 'system-ui, sans-serif',
                  textShadow: '0 1px 5px rgba(0,0,0,0.85)',
                  animation: 'floatUp 2s ease-out forwards',
                  whiteSpace: 'nowrap',
                }}>
                  {fn.type === 'heal' ? '+' : '-'}{fn.value}
                </div>
              );
            })}

            {/* ── Measurement SVG (z 30) — above fog, always visible ── */}
            {(measurements.length > 0 || (measuring && measureCursor)) && (
              <svg
                width={COLS * CELL} height={ROWS * CELL}
                style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none', overflow: 'visible' }}
              >
                {/* Completed measurement lines */}
                {measurements.map(m => {
                  const x1 = (m.x1 + 0.5) * CELL, y1 = (m.y1 + 0.5) * CELL;
                  const x2 = (m.x2 + 0.5) * CELL, y2 = (m.y2 + 0.5) * CELL;
                  const mx = (x1 + x2) / 2,         my = (y1 + y2) / 2;
                  const dist = cellDist(m.x1, m.y1, m.x2, m.y2);
                  return (
                    <g key={m.id}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke="#c9a96e" strokeWidth="2" strokeDasharray="7 3" opacity="0.9" />
                      <circle cx={x1} cy={y1} r={4} fill="#c9a96e" opacity="0.9" />
                      <circle cx={x2} cy={y2} r={4} fill="#c9a96e" opacity="0.9" />
                      <rect x={mx - 22} y={my - 22} width={44} height={16} rx={3}
                        fill="rgba(10,10,16,0.78)" />
                      <text x={mx} y={my - 10}
                        fill="#c9a96e" fontSize="11" textAnchor="middle"
                        fontWeight="700" fontFamily="system-ui">
                        {dist}m
                      </text>
                    </g>
                  );
                })}

                {/* Active (in-progress) measurement */}
                {measuring && measureCursor && (() => {
                  const x1  = (measuring.col + 0.5)     * CELL;
                  const y1  = (measuring.row + 0.5)     * CELL;
                  const x2  = (measureCursor.col + 0.5) * CELL;
                  const y2  = (measureCursor.row + 0.5) * CELL;
                  const mx  = (x1 + x2) / 2;
                  const my  = (y1 + y2) / 2;
                  const dist = cellDist(measuring.col, measuring.row, measureCursor.col, measureCursor.row);
                  return (
                    <g>
                      {/* Crosshair at start */}
                      <line x1={x1 - 8} y1={y1} x2={x1 + 8} y2={y1}
                        stroke="#c9a96e" strokeWidth="1.5" opacity="0.85" />
                      <line x1={x1} y1={y1 - 8} x2={x1} y2={y1 + 8}
                        stroke="#c9a96e" strokeWidth="1.5" opacity="0.85" />
                      {/* Dashed line to cursor */}
                      <line x1={x1} y1={y1} x2={x2} y2={y2}
                        stroke="#c9a96e" strokeWidth="2" strokeDasharray="7 3" opacity="0.65" />
                      {/* Dot at cursor */}
                      <circle cx={x2} cy={y2} r={3} fill="#c9a96e" opacity="0.7" />
                      {/* Distance label */}
                      <rect x={mx - 22} y={my - 22} width={44} height={16} rx={3}
                        fill="rgba(10,10,16,0.78)" />
                      <text x={mx} y={my - 10}
                        fill="#c9a96e" fontSize="11" textAnchor="middle"
                        fontWeight="700" fontFamily="system-ui">
                        {dist}m
                      </text>
                    </g>
                  );
                })()}
              </svg>
            )}
            {/* ── Targeting line (z 32) ── */}
            {(() => {
              const attacker = tokens.find(t => t.id === selectedId);
              const target   = tokens.find(t => t.id === targetId);
              if (!attacker || !target || attacker.id === target.id) return null;
              const x1 = (attacker.x + 0.5) * CELL, y1 = (attacker.y + 0.5) * CELL;
              const x2 = (target.x   + 0.5) * CELL, y2 = (target.y   + 0.5) * CELL;
              const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
              const dist = cellDist(attacker.x, attacker.y, target.x, target.y);
              return (
                <svg
                  width={COLS * CELL} height={ROWS * CELL}
                  style={{ position: 'absolute', inset: 0, zIndex: 32, pointerEvents: 'none', overflow: 'visible' }}
                >
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.75" />
                  <circle cx={x1} cy={y1} r={3} fill="var(--gold)" opacity="0.8" />
                  <circle cx={x2} cy={y2} r={4} fill="#e05555" opacity="0.9" />
                  <rect x={mx - 24} y={my - 22} width={48} height={16} rx={3} fill="rgba(10,10,16,0.82)" />
                  <text x={mx} y={my - 10} fill="var(--gold)" fontSize="11" textAnchor="middle" fontWeight="700" fontFamily="system-ui">
                    {dist}m
                  </text>
                </svg>
              );
            })()}

            {/* ── Wall overlay (z 33) ── */}
            <WallTool
              walls={walls}
              wallStart={wallStart}
              wallHover={wallHover}
              wallDrawMode={wallDrawMode ?? 'wall'}
              selectedWallId={selectedWallId}
              blockedWallId={blockedWallId}
              COLS={COLS} ROWS={ROWS} CELL={CELL}
              tool={tool}
              showWalls={showWalls}
              isGM={isGM}
            />

            {/* ── Drag path preview (z 35) ── */}
            {dragPos && (() => {
              const dragged = tokens.find(t => t.id === dragTokenIdRef.current);
              if (!dragged || (dragged.x === dragPos.col && dragged.y === dragPos.row)) return null;
              const x1 = (dragged.x + 0.5) * CELL, y1 = (dragged.y + 0.5) * CELL;
              const x2 = (dragPos.col + 0.5) * CELL, y2 = (dragPos.row + 0.5) * CELL;
              const blocked = walls?.length > 0 &&
                findBlockingWall(dragged.x, dragged.y, dragPos.col, dragPos.row, walls);
              const pathColor = blocked ? '#e05555' : '#4a9a5a';
              return (
                <svg
                  width={COLS * CELL} height={ROWS * CELL}
                  style={{ position: 'absolute', inset: 0, zIndex: 35, pointerEvents: 'none', overflow: 'visible' }}
                >
                  <line x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={pathColor} strokeWidth="2" strokeDasharray="5 3"
                    opacity="0.75" strokeLinecap="round"
                  />
                  <circle cx={x2} cy={y2} r={4} fill={pathColor} opacity="0.8" />
                </svg>
              );
            })()}

            {/* ── Waypoint path (z 36) ── */}
            <WaypointLayer
              waypointToken={waypointToken}
              waypoints={waypoints}
              walls={walls}
              COLS={COLS} ROWS={ROWS}
            />

            {/* ── Waypoint click overlay (z 100, only when active) ── */}
            {waypointMode && (
              <div
                style={{
                  position: 'absolute', inset: 0,
                  zIndex: 100, cursor: 'crosshair',
                }}
                onMouseDown={e => {
                  e.stopPropagation();
                  if (e.button === 0) {
                    const { col, row } = screenToGrid(e.clientX, e.clientY);
                    const c = Math.max(0, Math.min(COLS - 1, col));
                    const r = Math.max(0, Math.min(ROWS - 1, row));
                    onWaypointAdd?.(c, r);
                  }
                }}
                onContextMenu={e => { e.preventDefault(); onWaypointConfirm?.(); }}
              />
            )}

            {/* ── Token hover tooltip (z 50) ── */}
            {hoveredToken && (() => {
              const isBeingDragged = isDraggingTokenRef.current && dragTokenIdRef.current === hoveredToken.id;
              const displayC = (isBeingDragged && dragPos) ? dragPos.col : hoveredToken.x;
              const displayR = (isBeingDragged && dragPos) ? dragPos.row : hoveredToken.y;
              const hpPct = hoveredToken.maxHp > 0 ? hoveredToken.hp / hoveredToken.maxHp : 0;
              const hpCol = hpPct > 0.5 ? '#4a9a5a' : hpPct > 0.2 ? '#c47830' : '#c43030';
              const hEnc  = calcEncumbrance(hoveredToken);
              const baseMov = hoveredToken.movement ?? 9;
              const adjMov  = hEnc.level === 'overloaded' ? 1
                : hEnc.level === 'heavy'      ? Math.max(0, baseMov - 3)
                : hEnc.level === 'moderate'   ? Math.max(0, baseMov - 1)
                : baseMov;
              return (
                <div style={{
                  position: 'absolute',
                  left: (displayC + 0.5) * CELL,
                  top: displayR * CELL - 6,
                  transform: 'translate(-50%, -100%)',
                  background: 'rgba(10,10,16,0.93)',
                  border: '1px solid var(--border)',
                  borderRadius: 5, padding: '6px 10px',
                  pointerEvents: 'none', zIndex: 50,
                  minWidth: 100, whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.7)',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)', marginBottom: 2 }}>
                    {hoveredToken.name}
                  </div>
                  {(hoveredToken.level || hoveredToken.race) && (
                    <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 2 }}>
                      {[hoveredToken.level && `Nv.${hoveredToken.level}`, hoveredToken.race].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: hpCol, marginBottom: hoveredToken.conditions.length > 0 ? 2 : 0 }}>
                    {`HP ${hoveredToken.hp}/${hoveredToken.maxHp}`}
                    {hoveredToken.maxMp > 0 && <span style={{ color: '#5a8acc' }}>{` | MP ${hoveredToken.mp}/${hoveredToken.maxMp}`}</span>}
                    {hoveredToken.ac > 0 && <span style={{ color: 'var(--sub)' }}>{` | CA ${hoveredToken.ac}`}</span>}
                  </div>
                  {hoveredToken.movement > 0 && (
                    <div style={{ fontSize: 10, color: 'var(--sub)' }}>
                      {adjMov !== baseMov
                        ? <span>Mov: {baseMov}m → <span style={{ color: hEnc.barColor }}>{adjMov}m {hEnc.level === 'overloaded' ? '❗' : '⚠'}</span></span>
                        : `Mov: ${baseMov}m`}
                    </div>
                  )}
                  {hoveredToken.conditions.length > 0 && (
                    <div style={{ fontSize: 10, color: '#8a4abd' }}>
                      {hoveredToken.conditions.join(' · ')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Weather overlay (z 40, pointer-events:none) ── */}
      <WeatherOverlay weather={weather} />

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 10, left: 10,
        background: 'rgba(18,18,28,0.88)',
        border: '1px solid var(--border)',
        color: 'var(--sub)', fontSize: 11,
        padding: '3px 10px', borderRadius: 4,
        fontVariantNumeric: 'tabular-nums',
        pointerEvents: 'none', backdropFilter: 'blur(4px)',
      }}>
        ×{zoom.toFixed(1)}
      </div>
    </div>
  );
}
