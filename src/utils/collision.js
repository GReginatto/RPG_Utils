// Returns true if segment AB crosses segment CD (exclusive endpoints)
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denom) < 1e-10) return false; // parallel

  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;

  // Exclusive so tokens sitting ON a wall endpoint don't false-positive
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

// Open doors do not block passage
function isPassable(w) {
  return w.type === 'door' && w.state === 'open';
}

// Returns true if the line between token centers crosses any wall
export function isMovementBlocked(fromX, fromY, toX, toY, walls, movingToken) {
  if (!walls?.length) return false;
  if (movingToken?.canPhaseWalls) return false;
  const ax = fromX + 0.5, ay = fromY + 0.5;
  const bx = toX   + 0.5, by = toY   + 0.5;
  if (ax === bx && ay === by) return false;
  return walls.some(w => !isPassable(w) && segmentsIntersect(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2));
}

// Returns the first blocking wall, or null if the path is clear
export function findBlockingWall(fromX, fromY, toX, toY, walls, movingToken) {
  if (!walls?.length) return null;
  if (movingToken?.canPhaseWalls) return null;
  const ax = fromX + 0.5, ay = fromY + 0.5;
  const bx = toX   + 0.5, by = toY   + 0.5;
  if (ax === bx && ay === by) return null;
  return walls.find(w => !isPassable(w) && segmentsIntersect(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) ?? null;
}

// ── Wall / door splitting ─────────────────────────────────────────────────────

function wallId() {
  return `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

// Returns true when the door segment lies (at least partially) on a wall segment
// (both collinear + door's span overlaps the wall's span)
export function isDoorOnWall(door, wall) {
  const { x1: dx1, y1: dy1, x2: dx2, y2: dy2 } = door;
  const { x1: wx1, y1: wy1, x2: wx2, y2: wy2 } = wall;

  // Cross-product collinearity check: all 4 points on the same line
  const cross1 = (wx2 - wx1) * (dy1 - wy1) - (wy2 - wy1) * (dx1 - wx1);
  const cross2 = (wx2 - wx1) * (dy2 - wy1) - (wy2 - wy1) * (dx2 - wx1);
  if (Math.abs(cross1) > 0.01 || Math.abs(cross2) > 0.01) return false;

  // Project door endpoints onto the wall direction (t=0 at wall start, t=1 at wall end)
  const wdx = wx2 - wx1, wdy = wy2 - wy1;
  const wLen2 = wdx * wdx + wdy * wdy;
  if (wLen2 < 1e-10) return false;

  const t1 = ((dx1 - wx1) * wdx + (dy1 - wy1) * wdy) / wLen2;
  const t2 = ((dx2 - wx1) * wdx + (dy2 - wy1) * wdy) / wLen2;

  // Door must overlap the wall span (not just touch endpoints)
  return Math.max(t1, t2) > 0.001 && Math.min(t1, t2) < 0.999;
}

// Split a wall into at most two pieces, with a gap where the door sits.
// Returns an array of 0, 1, or 2 wall objects (never includes the door itself).
export function splitWallAroundDoor(wall, door) {
  const { x1: wx1, y1: wy1, x2: wx2, y2: wy2 } = wall;
  const { x1: dx1, y1: dy1, x2: dx2, y2: dy2 } = door;

  const wdx = wx2 - wx1, wdy = wy2 - wy1;
  const wLen2 = wdx * wdx + wdy * wdy;

  const t1 = ((dx1 - wx1) * wdx + (dy1 - wy1) * wdy) / wLen2;
  const t2 = ((dx2 - wx1) * wdx + (dy2 - wy1) * wdy) / wLen2;

  // Clamp to wall span and keep order
  const tA = Math.max(0, Math.min(t1, t2));
  const tB = Math.min(1, Math.max(t1, t2));

  const snap = (v) => Math.round(v * 1000) / 1000; // sub-pixel safety

  const pieces = [];

  // Left/start piece: wall-start → door-start
  if (tA > 0.001) {
    pieces.push({
      id: wallId(),
      x1: wx1, y1: wy1,
      x2: snap(wx1 + wdx * tA),
      y2: snap(wy1 + wdy * tA),
    });
  }

  // Right/end piece: door-end → wall-end
  if (tB < 0.999) {
    pieces.push({
      id: wallId(),
      x1: snap(wx1 + wdx * tB),
      y1: snap(wy1 + wdy * tB),
      x2: wx2, y2: wy2,
    });
  }

  return pieces;
}

// Fix existing sessions: for every door, split any plain wall that it overlaps.
// Returns the cleaned walls array (may be longer than the input due to splits).
export function cleanupWallDoorOverlaps(walls) {
  if (!walls?.length) return walls ?? [];
  const doors = walls.filter(w => w.type === 'door');
  if (!doors.length) return walls;

  let result = [...walls];

  for (const door of doors) {
    const overlapping = result.filter(w => w.type !== 'door' && isDoorOnWall(door, w));
    for (const wall of overlapping) {
      const pieces = splitWallAroundDoor(wall, door);
      result = result.filter(w => w.id !== wall.id);
      result.push(...pieces);
      console.log(
        `[wallSplit] Parede (${wall.x1},${wall.y1})→(${wall.x2},${wall.y2}) dividida ` +
        `pela porta (${door.x1},${door.y1})→(${door.x2},${door.y2}) → ${pieces.length} peça(s).`
      );
    }
  }

  return result;
}

// ── Exact-duplicate deduplication ────────────────────────────────────────────
// Doors win over plain walls at the same coordinates.
export function deduplicateWalls(walls) {
  if (!walls?.length) return walls ?? [];
  const seen = new Map();
  const result = [];
  for (const w of walls) {
    const key = [
      Math.min(w.x1, w.x2), Math.min(w.y1, w.y2),
      Math.max(w.x1, w.x2), Math.max(w.y1, w.y2),
    ].join(',');
    if (!seen.has(key)) {
      seen.set(key, result.length);
      result.push(w);
    } else {
      const idx = seen.get(key);
      if (w.type === 'door' && result[idx].type !== 'door') {
        result[idx] = w; // door wins
      }
    }
  }
  return result;
}

// Apply both passes: first deduplicate exact matches, then split overlaps.
export function sanitizeWalls(walls) {
  return cleanupWallDoorOverlaps(deduplicateWalls(walls ?? []));
}
