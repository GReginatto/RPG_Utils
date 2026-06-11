// ── Ray–segment intersection ──────────────────────────────────────────────────
// Ray: origin (ox,oy) + t*(dx,dy)
// Segment: (x1,y1) → (x2,y2)
// Returns t ≥ 0 if hit, null otherwise
function raySegmentIntersection(ox, oy, dx, dy, x1, y1, x2, y2) {
  const sx = x2 - x1, sy = y2 - y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-10) return null; // parallel
  const t = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
  const u = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;
  if (t >= 0 && u >= 0 && u <= 1) return t;
  return null;
}

// ── Cast a single ray ─────────────────────────────────────────────────────────
function castRay(origin, angle, walls, maxRange) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let closest = maxRange;
  for (const wall of walls) {
    if (wall.type === 'door' && wall.state === 'open') continue;
    const t = raySegmentIntersection(origin.x, origin.y, dx, dy, wall.x1, wall.y1, wall.x2, wall.y2);
    if (t !== null && t < closest) closest = t;
  }
  return {
    angle,
    dist: closest,
    hitX: origin.x + dx * closest,
    hitY: origin.y + dy * closest,
  };
}

// ── Fallback circle polygon (when no walls) ───────────────────────────────────
export function circlePolygon(cx, cy, r, steps = 48) {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// ── Main visibility polygon calculation ───────────────────────────────────────
// origin: { x, y } in intersection-grid units
// walls: [{ x1, y1, x2, y2 }, …] in intersection-grid units
// maxRange: in intersection-grid units
// Returns polygon vertices in intersection-grid units
export function calculateVisibility(origin, walls, maxRange) {
  if (!walls || walls.length === 0) {
    return circlePolygon(origin.x, origin.y, maxRange);
  }

  // Collect all wall endpoints
  const points = [];
  for (const w of walls) {
    points.push({ x: w.x1, y: w.y1 });
    points.push({ x: w.x2, y: w.y2 });
  }

  // Add boundary points every 10°
  for (let a = 0; a < 360; a += 10) {
    const rad = a * Math.PI / 180;
    points.push({
      x: origin.x + Math.cos(rad) * maxRange,
      y: origin.y + Math.sin(rad) * maxRange,
    });
  }

  // Cast rays toward each point (plus ±0.001 rad offsets for corners)
  const rays = [];
  for (const pt of points) {
    const angle = Math.atan2(pt.y - origin.y, pt.x - origin.x);
    for (const offset of [-0.001, 0, 0.001]) {
      rays.push(castRay(origin, angle + offset, walls, maxRange));
    }
  }

  // Sort by angle
  rays.sort((a, b) => a.angle - b.angle);

  return rays.map(r => ({ x: r.hitX, y: r.hitY }));
}

// ── Distance from point to segment ────────────────────────────────────────────
export function distPointToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
