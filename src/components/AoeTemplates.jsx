import { useState, useEffect, useRef, useCallback } from 'react';
import { GRID } from '../utils/constants';
import { makeAoe, getAffectedTokens } from '../hooks/useAoe';

const { cellSize: CELL } = GRID;
const METERS_PER_CELL = 1.5;
const PRESETS_KEY = 'vtt-aoe-presets';

const BUILTIN_PRESETS = [
  { label: 'Projetar',        shape: 'circle', radius: 9,  color: '#c9a96e', angle: 60, length: 9,  width: 3, rotation: 0 },
  { label: 'Explosão de Luz', shape: 'circle', radius: 6,  color: '#ffe680', angle: 60, length: 9,  width: 3, rotation: 0 },
  { label: 'Nuvem Tóxica',    shape: 'circle', radius: 9,  color: '#4db870', angle: 60, length: 9,  width: 3, rotation: 0 },
  { label: 'Cone de Fogo',    shape: 'cone',   radius: 9,  color: '#e05555', angle: 60, length: 9,  width: 3, rotation: 0 },
  { label: 'Domínio',         shape: 'square', radius: 12, color: '#8a4abd', angle: 60, length: 9,  width: 3, rotation: 0 },
];

const COLOR_PRESETS = ['#e05555', '#ffe680', '#4db870', '#8a4abd', '#3a6abf', '#c9a96e', '#ff8c40'];

// ── SVG path helpers ──────────────────────────────────────────────────────────

function circleProps(aoe) {
  const r = (aoe.radius / METERS_PER_CELL) * CELL;
  const cx = (aoe.x + 0.5) * CELL;
  const cy = (aoe.y + 0.5) * CELL;
  return { cx, cy, r };
}

function conePoints(aoe) {
  const len = (aoe.length / METERS_PER_CELL) * CELL;
  const halfAngle = (aoe.angle / 2) * (Math.PI / 180);
  const rot = aoe.rotation * (Math.PI / 180);
  const cx = (aoe.x + 0.5) * CELL;
  const cy = (aoe.y + 0.5) * CELL;
  const a1 = rot - halfAngle;
  const a2 = rot + halfAngle;
  const x1 = cx + Math.cos(a1) * len, y1 = cy + Math.sin(a1) * len;
  const x2 = cx + Math.cos(a2) * len, y2 = cy + Math.sin(a2) * len;
  return `M${cx},${cy} L${x1},${y1} A${len},${len} 0 0,1 ${x2},${y2} Z`;
}

function linePoints(aoe) {
  const len = (aoe.length / METERS_PER_CELL) * CELL;
  const half = ((aoe.width / METERS_PER_CELL) * CELL) / 2;
  const rot = aoe.rotation * (Math.PI / 180);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  const cx = (aoe.x + 0.5) * CELL;
  const cy = (aoe.y + 0.5) * CELL;
  // Four corners of the rectangle
  const corners = [
    [0,  -half],
    [len, -half],
    [len,  half],
    [0,   half],
  ].map(([lx, ly]) => [cx + lx * cos - ly * sin, cy + lx * sin + ly * cos]);
  return corners.map((c, i) => `${i === 0 ? 'M' : 'L'}${c[0]},${c[1]}`).join(' ') + ' Z';
}

function squareRect(aoe) {
  const half = ((aoe.radius / METERS_PER_CELL) * CELL) / 2;
  const cx = (aoe.x + 0.5) * CELL;
  const cy = (aoe.y + 0.5) * CELL;
  return { x: cx - half, y: cy - half, w: half * 2, h: half * 2 };
}

function labelCenter(aoe) {
  const cx = (aoe.x + 0.5) * CELL;
  const cy = (aoe.y + 0.5) * CELL;
  if (aoe.shape === 'cone' || aoe.shape === 'line') {
    const len = (aoe.length / METERS_PER_CELL) * CELL * 0.5;
    const rot = aoe.rotation * (Math.PI / 180);
    return { x: cx + Math.cos(rot) * len, y: cy + Math.sin(rot) * len };
  }
  return { x: cx, y: cy };
}

// ── AoE layer (rendered inside transform layer) ───────────────────────────────

export function AoeLayer({ aoes, aoePreview, tokens, COLS, ROWS, onUpdateAoe, onRemoveAoe }) {
  const [dragging, setDragging] = useState(null); // { id, ox, oy }
  const svgRef = useRef(null);

  const affected = aoes.flatMap(aoe => getAffectedTokens(aoe, tokens).map(t => t.id));
  const affectedSet = new Set(affected);

  const handleAoeMouseDown = useCallback((e, aoe) => {
    if (aoe.locked || e.button !== 0) return;
    e.stopPropagation();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging({ id: aoe.id, startX: e.clientX, startY: e.clientY, origX: aoe.x, origY: aoe.y });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = Math.round((e.clientX - dragging.startX) / CELL);
      const dy = Math.round((e.clientY - dragging.startY) / CELL);
      onUpdateAoe(dragging.id, {
        x: Math.max(0, Math.min(COLS - 1, dragging.origX + dx)),
        y: Math.max(0, Math.min(ROWS - 1, dragging.origY + dy)),
      });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, onUpdateAoe, COLS, ROWS]);

  const handleWheel = useCallback((e, aoe) => {
    if (aoe.locked) return;
    e.stopPropagation();
    const delta = e.deltaY < 0 ? -15 : 15;
    onUpdateAoe(aoe.id, { rotation: ((aoe.rotation + delta) % 360 + 360) % 360 });
  }, [onUpdateAoe]);

  const handleContextMenu = useCallback((e, aoe) => {
    e.preventDefault();
    e.stopPropagation();
    const items = [
      { label: aoe.locked ? '🔓 Desbloquear' : '🔒 Travar', action: () => onUpdateAoe(aoe.id, { locked: !aoe.locked }) },
      { label: 'Renomear', action: () => {
        const t = window.prompt('Rótulo:', aoe.label ?? '');
        if (t !== null) onUpdateAoe(aoe.id, { label: t });
      }},
      { label: '🗑 Remover', action: () => onRemoveAoe(aoe.id), danger: true },
    ];
    // Simple inline context menu via custom event
    const evt = new CustomEvent('aoe-ctx', { detail: { x: e.clientX, y: e.clientY, items } });
    window.dispatchEvent(evt);
  }, [onUpdateAoe, onRemoveAoe]);

  const renderShape = (aoe, isPreview = false) => {
    const fill = aoe.color;
    const fillOp = isPreview ? 0.15 : (aoe.opacity ?? 0.2);
    const strokeOp = isPreview ? 0.5 : 0.6;
    const strokeW = 2;
    const strokeDash = '6 4';
    const common = {
      fill, fillOpacity: fillOp,
      stroke: fill, strokeWidth: strokeW,
      strokeDasharray: strokeDash,
      strokeOpacity: strokeOp,
      cursor: aoe.locked ? 'default' : 'grab',
      style: { pointerEvents: isPreview ? 'none' : 'all' },
      onMouseDown: isPreview ? undefined : (e) => handleAoeMouseDown(e, aoe),
      onWheel: isPreview ? undefined : (e) => handleWheel(e, aoe),
      onContextMenu: isPreview ? undefined : (e) => handleContextMenu(e, aoe),
    };

    if (aoe.shape === 'circle') {
      const { cx, cy, r } = circleProps(aoe);
      return <circle key={aoe.id} cx={cx} cy={cy} r={r} {...common} />;
    }
    if (aoe.shape === 'cone') {
      return <path key={aoe.id} d={conePoints(aoe)} {...common} />;
    }
    if (aoe.shape === 'line') {
      return <path key={aoe.id} d={linePoints(aoe)} {...common} />;
    }
    if (aoe.shape === 'square') {
      const { x, y, w, h } = squareRect(aoe);
      return <rect key={aoe.id} x={x} y={y} width={w} height={h} {...common} />;
    }
    return null;
  };

  const renderLabel = (aoe, isPreview = false) => {
    if (!aoe.label) return null;
    const { x, y } = labelCenter(aoe);
    const targetCount = isPreview ? 0 : getAffectedTokens(aoe, tokens).length;
    const text = isPreview ? aoe.label : (aoe.label ? `${aoe.label} (${targetCount})` : `${targetCount} alvos`);
    return (
      <g key={`lbl-${aoe.id}`} style={{ pointerEvents: 'none' }}>
        <rect x={x - 30} y={y - 10} width={60} height={14} rx={3} fill="rgba(10,10,16,0.75)" />
        <text x={x} y={y} fill={aoe.color} fontSize="10" textAnchor="middle" dominantBaseline="central"
          fontWeight="700" fontFamily="system-ui">{text}</text>
      </g>
    );
  };

  const renderTargetCount = (aoe) => {
    if (aoe.label) return null; // label already shows count
    const count = getAffectedTokens(aoe, tokens).length;
    if (count === 0) return null;
    const { x, y } = labelCenter(aoe);
    return (
      <g key={`cnt-${aoe.id}`} style={{ pointerEvents: 'none' }}>
        <rect x={x - 22} y={y - 9} width={44} height={14} rx={3} fill="rgba(10,10,16,0.75)" />
        <text x={x} y={y} fill={aoe.color} fontSize="10" textAnchor="middle" dominantBaseline="central"
          fontWeight="700" fontFamily="system-ui">{count} alvos</text>
      </g>
    );
  };

  return (
    <>
      {/* Token highlight ring for affected tokens */}
      <svg
        ref={svgRef}
        width={COLS * CELL} height={ROWS * CELL}
        style={{ position: 'absolute', inset: 0, zIndex: 27, overflow: 'visible', pointerEvents: 'none' }}
      >
        {tokens.filter(t => affectedSet.has(t.id)).map(t => (
          <circle key={`hi-${t.id}`}
            cx={(t.x + 0.5) * CELL} cy={(t.y + 0.5) * CELL}
            r={CELL * 0.52}
            fill="none" stroke="#e05555" strokeWidth="2.5" strokeDasharray="4 3"
            opacity="0.8"
          />
        ))}
      </svg>

      {/* AoE shapes */}
      <svg
        width={COLS * CELL} height={ROWS * CELL}
        style={{ position: 'absolute', inset: 0, zIndex: 28, overflow: 'visible' }}
        onContextMenu={e => e.preventDefault()}
      >
        {aoes.map(aoe => (
          <g key={aoe.id}>
            {renderShape(aoe)}
            {renderLabel(aoe)}
            {renderTargetCount(aoe)}
          </g>
        ))}
        {aoePreview && (
          <g>
            {renderShape(aoePreview, true)}
            {renderLabel(aoePreview, true)}
          </g>
        )}
      </svg>
    </>
  );
}

// ── Toolbar dropdown ──────────────────────────────────────────────────────────

export default function AoeToolbar({ tool, setTool, aoes, addAoe, updateAoe, removeAoe, aoeConfig, setAoeConfig, tokens, screenToGrid, COLS, ROWS }) {
  const [open, setOpen] = useState(false);
  const [customPresets, setCustomPresets] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]'); } catch { return []; }
  });

  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const isActive = tool === 'aoe';

  const applyPreset = (p) => {
    setAoeConfig(prev => ({
      ...prev,
      shape: p.shape ?? prev.shape,
      radius: p.radius ?? prev.radius,
      length: p.length ?? prev.length,
      width:  p.width  ?? prev.width,
      angle:  p.angle  ?? prev.angle,
      color:  p.color  ?? prev.color,
    }));
  };

  const saveCustomPreset = () => {
    const name = window.prompt('Nome do preset:', aoeConfig.label || 'Meu Preset');
    if (!name) return;
    const preset = { ...aoeConfig, label: name };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    try { localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); } catch {}
  };

  const placeAoe = () => {
    const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
    addAoe(makeAoe({ ...aoeConfig, x: cx, y: cy }));
    setTool('select');
    setOpen(false);
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        className={`tbtn${isActive ? ' active' : ''}`}
        onClick={() => { setTool(t => t === 'aoe' ? 'select' : 'aoe'); setOpen(o => !o); }}
        title="Área de Efeito (A)"
      >
        ✨ AoE
      </button>

      {(open || isActive) && (
        <div
          style={{
            position: 'absolute', bottom: '100%', left: 0, zIndex: 500,
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 6, padding: 10, width: 270,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.65)',
            marginBottom: 4,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {/* Presets */}
          <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Predefinições
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {allPresets.map((p, i) => (
              <button key={i} className="tbtn" style={{ fontSize: 10, padding: '2px 7px' }}
                onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
            <button className="tbtn" style={{ fontSize: 10, padding: '2px 7px' }} onClick={saveCustomPreset}>+ Salvar</button>
          </div>

          {/* Shape selector */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {['circle','cone','line','square'].map(s => (
              <button key={s} className={`tbtn${aoeConfig.shape === s ? ' active' : ''}`}
                style={{ flex: 1, fontSize: 10, padding: '3px 4px' }}
                onClick={() => setAoeConfig(prev => ({ ...prev, shape: s }))}>
                {s === 'circle' ? '⬤' : s === 'cone' ? '◣' : s === 'line' ? '▬' : '■'}
                <span style={{ display: 'block', fontSize: 8 }}>{s}</span>
              </button>
            ))}
          </div>

          {/* Size inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {(aoeConfig.shape === 'circle' || aoeConfig.shape === 'square') && (
              <label style={{ gridColumn: '1/-1' }}>
                <span className="vtt-label">{aoeConfig.shape === 'circle' ? 'Raio (m)' : 'Lado (m)'}</span>
                <input type="number" className="vtt-input" min="1.5" max="60" step="1.5"
                  value={aoeConfig.radius}
                  onChange={e => setAoeConfig(prev => ({ ...prev, radius: +e.target.value }))} />
              </label>
            )}
            {(aoeConfig.shape === 'cone' || aoeConfig.shape === 'line') && (<>
              <label>
                <span className="vtt-label">Comprimento (m)</span>
                <input type="number" className="vtt-input" min="1.5" max="60" step="1.5"
                  value={aoeConfig.length}
                  onChange={e => setAoeConfig(prev => ({ ...prev, length: +e.target.value }))} />
              </label>
              {aoeConfig.shape === 'line' ? (
                <label>
                  <span className="vtt-label">Largura (m)</span>
                  <input type="number" className="vtt-input" min="1.5" max="30" step="1.5"
                    value={aoeConfig.width}
                    onChange={e => setAoeConfig(prev => ({ ...prev, width: +e.target.value }))} />
                </label>
              ) : (
                <label>
                  <span className="vtt-label">Ângulo (°)</span>
                  <input type="number" className="vtt-input" min="10" max="360" step="5"
                    value={aoeConfig.angle}
                    onChange={e => setAoeConfig(prev => ({ ...prev, angle: +e.target.value }))} />
                </label>
              )}
            </>)}
          </div>

          {/* Label input */}
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span className="vtt-label">Rótulo</span>
            <input type="text" className="vtt-input"
              value={aoeConfig.label}
              onChange={e => setAoeConfig(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Bola de Fogo…" />
          </label>

          {/* Color presets */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 8, alignItems: 'center' }}>
            <span className="vtt-label" style={{ marginBottom: 0 }}>Cor</span>
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setAoeConfig(prev => ({ ...prev, color: c }))}
                style={{
                  width: 18, height: 18, borderRadius: 3, background: c, border: 'none',
                  cursor: 'pointer', padding: 0, flexShrink: 0,
                  outline: aoeConfig.color === c ? '2px solid white' : '2px solid transparent',
                  outlineOffset: 1,
                }} />
            ))}
            <input type="color" value={aoeConfig.color}
              onChange={e => setAoeConfig(prev => ({ ...prev, color: e.target.value }))}
              style={{ width: 22, height: 22, cursor: 'pointer', padding: 0, border: 'none', background: 'none' }}
              title="Cor personalizada" />
          </div>

          {/* Place button */}
          <button className="tbtn active" style={{ width: '100%', fontSize: 11 }} onClick={placeAoe}>
            Colocar AoE
          </button>
        </div>
      )}
    </div>
  );
}
