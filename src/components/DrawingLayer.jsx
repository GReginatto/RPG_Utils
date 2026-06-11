import { useState, useRef, useCallback } from 'react';
import { makeDrawing } from '../hooks/useDrawing';
import { GRID } from '../utils/constants';
import { isMovementBlocked } from '../utils/collision';

const CELL = GRID.cellSize;
const M = 1.5;

// ── Smooth freehand points ────────────────────────────────────────────────────
function smooth(pts, w = 2) {
  if (pts.length < w * 2 + 1) return pts;
  return pts.map((p, i) => {
    const s = Math.max(0, i - w), e = Math.min(pts.length - 1, i + w);
    const slice = pts.slice(s, e + 1);
    return {
      x: slice.reduce((a, q) => a + q.x, 0) / slice.length,
      y: slice.reduce((a, q) => a + q.y, 0) / slice.length,
    };
  });
}

function toPath(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) return `M${pts[0].x},${pts[0].y}`;
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q${pts[i].x},${pts[i].y} ${mid.x},${mid.y}`;
  }
  d += ` L${pts[pts.length - 1].x},${pts[pts.length - 1].y}`;
  return d;
}

// ── DrawingShape — renders one saved drawing ──────────────────────────────────
function DrawingShape({ d }) {
  const s = { opacity: d.opacity };
  const sk = { stroke: d.color, strokeWidth: d.strokeWidth, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (d.type) {
    case 'freehand':
      return <path d={toPath(smooth(d.points))} {...sk} style={s} />;
    case 'line':
      return <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} {...sk} style={s} />;
    case 'circle':
      return <circle cx={d.cx} cy={d.cy} r={d.radius} {...sk} style={s} />;
    case 'rect':
      return (
        <rect x={Math.min(d.x1, d.x2)} y={Math.min(d.y1, d.y2)}
          width={Math.abs(d.x2 - d.x1)} height={Math.abs(d.y2 - d.y1)}
          {...sk} style={s} />
      );
    case 'filledRect':
      return (
        <rect x={Math.min(d.x1, d.x2)} y={Math.min(d.y1, d.y2)}
          width={Math.abs(d.x2 - d.x1)} height={Math.abs(d.y2 - d.y1)}
          fill={d.color} fillOpacity={d.opacity * 0.4}
          stroke={d.color} strokeWidth={d.strokeWidth} style={s} />
      );
    case 'text':
      return (
        <text x={d.x1} y={d.y1} fill={d.color} fontSize={d.fontSize}
          fontFamily="system-ui, sans-serif" style={s}>{d.text}</text>
      );
    default:
      return null;
  }
}

// ── DrawingLayer ──────────────────────────────────────────────────────────────
export function DrawingLayer({
  drawings, activeTool, config,
  COLS, ROWS, author, canDraw, isGM,
  onAddDrawing, onRemoveByIds,
}) {
  const svgRef = useRef(null);
  const [inProg, setInProg] = useState(null);
  const [eraserPos, setEraserPos] = useState(null);
  const activeRef = useRef(false);

  const svgPt = (e) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const sp = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { x: sp.x, y: sp.y };
  };

  const snapLine = (x1, y1, x2, y2, shift) => {
    if (!shift) return { x2, y2 };
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const snapped = Math.round(ang / (Math.PI / 12)) * (Math.PI / 12);
    const d = Math.hypot(x2 - x1, y2 - y1);
    return { x2: x1 + Math.cos(snapped) * d, y2: y1 + Math.sin(snapped) * d };
  };

  const doErase = useCallback((x, y) => {
    const half = (config.eraserSize ?? 20) / 2;
    const hits = drawings.filter(d => {
      if (!isGM && d.author !== author) return false;
      if (d.type === 'freehand') return d.points.some(p => Math.hypot(p.x - x, p.y - y) < half);
      if (d.type === 'line') {
        const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
        const len2 = dx * dx + dy * dy;
        const t = len2 ? Math.max(0, Math.min(1, ((x - d.x1) * dx + (y - d.y1) * dy) / len2)) : 0;
        return Math.hypot(d.x1 + t * dx - x, d.y1 + t * dy - y) < half;
      }
      if (d.type === 'circle')
        return Math.abs(Math.hypot(x - d.cx, y - d.cy) - d.radius) < half;
      if (d.type === 'text')
        return Math.hypot(x - d.x1, y - d.y1) < half * 3;
      return x >= Math.min(d.x1, d.x2) - half && x <= Math.max(d.x1, d.x2) + half &&
             y >= Math.min(d.y1, d.y2) - half && y <= Math.max(d.y1, d.y2) + half;
    });
    if (hits.length) onRemoveByIds(hits.map(d => d.id));
  }, [drawings, isGM, author, config.eraserSize, onRemoveByIds]);

  const onDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const { x, y } = svgPt(e);
    if (activeTool === 'text') {
      const text = window.prompt('Texto:');
      if (text?.trim()) {
        onAddDrawing(makeDrawing({
          type: 'text', x1: x, y1: y, text: text.trim(),
          color: config.color, fontSize: config.fontSize ?? 16,
          opacity: config.opacity, author,
        }));
      }
      return;
    }
    if (activeTool === 'eraser') { doErase(x, y); return; }
    activeRef.current = true;
    setInProg({ type: activeTool, x1: x, y1: y, x2: x, y2: y, cx: x, cy: y, radius: 0, points: [{ x, y }] });
  };

  const onMove = (e) => {
    const { x, y } = svgPt(e);
    setEraserPos(activeTool === 'eraser' ? { x, y } : null);
    if (activeTool === 'eraser' && e.buttons === 1) { doErase(x, y); return; }
    if (!activeRef.current || !inProg) return;
    if (activeTool === 'freehand') {
      setInProg(p => ({ ...p, points: [...p.points, { x, y }] }));
    } else {
      const { x2, y2 } = activeTool === 'line'
        ? snapLine(inProg.x1, inProg.y1, x, y, e.shiftKey)
        : { x2: x, y2: y };
      const r = Math.hypot(x - inProg.cx, y - inProg.cy);
      setInProg(p => ({ ...p, x2, y2, radius: r }));
    }
  };

  const onUp = (e) => {
    if (!activeRef.current || !inProg) return;
    activeRef.current = false;
    const { x, y } = svgPt(e);
    const base = { color: config.color, strokeWidth: config.strokeWidth, opacity: config.opacity, author };
    let d;
    switch (activeTool) {
      case 'freehand': {
        const pts = smooth([...inProg.points, { x, y }]);
        if (pts.length > 1) d = makeDrawing({ ...base, type: 'freehand', points: pts });
        break;
      }
      case 'line': {
        const { x2, y2 } = snapLine(inProg.x1, inProg.y1, x, y, e.shiftKey);
        if (Math.hypot(x2 - inProg.x1, y2 - inProg.y1) > 2)
          d = makeDrawing({ ...base, type: 'line', x1: inProg.x1, y1: inProg.y1, x2, y2 });
        break;
      }
      case 'circle': {
        const r = Math.hypot(x - inProg.cx, y - inProg.cy);
        if (r > 2) d = makeDrawing({ ...base, type: 'circle', cx: inProg.cx, cy: inProg.cy, radius: r });
        break;
      }
      case 'rect':
      case 'filledRect': {
        const w = Math.abs(x - inProg.x1), h = Math.abs(y - inProg.y1);
        if (w > 2 || h > 2)
          d = makeDrawing({ ...base, type: activeTool, x1: inProg.x1, y1: inProg.y1, x2: x, y2: y });
        break;
      }
      default: break;
    }
    if (d) onAddDrawing(d);
    setInProg(null);
  };

  const renderPreview = () => {
    if (!inProg) return null;
    const sk = {
      stroke: config.color, strokeWidth: config.strokeWidth,
      fill: 'none', strokeDasharray: '6 3', opacity: config.opacity * 0.8,
      strokeLinecap: 'round',
    };
    switch (activeTool) {
      case 'freehand':
        return <path d={toPath(inProg.points)} {...sk} />;
      case 'line':
        return <line x1={inProg.x1} y1={inProg.y1} x2={inProg.x2} y2={inProg.y2} {...sk} />;
      case 'circle': {
        const distM = (inProg.radius / CELL) * M;
        return (
          <>
            <circle cx={inProg.cx} cy={inProg.cy} r={inProg.radius} {...sk} />
            {inProg.radius > 5 && (
              <text x={inProg.cx} y={inProg.cy - inProg.radius - 6}
                fill={config.color} fontSize={10} textAnchor="middle" fontFamily="system-ui">
                {distM.toFixed(1)}m
              </text>
            )}
          </>
        );
      }
      case 'rect':
      case 'filledRect': {
        const rx = Math.min(inProg.x1, inProg.x2), ry = Math.min(inProg.y1, inProg.y2);
        const rw = Math.abs(inProg.x2 - inProg.x1), rh = Math.abs(inProg.y2 - inProg.y1);
        return (
          <>
            <rect x={rx} y={ry} width={rw} height={rh}
              fill={activeTool === 'filledRect' ? config.color : 'none'}
              fillOpacity={activeTool === 'filledRect' ? config.opacity * 0.25 : 0}
              stroke={config.color} strokeWidth={config.strokeWidth}
              strokeDasharray="6 3" opacity={config.opacity * 0.8} />
            {rw > 8 && (
              <text x={rx + rw / 2} y={ry - 6}
                fill={config.color} fontSize={10} textAnchor="middle" fontFamily="system-ui">
                {(rw / CELL).toFixed(1)}×{(rh / CELL).toFixed(1)} cel
              </text>
            )}
          </>
        );
      }
      default: return null;
    }
  };

  const isActive = !!activeTool && canDraw;
  const svgW = COLS * CELL, svgH = ROWS * CELL;

  return (
    <svg
      ref={svgRef}
      width={svgW}
      height={svgH}
      style={{
        position: 'absolute', inset: 0,
        zIndex: isActive ? 50 : 24,
        overflow: 'visible',
        cursor: activeTool === 'eraser' ? 'cell' : isActive ? 'crosshair' : 'default',
        pointerEvents: isActive ? 'all' : 'none',
      }}
    >
      {drawings.map(d => <DrawingShape key={d.id} d={d} />)}

      {renderPreview()}

      {activeTool === 'eraser' && eraserPos && (
        <circle cx={eraserPos.x} cy={eraserPos.y} r={(config.eraserSize ?? 20) / 2}
          fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} pointerEvents="none" />
      )}

      {isActive && (
        <rect x={0} y={0} width={svgW} height={svgH}
          fill="transparent"
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
        />
      )}
    </svg>
  );
}

// ── WaypointLayer — SVG path display inside transform div ─────────────────────
export function WaypointLayer({ waypointToken, waypoints, walls, COLS, ROWS }) {
  if (!waypointToken || !waypoints?.length) return null;

  const allPts = [{ x: waypointToken.x, y: waypointToken.y }, ...waypoints];
  const moveSpeed = waypointToken.movement ?? 9;
  let cumDist = 0;

  const segments = allPts.slice(1).map((to, i) => {
    const from = allPts[i];
    const dist = Math.hypot(to.x - from.x, to.y - from.y) * M;
    const blocked = !waypointToken.canPhaseWalls && walls?.length ? isMovementBlocked(from.x, from.y, to.x, to.y, walls, waypointToken) : false;
    cumDist += dist;
    return { from, to, dist, cumDist, blocked };
  });

  const totalDist = cumDist;
  const svgW = COLS * CELL, svgH = ROWS * CELL;

  const segColor = (seg) => {
    if (seg.blocked) return '#c43030';
    if (seg.cumDist <= moveSpeed) return '#4a9a5a';
    if (seg.cumDist <= moveSpeed * 2) return '#c9a96e';
    return '#c43030';
  };

  const last = waypoints[waypoints.length - 1];
  const lx = (last.x + 0.5) * CELL, ly = (last.y + 0.5) * CELL;
  const overBy = totalDist - moveSpeed;
  const anyBlocked = segments.some(s => s.blocked);
  const totalColor = anyBlocked ? '#c43030' : overBy > 0 ? '#c9a96e' : '#4a9a5a';
  const totalLabel = anyBlocked
    ? `⛔ Caminho bloqueado`
    : overBy > 0
      ? `Total: ${totalDist.toFixed(1)}m (excede em ${overBy.toFixed(1)}m)`
      : `Total: ${totalDist.toFixed(1)}m`;

  return (
    <svg width={svgW} height={svgH}
      style={{ position: 'absolute', inset: 0, zIndex: 36, overflow: 'visible', pointerEvents: 'none' }}>

      {segments.map((seg, i) => {
        const x1 = (seg.from.x + 0.5) * CELL, y1 = (seg.from.y + 0.5) * CELL;
        const x2 = (seg.to.x + 0.5) * CELL, y2 = (seg.to.y + 0.5) * CELL;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const color = segColor(seg);
        const labelW = 52;
        return (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={color} strokeWidth={2.5}
              strokeDasharray={seg.blocked ? '6 3' : undefined}
              strokeLinecap="round" />
            <rect x={mx - labelW / 2} y={my - 9} width={labelW} height={14} rx={2}
              fill="rgba(10,10,16,0.82)" />
            <text x={mx} y={my} fill={color} fontSize={10} textAnchor="middle"
              dominantBaseline="central" fontFamily="system-ui" fontWeight="700">
              {seg.dist.toFixed(1)}m{seg.blocked ? ' ⛔' : ''}
            </text>
          </g>
        );
      })}

      {/* Waypoint dots */}
      {waypoints.map((wp, i) => (
        <circle key={i}
          cx={(wp.x + 0.5) * CELL} cy={(wp.y + 0.5) * CELL}
          r={5} fill="#c9a96e" stroke="rgba(0,0,0,0.6)" strokeWidth={1} />
      ))}

      {/* Total label at last waypoint */}
      <rect x={lx - 90} y={ly + 12} width={180} height={15} rx={3}
        fill="rgba(10,10,16,0.9)" />
      <text x={lx} y={ly + 20} fill={totalColor} fontSize={10} textAnchor="middle"
        dominantBaseline="central" fontFamily="system-ui" fontWeight="700">
        {totalLabel}
      </text>

      {/* Movement legend */}
      <rect x={lx - 90} y={ly + 30} width={180} height={13} rx={3}
        fill="rgba(10,10,16,0.7)" />
      <text x={lx} y={ly + 37} fill="var(--sub,#7a7468)" fontSize={9} textAnchor="middle"
        dominantBaseline="central" fontFamily="system-ui">
        Mov: {moveSpeed}m · Enter/Dir→confirmar · Esc=cancelar
      </text>
    </svg>
  );
}
