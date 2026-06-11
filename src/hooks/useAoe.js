import { useState, useCallback } from 'react';

const M_PER_CELL = 1.5;

// ── Geometry ──────────────────────────────────────────────────────────────────

function distCells(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export function isInCircle(tx, ty, cx, cy, radiusM) {
  return distCells(tx, ty, cx, cy) <= radiusM / M_PER_CELL;
}

export function isInCone(tx, ty, ox, oy, targetX, targetY, lengthM, angleDeg) {
  const dist = distCells(tx, ty, ox, oy);
  if (dist > lengthM / M_PER_CELL || dist === 0) return false;
  const aimAngle = Math.atan2(targetY - oy, targetX - ox);
  const tokenAngle = Math.atan2(ty - oy, tx - ox);
  let diff = Math.abs(tokenAngle - aimAngle);
  if (diff > Math.PI) diff = 2 * Math.PI - diff;
  return diff <= (angleDeg / 2) * (Math.PI / 180);
}

export function isInLine(tx, ty, ox, oy, targetX, targetY, lengthM, widthM) {
  const angle = Math.atan2(targetY - oy, targetX - ox);
  const cos = Math.cos(-angle), sin = Math.sin(-angle);
  const dx = tx - ox, dy = ty - oy;
  const rx = dx * cos - dy * sin;
  const ry = dx * sin + dy * cos;
  return rx >= 0 && rx <= lengthM / M_PER_CELL && Math.abs(ry) <= (widthM / M_PER_CELL) / 2;
}

export function isInSquare(tx, ty, cx, cy, sideM) {
  const half = (sideM / M_PER_CELL) / 2;
  return Math.abs(tx - cx) <= half && Math.abs(ty - cy) <= half;
}

export function getAffectedTokens(aoe, allTokens) {
  return allTokens.filter(t => {
    if (t.id === aoe.casterId) return false;
    switch (aoe.shape) {
      case 'circle': return isInCircle(t.x, t.y, aoe.targetX, aoe.targetY, aoe.radius);
      case 'cone':   return isInCone(t.x, t.y, aoe.originX, aoe.originY, aoe.targetX, aoe.targetY, aoe.length, aoe.angle);
      case 'line':   return isInLine(t.x, t.y, aoe.originX, aoe.originY, aoe.targetX, aoe.targetY, aoe.length, aoe.width);
      case 'square': return isInSquare(t.x, t.y, aoe.targetX, aoe.targetY, aoe.radius);
      default: return false;
    }
  });
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function makeAoe(overrides = {}) {
  return {
    id: `aoe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    casterId: null,
    shape: 'circle',
    originX: 0, originY: 0,
    targetX: 0, targetY: 0,
    radius: 9,     // meters — used for circle + square side
    length: 10,    // meters — cone/line
    width: 1.5,    // meters — line width
    angle: 90,     // degrees — cone spread
    color: '#e05555',
    label: '',
    affectedTokenIds: [],
    createdAt: Date.now(),
    roundCreated: 0,
    ...overrides,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAoe(initialAoes = []) {
  const [aoes, setAoes] = useState(initialAoes);
  const addAoe    = useCallback((aoe) => setAoes(prev => [...prev, aoe]), []);
  const updateAoe = useCallback((id, patch) => setAoes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a)), []);
  const removeAoe = useCallback((id) => setAoes(prev => prev.filter(a => a.id !== id)), []);
  const clearAoes = useCallback(() => setAoes([]), []);
  return { aoes, setAoes, addAoe, updateAoe, removeAoe, clearAoes };
}
