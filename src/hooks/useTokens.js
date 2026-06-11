import { useState, useRef, useCallback, useEffect } from 'react';
import { GRID, COLORS, MOVEMENT } from '../utils/constants';
import { isMovementBlocked } from '../utils/collision';

const { cols: COLS, rows: ROWS } = GRID;

const TYPE_COLOR = {
  player: COLORS.player,
  npc:    COLORS.npc,
  ally:   COLORS.ally,
};

const DEFAULT_ATTRS = { FOR: 10, DEX: 10, CON: 10, INT: 10, SAB: 10, CAR: 10, DOM: 10 };

function makeToken(type, col, row, id) {
  return {
    id,
    name:       type === 'player' ? 'Jogador' : type === 'npc' ? 'NPC' : 'Aliado',
    type,
    image:      null,
    level:      1,
    race:       'Humano',
    profession: 'Guerreiro',
    hp: 30, maxHp: 30,
    mp: 15, maxMp: 15,
    ac: 12,
    initiative: 0,
    movement:   MOVEMENT.default,
    attributes: { ...DEFAULT_ATTRS },
    aura:       '',
    conditions: [],
    notes:      '',
    // Lighting
    lightBright:  0,
    lightDim:     0,
    lightColor:   '#ffd700',
    visionRange:  18,
    darkvision:   false,
    // Ownership & visibility
    owner:        'gm',
    visibleToAll: type !== 'npc',
    hidden:       false,
    x: col,
    y: row,
    color: TYPE_COLOR[type] || '#888',
  };
}

function maxIdFromTokens(tokens) {
  if (!tokens || tokens.length === 0) return 0;
  return tokens.reduce((m, t) => {
    const n = parseInt(t.id.replace(/\D/g, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
}

export function useTokens(initialTokens = []) {
  const [tokens, setTokens] = useState(initialTokens);
  const [selectedId, setSelectedId] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [shakingId, setShakingId] = useState(null);

  const tokensRef = useRef(initialTokens);
  const isDraggingTokenRef = useRef(false);
  const dragTokenIdRef = useRef(null);
  const nextIdRef = useRef(maxIdFromTokens(initialTokens) + 1);

  useEffect(() => { tokensRef.current = tokens; }, [tokens]);

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const addToken = useCallback((type, col, row) => {
    const id = `t${nextIdRef.current++}`;
    setTokens(prev => [...prev, makeToken(type, col, row, id)]);
    setSelectedId(id);
    return id;
  }, []);

  const updateToken = useCallback((id, changes) => {
    setTokens(prev => prev.map(t => {
      if (t.id !== id) return t;
      const next = { ...t, ...changes };
      if (changes.type && TYPE_COLOR[changes.type]) next.color = TYPE_COLOR[changes.type];
      return next;
    }));
  }, []);

  const deleteToken = useCallback((id) => {
    setTokens(prev => prev.filter(t => t.id !== id));
    setSelectedId(prev => prev === id ? null : prev);
  }, []);

  const duplicateToken = useCallback((id) => {
    setTokens(prev => {
      const src = prev.find(t => t.id === id);
      if (!src) return prev;
      const candidates = [];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (dx !== 0 || dy !== 0) candidates.push({ x: src.x + dx, y: src.y + dy });
      const spot = candidates.find(p =>
        p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS &&
        !prev.some(t => t.x === p.x && t.y === p.y)
      );
      if (!spot) return prev;
      return [...prev, { ...src, id: `t${nextIdRef.current++}`, x: spot.x, y: spot.y }];
    });
  }, []);

  const adjustHp = useCallback((id, delta) => {
    setTokens(prev => prev.map(t =>
      t.id === id ? { ...t, hp: Math.max(0, Math.min(t.maxHp, t.hp + delta)) } : t
    ));
  }, []);

  // Resets the ID counter based on an array of tokens (used after import)
  const resetIdCounter = useCallback((loadedTokens) => {
    nextIdRef.current = maxIdFromTokens(loadedTokens) + 1;
  }, []);

  // ── Keyboard movement ─────────────────────────────────────────────────────

  const shakeToken = useCallback((id) => {
    setShakingId(id);
    setTimeout(() => setShakingId(s => s === id ? null : s), 380);
  }, []);

  const moveToken = useCallback((id, dx, dy, onMoved, options = {}) => {
    const { walls = [], bypass = false } = options;
    setTokens(prev => {
      const token = prev.find(t => t.id === id);
      if (!token) return prev;
      const effectiveBypass = bypass || !!token.canPhaseWalls;
      const shake = () => { setShakingId(id); setTimeout(() => setShakingId(s => s === id ? null : s), 380); };

      const isSprint = Math.abs(dx) === 2 || Math.abs(dy) === 2;

      if (isSprint && !effectiveBypass) {
        const sx = dx === 0 ? 0 : dx / 2;
        const sy = dy === 0 ? 0 : dy / 2;
        const nx1 = token.x + sx, ny1 = token.y + sy;
        const nx2 = token.x + dx, ny2 = token.y + dy;

        const step1Clear =
          nx1 >= 0 && nx1 < COLS && ny1 >= 0 && ny1 < ROWS &&
          !prev.some(t => t.id !== id && t.x === nx1 && t.y === ny1) &&
          !isMovementBlocked(token.x, token.y, nx1, ny1, walls, token);

        if (!step1Clear) { shake(); return prev; }

        const step2Clear =
          nx2 >= 0 && nx2 < COLS && ny2 >= 0 && ny2 < ROWS &&
          !prev.some(t => t.id !== id && t.x === nx2 && t.y === ny2) &&
          !isMovementBlocked(nx1, ny1, nx2, ny2, walls, token);

        const destX = step2Clear ? nx2 : nx1;
        const destY = step2Clear ? ny2 : ny1;
        onMoved?.(destX, destY);
        return prev.map(t => t.id === id ? { ...t, x: destX, y: destY } : t);
      }

      // Normal move (also handles isSprint && effectiveBypass — jumps directly)
      const nx = token.x + dx, ny = token.y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { shake(); return prev; }
      if (prev.some(t => t.id !== id && t.x === nx && t.y === ny)) { shake(); return prev; }
      if (!effectiveBypass && isMovementBlocked(token.x, token.y, nx, ny, walls, token)) { shake(); return prev; }
      onMoved?.(nx, ny);
      return prev.map(t => t.id === id ? { ...t, x: nx, y: ny } : t);
    });
  }, []);

  // ── Drag lifecycle ────────────────────────────────────────────────────────

  const startDrag = useCallback((id, col, row) => {
    isDraggingTokenRef.current = true;
    dragTokenIdRef.current = id;
    setDragPos({ col, row });
  }, []);

  const commitDrag = useCallback((snapCol, snapRow) => {
    const id = dragTokenIdRef.current;
    if (!id) return;
    setTokens(prev => {
      const blocked = prev.some(t => t.id !== id && t.x === snapCol && t.y === snapRow);
      if (blocked) return prev;
      return prev.map(t => t.id === id ? { ...t, x: snapCol, y: snapRow } : t);
    });
    isDraggingTokenRef.current = false;
    dragTokenIdRef.current = null;
    setDragPos(null);
  }, []);

  const cancelDrag = useCallback(() => {
    isDraggingTokenRef.current = false;
    dragTokenIdRef.current = null;
    setDragPos(null);
  }, []);

  return {
    tokens, selectedId, dragPos, shakingId,
    setTokens, setSelectedId, setDragPos,
    tokensRef, isDraggingTokenRef, dragTokenIdRef,
    addToken, updateToken, deleteToken, duplicateToken, adjustHp, resetIdCounter,
    moveToken, shakeToken, startDrag, commitDrag, cancelDrag,
  };
}
