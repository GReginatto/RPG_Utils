// Renders inside the grid area div (coordinates are cell-pixel)
// ix/iy are intersection-grid coords (0..COLS, 0..ROWS)
// Pixel: (ix*CELL, iy*CELL)

function doorStyle(w) {
  if (w.secret)                return { stroke: '#3a3aff', sw: 1, dash: '3 8', opacity: 0.45 };
  if (w.state === 'open')      return { stroke: '#555555', sw: 1, dash: '2 6', opacity: 0.75 };
  if (w.state === 'locked')    return { stroke: '#c43030', sw: 2, dash: '4 4', opacity: 0.92 };
  /* closed */                 return { stroke: '#e07020', sw: 2, dash: '4 4', opacity: 0.92 };
}

export default function WallTool({
  walls,
  wallStart,        // { ix, iy } | null
  wallHover,        // { ix, iy } | null
  wallDrawMode,     // 'wall' | 'door'
  selectedWallId,
  blockedWallId,
  COLS, ROWS, CELL,
  tool,             // 'wall' | other
  showWalls,
  isGM,
}) {
  const W = COLS * CELL, H = ROWS * CELL;
  const showDots = tool === 'wall';

  const regularWalls = showWalls ? (walls ?? []).filter(w => w.type !== 'door') : [];
  const doors        = showWalls ? (walls ?? []).filter(w => w.type === 'door') : [];

  const previewColor = wallDrawMode === 'door' ? '#e07020' : '#ffcc88';
  const previewDash  = wallDrawMode === 'door' ? '4 4'     : '6 4';

  return (
    <svg
      width={W} height={H}
      style={{ position: 'absolute', inset: 0, zIndex: 33, overflow: 'visible', pointerEvents: 'none' }}
    >
      {/* ── Intersection dots (wall tool active) ── */}
      {showDots && Array.from({ length: COLS + 1 }, (_, ix) =>
        Array.from({ length: ROWS + 1 }, (_, iy) => {
          const isStart   = wallStart && wallStart.ix === ix && wallStart.iy === iy;
          const isHovered = wallHover && wallHover.ix === ix && wallHover.iy === iy;
          return (
            <circle
              key={`dot-${ix}-${iy}`}
              cx={ix * CELL} cy={iy * CELL}
              r={isStart ? 6 : isHovered ? 5 : 3}
              fill={isStart ? '#c9a96e' : isHovered ? '#ffcc88' : 'rgba(255,255,255,0.25)'}
              style={{ pointerEvents: 'none' }}
            />
          );
        })
      )}

      {/* ── Regular walls ── */}
      {regularWalls.map(w => {
        const isSelected = w.id === selectedWallId;
        const isBlocked  = w.id === blockedWallId;
        const lineColor  = isBlocked ? '#e05555' : isSelected ? '#c9a96e' : '#ff6644';
        return (
          <g key={w.id}>
            {isBlocked && (
              <line
                x1={w.x1 * CELL} y1={w.y1 * CELL}
                x2={w.x2 * CELL} y2={w.y2 * CELL}
                stroke="#e05555" strokeWidth={9} strokeOpacity={0.55}
                strokeLinecap="round"
              />
            )}
            {isSelected && (
              <line
                x1={w.x1 * CELL} y1={w.y1 * CELL}
                x2={w.x2 * CELL} y2={w.y2 * CELL}
                stroke="#c9a96e" strokeWidth={6} strokeOpacity={0.4}
                strokeLinecap="round"
              />
            )}
            <line
              x1={w.x1 * CELL} y1={w.y1 * CELL}
              x2={w.x2 * CELL} y2={w.y2 * CELL}
              stroke={lineColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={isSelected || isBlocked ? 1 : 0.85}
            />
            <circle cx={w.x1 * CELL} cy={w.y1 * CELL} r={3} fill={lineColor} opacity={0.9} />
            <circle cx={w.x2 * CELL} cy={w.y2 * CELL} r={3} fill={lineColor} opacity={0.9} />
          </g>
        );
      })}

      {/* ── Doors ── */}
      {doors.map(w => {
        const ds = doorStyle(w);
        if (w.secret && !isGM) return null; // secret doors invisible to players
        const isSelected = w.id === selectedWallId;
        const mx = ((w.x1 + w.x2) / 2) * CELL;
        const my = ((w.y1 + w.y2) / 2) * CELL;
        const icon = w.state === 'locked' ? '🔒' : w.secret ? '🗝' : '🚪';
        return (
          <g key={w.id}>
            {isSelected && (
              <line
                x1={w.x1 * CELL} y1={w.y1 * CELL}
                x2={w.x2 * CELL} y2={w.y2 * CELL}
                stroke="#c9a96e" strokeWidth={6} strokeOpacity={0.4}
                strokeLinecap="round"
              />
            )}
            <line
              x1={w.x1 * CELL} y1={w.y1 * CELL}
              x2={w.x2 * CELL} y2={w.y2 * CELL}
              stroke={ds.stroke} strokeWidth={ds.sw}
              strokeDasharray={ds.dash} strokeLinecap="round"
              opacity={ds.opacity}
            />
            <circle cx={w.x1 * CELL} cy={w.y1 * CELL} r={2.5} fill={ds.stroke} opacity={0.8} />
            <circle cx={w.x2 * CELL} cy={w.y2 * CELL} r={2.5} fill={ds.stroke} opacity={0.8} />
            {/* Door icon at midpoint */}
            <text x={mx} y={my}
              textAnchor="middle" dominantBaseline="central"
              fontSize={11} style={{ userSelect: 'none' }}>
              {icon}
            </text>
          </g>
        );
      })}

      {/* ── In-progress wall/door preview ── */}
      {wallStart && wallHover && (
        <line
          x1={wallStart.ix * CELL} y1={wallStart.iy * CELL}
          x2={wallHover.ix * CELL} y2={wallHover.iy * CELL}
          stroke={previewColor} strokeWidth={2} strokeDasharray={previewDash}
          strokeOpacity={0.85} strokeLinecap="round"
        />
      )}
    </svg>
  );
}
