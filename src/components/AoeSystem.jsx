import { useState, useEffect } from 'react';
import { GRID } from '../utils/constants';
import { makeAoe, getAffectedTokens } from '../hooks/useAoe';
import { useRole } from '../hooks/useRole';

const CELL = GRID.cellSize;
const M = 1.5; // meters per cell

// ── Aura → default technique config ──────────────────────────────────────────
function auraConfig(auraText) {
  if (!auraText) return null;
  const a = auraText.toLowerCase();
  if (a.includes('fogo') || a.includes('chama'))  return { color: '#ff6030', shape: 'cone' };
  if (a.includes('água') || a.includes('agua') || a.includes('gelo')) return { color: '#3a6abf', shape: 'cone' };
  if (a.includes('terra') || a.includes('pedra')) return { color: '#8a6a40', shape: 'cone' };
  if (a.includes('vento') || a.includes('relâmp') || a.includes('relamp') || a.includes('raio')) return { color: '#c8c8ff', shape: 'cone' };
  if (a.includes('veneno') || a.includes('toxina')) return { color: '#4db870', shape: 'circle' };
  if (a.includes('sombri') || a.includes('trevas')) return { color: '#8a40c0', shape: 'circle' };
  if (a.includes('divin') || a.includes('sagrad') || a.includes('celest')) return { color: '#ffe050', shape: 'circle' };
  if (a.includes('caóti') || a.includes('caoti')) return { color: '#ff8c40', shape: 'circle' };
  return { color: '#c9a96e', shape: 'circle' };
}

const GENERIC_TECHNIQUES = [
  { label: 'Projetar',           shape: 'line',   length: 10, width: 1.5, angle: 90, radius: 9,  color: '#e05555' },
  { label: 'Manifestar',         shape: 'circle', length: 10, width: 1.5, angle: 90, radius: 4.5, color: '#3a6abf' },
  { label: 'Expansão de Domínio', shape: 'circle', length: 10, width: 1.5, angle: 90, radius: 15, color: '#8a4abd' },
];

const COLOR_DOTS = ['#e05555', '#3a6abf', '#4db870', '#8a4abd', '#c9a96e', '#ff8c40', '#c8c8ff'];

// ── SVG shape builders ────────────────────────────────────────────────────────
function buildShapePath(aoe, preview = false) {
  const { shape, originX, originY, targetX, targetY, radius, length, width, angle, color } = aoe;
  const ox = (originX + 0.5) * CELL, oy = (originY + 0.5) * CELL;
  const tx = (targetX + 0.5) * CELL, ty = (targetY + 0.5) * CELL;
  const dx = tx - ox, dy = ty - oy;
  const aimAngle = Math.atan2(dy, dx);

  const fillOp   = preview ? 0.15 : 0.2;
  const strokeOp = preview ? 0.5  : 0.6;
  const common = {
    fill: color, fillOpacity: fillOp,
    stroke: color, strokeWidth: 2, strokeDasharray: '6 4', strokeOpacity: strokeOp,
    pointerEvents: preview ? 'none' : 'all',
  };

  if (shape === 'circle') {
    const r = (radius / M) * CELL;
    return <circle cx={tx} cy={ty} r={r} {...common} />;
  }
  if (shape === 'square') {
    const half = ((radius / M) * CELL) / 2;
    return <rect x={tx - half} y={ty - half} width={half * 2} height={half * 2} {...common} />;
  }
  if (shape === 'cone') {
    const len = (length / M) * CELL;
    const half = (angle / 2) * (Math.PI / 180);
    const a1 = aimAngle - half, a2 = aimAngle + half;
    const x1 = ox + Math.cos(a1) * len, y1 = oy + Math.sin(a1) * len;
    const x2 = ox + Math.cos(a2) * len, y2 = oy + Math.sin(a2) * len;
    const largeArc = angle > 180 ? 1 : 0;
    return <path d={`M${ox},${oy} L${x1},${y1} A${len},${len} 0 ${largeArc},1 ${x2},${y2} Z`} {...common} />;
  }
  if (shape === 'line') {
    const len = (length / M) * CELL;
    const halfW = ((width / M) * CELL) / 2;
    const cos = Math.cos(aimAngle), sin = Math.sin(aimAngle);
    const perp = aimAngle + Math.PI / 2;
    const pc = Math.cos(perp), ps = Math.sin(perp);
    const pts = [
      [ox + pc * halfW, oy + ps * halfW],
      [ox + cos * len + pc * halfW, oy + sin * len + ps * halfW],
      [ox + cos * len - pc * halfW, oy + sin * len - ps * halfW],
      [ox - pc * halfW, oy - ps * halfW],
    ];
    return <path d={pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z'} {...common} />;
  }
  return null;
}

function labelCenter(aoe) {
  const tx = (aoe.targetX + 0.5) * CELL, ty = (aoe.targetY + 0.5) * CELL;
  if (aoe.shape === 'cone' || aoe.shape === 'line') {
    const ox = (aoe.originX + 0.5) * CELL, oy = (aoe.originY + 0.5) * CELL;
    return { x: (ox + tx) / 2, y: (oy + ty) / 2 };
  }
  return { x: tx, y: ty };
}

// ── AoeMapLayer — rendered inside MapCanvas transform layer ───────────────────
export function AoeMapLayer({ aoes, aimingMode, aimingCursor, tokens, COLS, ROWS, onRemoveAoe, onUpdateAoe, onClearAllAoes }) {
  const { isGM, playerName } = useRole();
  const [hoveredId, setHoveredId] = useState(null);

  const canRemoveAoe = (aoe) => {
    if (isGM) return true;
    return tokens.some(t => t.owner === playerName && t.id === aoe.casterId);
  };

  // Delete key removes the hovered AoE (if permitted)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Delete') return;
      if (!hoveredId) return;
      const aoe = aoes.find(a => a.id === hoveredId);
      if (!aoe) return;
      const allowed = isGM || tokens.some(t => t.owner === playerName && t.id === aoe.casterId);
      if (allowed) { onRemoveAoe(aoe.id); setHoveredId(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredId, aoes, isGM, playerName, tokens, onRemoveAoe]);

  // Build preview AoE object from aiming state + cursor
  let previewAoe = null;
  if (aimingMode && aimingCursor && aimingMode.sourceToken) {
    const src = aimingMode.sourceToken;
    previewAoe = makeAoe({
      casterId: src.id,
      shape: aimingMode.shape,
      originX: src.x, originY: src.y,
      targetX: aimingCursor.col, targetY: aimingCursor.row,
      radius: aimingMode.radius,
      length: aimingMode.length,
      width:  aimingMode.width,
      angle:  aimingMode.angle,
      color:  aimingMode.color,
      label:  aimingMode.label,
    });
  }

  // Tokens inside preview
  const previewAffected = previewAoe ? getAffectedTokens(previewAoe, tokens) : [];

  // Tokens inside placed AoEs
  const placedAffectedIds = new Set(
    aoes.flatMap(aoe => getAffectedTokens(aoe, tokens).map(t => t.id))
  );

  const handleCtx = (e, aoe) => {
    e.preventDefault();
    e.stopPropagation();
    const items = [];
    if (canRemoveAoe(aoe)) {
      items.push({
        label: isGM ? '🗑 Remover Esta Área' : '🗑 Remover Minha Área',
        action: () => onRemoveAoe(aoe.id),
        danger: true,
      });
    }
    if (isGM && onClearAllAoes) {
      if (items.length > 0) items.push('sep');
      items.push({ label: '🗑 Remover Todas as Áreas', action: onClearAllAoes, danger: true });
    }
    if (items.length > 0) {
      window.dispatchEvent(new CustomEvent('aoe-ctx', { detail: { x: e.clientX, y: e.clientY, items } }));
    }
  };

  // Distance label helper
  const distLabel = (aoe) => {
    if (!aoe) return null;
    if (aoe.shape === 'circle' || aoe.shape === 'square') {
      const ox = (aoe.originX + 0.5) * CELL, oy = (aoe.originY + 0.5) * CELL;
      const tx = (aoe.targetX + 0.5) * CELL, ty = (aoe.targetY + 0.5) * CELL;
      const distM = Math.sqrt((aoe.targetX - aoe.originX) ** 2 + (aoe.targetY - aoe.originY) ** 2) * M;
      const mx = (ox + tx) / 2, my = (oy + ty) / 2;
      return { ox, oy, tx, ty, mx, my, distM };
    }
    return null;
  };

  return (
    <>
      {/* ── Token highlight rings for placed AoEs ── */}
      <svg width={COLS * CELL} height={ROWS * CELL}
        style={{ position: 'absolute', inset: 0, zIndex: 27, overflow: 'visible', pointerEvents: 'none' }}>
        {tokens.filter(t => placedAffectedIds.has(t.id)).map(t => (
          <circle key={`placed-hi-${t.id}`}
            cx={(t.x + 0.5) * CELL} cy={(t.y + 0.5) * CELL} r={CELL * 0.52}
            fill="none" stroke="#e05555" strokeWidth="2" strokeDasharray="4 3"
            opacity="0.8" style={{ animation: 'auraPulse 2s ease-in-out infinite' }}
          />
        ))}
        {/* Preview target rings */}
        {previewAffected.map(t => (
          <circle key={`preview-hi-${t.id}`}
            cx={(t.x + 0.5) * CELL} cy={(t.y + 0.5) * CELL} r={CELL * 0.55}
            fill="none"
            stroke={aimingMode?.color ?? '#e05555'}
            strokeWidth="2.5" strokeDasharray="5 3" opacity="0.9"
          />
        ))}
      </svg>

      {/* ── Placed AoE shapes ── */}
      <svg width={COLS * CELL} height={ROWS * CELL}
        style={{ position: 'absolute', inset: 0, zIndex: 28, overflow: 'visible' }}
        onContextMenu={e => e.preventDefault()}>
        {aoes.map(aoe => {
          const lc = labelCenter(aoe);
          const count = getAffectedTokens(aoe, tokens).length;
          const labelText = aoe.label
            ? `${aoe.label}${count > 0 ? ` (${count})` : ''}`
            : count > 0 ? `${count} alvo${count !== 1 ? 's' : ''}` : null;
          const isHovered = hoveredId === aoe.id;
          const canRemove = canRemoveAoe(aoe);
          return (
            <g key={aoe.id}
              onContextMenu={e => handleCtx(e, aoe)}
              onMouseEnter={() => setHoveredId(aoe.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: canRemove ? 'pointer' : 'default' }}>
              {buildShapePath(aoe)}
              {/* Origin dot (caster position) */}
              <circle
                cx={(aoe.originX + 0.5) * CELL} cy={(aoe.originY + 0.5) * CELL}
                r={5} fill={aoe.color} fillOpacity={0.7} pointerEvents="none"
              />
              {/* Label */}
              {labelText && (
                <g pointerEvents="none">
                  <rect x={lc.x - 32} y={lc.y - 9} width={64} height={14} rx={3}
                    fill="rgba(10,10,16,0.8)" />
                  <text x={lc.x} y={lc.y} fill={aoe.color} fontSize="10"
                    textAnchor="middle" dominantBaseline="central"
                    fontWeight="700" fontFamily="system-ui">{labelText}</text>
                </g>
              )}
              {/* ✕ remove button — visible on hover, only if permitted */}
              {isHovered && canRemove && (
                <g onClick={e => { e.stopPropagation(); onRemoveAoe(aoe.id); }} style={{ cursor: 'pointer' }}>
                  <circle cx={lc.x + 32} cy={lc.y - 16} r={9} fill="rgba(180,35,35,0.92)" />
                  <text x={lc.x + 32} y={lc.y - 16} fill="#fff" fontSize="11"
                    textAnchor="middle" dominantBaseline="central"
                    fontWeight="700" fontFamily="system-ui" pointerEvents="none">✕</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Aiming preview ── */}
        {previewAoe && (() => {
          const dl = distLabel(previewAoe);
          const ox = (previewAoe.originX + 0.5) * CELL, oy = (previewAoe.originY + 0.5) * CELL;
          const tx = (previewAoe.targetX + 0.5) * CELL, ty = (previewAoe.targetY + 0.5) * CELL;
          const count = previewAffected.length;
          const color = previewAoe.color;
          return (
            <g pointerEvents="none">
              {/* Origin → target dashed line */}
              {dl && (
                <>
                  <line x1={ox} y1={oy} x2={tx} y2={ty}
                    stroke={color} strokeWidth="1.5" strokeDasharray="5 4" strokeOpacity="0.5" />
                  <rect x={dl.mx - 22} y={dl.my - 9} width={44} height={14} rx={3} fill="rgba(10,10,16,0.8)" />
                  <text x={dl.mx} y={dl.my} fill={color} fontSize="10" textAnchor="middle"
                    dominantBaseline="central" fontWeight="700" fontFamily="system-ui">
                    {dl.distM.toFixed(1)}m
                  </text>
                </>
              )}
              {/* Shape */}
              {buildShapePath(previewAoe, true)}
              {/* Origin marker */}
              <circle cx={ox} cy={oy} r={4} fill={color} fillOpacity={0.6} />
              {/* Target count */}
              {count > 0 && (() => {
                const lc = labelCenter(previewAoe);
                return (
                  <>
                    <rect x={lc.x - 34} y={lc.y - 9} width={68} height={14} rx={3} fill="rgba(10,10,16,0.85)" />
                    <text x={lc.x} y={lc.y} fill={color} fontSize="10" textAnchor="middle"
                      dominantBaseline="central" fontWeight="700" fontFamily="system-ui">
                      {count} alvo{count !== 1 ? 's' : ''} na área
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })()}
      </svg>
    </>
  );
}

// ── ActionBar — floating overlay when a token is selected ─────────────────────
export default function ActionBar({
  selectedToken,
  tokens,
  aoes,
  addAoe,
  aimingMode,
  setAimingMode,
  addChatMessage,
  addLog,
  playSfx,
  showTechniqueMenu,
  setShowTechniqueMenu,
  currentRound,
  setTargetingMode,
  targetingMode,
}) {
  const [techConfig, setTechConfig] = useState({
    shape: 'circle', radius: 9, length: 10, width: 1.5, angle: 90,
    color: '#e05555', label: '',
  });

  if (!selectedToken) return null;

  const auraConf = auraConfig(selectedToken.aura);
  const auraButton = auraConf && selectedToken.aura ? {
    label: `Aura: ${selectedToken.aura}`,
    ...techConfig,
    shape: auraConf.shape,
    color: auraConf.color,
    length: 10, width: 1.5, angle: 90, radius: 9,
  } : null;

  const handleLaunch = () => {
    setShowTechniqueMenu(false);
    setAimingMode({
      sourceToken: selectedToken,
      ...techConfig,
    });
  };

  const applyPreset = (p) => {
    setTechConfig(prev => ({ ...prev, ...p }));
  };

  const handleAttack = () => {
    setTargetingMode(v => !v);
    setShowTechniqueMenu(false);
  };

  const handleProtect = () => {
    setShowTechniqueMenu(false);
    const sab = selectedToken.attributes?.SAB ?? 10;
    const mod = Math.floor((sab - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    const total = roll + mod;
    const isCrit = roll === 20;
    const sign = mod >= 0 ? `+${mod}` : `${mod}`;
    addChatMessage({
      id: Date.now(),
      type: 'dice',
      sender: selectedToken.name,
      text: `🛡 ${selectedToken.name} tenta proteger: [${roll}]${mod !== 0 ? sign : ''} = **${total}**${isCrit ? ' ✨ Crítico!' : ''}`,
      diceResult: { total, rolls: [roll], expr: `1d20${mod !== 0 ? sign : ''}`, isCrit, isFail: roll === 1 },
      timestamp: Date.now(),
    });
    playSfx?.('dice');
  };

  const btnStyle = (active) => ({
    background: active ? 'rgba(201,169,110,0.15)' : 'rgba(18,18,28,0.92)',
    border: `1px solid ${active ? 'var(--gold)' : 'var(--border)'}`,
    color: active ? 'var(--gold)' : 'var(--text)',
    padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
    whiteSpace: 'nowrap', flexShrink: 0,
    transition: 'border-color 0.12s, color 0.12s, background 0.12s',
  });

  return (
    <div style={{
      position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
      zIndex: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      pointerEvents: 'none',
    }}>
      {/* ── Technique submenu ── */}
      {showTechniqueMenu && (
        <div
          style={{
            background: 'rgba(18,18,28,0.97)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '12px 14px', width: 300,
            boxShadow: '0 -4px 24px rgba(0,0,0,0.7)',
            pointerEvents: 'all',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <div style={{ color: 'var(--gold)', fontSize: 12, fontWeight: 700, marginBottom: 8, textAlign: 'center' }}>
            ✨ Técnicas de {selectedToken.name}
          </div>

          {/* Generic presets */}
          <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Genéricas
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {GENERIC_TECHNIQUES.map(t => (
              <button key={t.label} onClick={() => applyPreset(t)}
                style={{
                  ...btnStyle(techConfig.label === t.label),
                  padding: '3px 9px', fontSize: 11,
                }}>
                {t.label}
              </button>
            ))}
            {auraButton && (
              <button onClick={() => applyPreset(auraButton)}
                style={{ ...btnStyle(false), padding: '3px 9px', fontSize: 11, borderColor: auraButton.color, color: auraButton.color }}>
                🌟 {auraButton.label}
              </button>
            )}
          </div>

          {/* Shape selector */}
          <div style={{ fontSize: 9, color: 'var(--gold-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            Forma
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            {[
              { id: 'circle', icon: '○', label: 'Círculo' },
              { id: 'cone',   icon: '△', label: 'Cone'   },
              { id: 'line',   icon: '▬', label: 'Linha'  },
              { id: 'square', icon: '□', label: 'Cubo'   },
            ].map(s => (
              <button key={s.id}
                onClick={() => setTechConfig(prev => ({ ...prev, shape: s.id }))}
                style={{ ...btnStyle(techConfig.shape === s.id), flex: 1, padding: '4px 4px', fontSize: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 14 }}>{s.icon}</div>
                <div style={{ fontSize: 9 }}>{s.label}</div>
              </button>
            ))}
          </div>

          {/* Size inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            {(techConfig.shape === 'circle' || techConfig.shape === 'square') && (
              <label style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {techConfig.shape === 'circle' ? 'Raio (m)' : 'Lado (m)'}
                </span>
                <input type="number" min="1.5" max="60" step="1.5"
                  value={techConfig.radius}
                  onChange={e => setTechConfig(prev => ({ ...prev, radius: +e.target.value }))}
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 3, fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
              </label>
            )}
            {(techConfig.shape === 'cone' || techConfig.shape === 'line') && (<>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comprimento (m)</span>
                <input type="number" min="1.5" max="60" step="1.5"
                  value={techConfig.length}
                  onChange={e => setTechConfig(prev => ({ ...prev, length: +e.target.value }))}
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 3, fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
              </label>
              {techConfig.shape === 'line' ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Largura (m)</span>
                  <input type="number" min="1.5" max="30" step="1.5"
                    value={techConfig.width}
                    onChange={e => setTechConfig(prev => ({ ...prev, width: +e.target.value }))}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 3, fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
                </label>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ângulo (°)</span>
                  <input type="number" min="10" max="360" step="5"
                    value={techConfig.angle}
                    onChange={e => setTechConfig(prev => ({ ...prev, angle: +e.target.value }))}
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 3, fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
                </label>
              )}
            </>)}
          </div>

          {/* Label */}
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 }}>
            <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rótulo</span>
            <input type="text" placeholder="Nome da técnica…"
              value={techConfig.label}
              onChange={e => setTechConfig(prev => ({ ...prev, label: e.target.value }))}
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 3, fontSize: 12, width: '100%', fontFamily: 'inherit' }} />
          </label>

          {/* Color */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cor</span>
            {COLOR_DOTS.map(c => (
              <button key={c} onClick={() => setTechConfig(prev => ({ ...prev, color: c }))}
                style={{
                  width: 18, height: 18, borderRadius: 3, background: c, border: 'none', cursor: 'pointer', padding: 0,
                  outline: techConfig.color === c ? '2px solid white' : '2px solid transparent', outlineOffset: 1,
                }} />
            ))}
            <input type="color" value={techConfig.color}
              onChange={e => setTechConfig(prev => ({ ...prev, color: e.target.value }))}
              style={{ width: 22, height: 22, cursor: 'pointer', padding: 0, border: 'none', background: 'none' }} />
          </div>

          <button onClick={handleLaunch}
            style={{
              width: '100%', background: 'rgba(201,169,110,0.15)', border: '1px solid var(--gold)',
              color: 'var(--gold)', padding: '7px 0', borderRadius: 6, cursor: 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            }}>
            ✨ Lançar Técnica
          </button>
        </div>
      )}

      {/* ── Action bar buttons ── */}
      <div
        style={{
          display: 'flex', gap: 4,
          background: 'rgba(18,18,28,0.92)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '5px 8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.65)',
          pointerEvents: 'all',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        <button
          style={btnStyle(targetingMode)}
          onClick={handleAttack}
          title="Atacar (Q)"
        >⚔ Atacar</button>
        <button
          style={btnStyle(false)}
          onClick={handleProtect}
          title="Proteger (E)"
        >🛡 Proteger</button>
        <button
          style={btnStyle(showTechniqueMenu || !!aimingMode)}
          onClick={() => { setShowTechniqueMenu(v => !v); }}
          title="Técnica (R)"
        >✨ Técnica</button>
        <button
          style={{ ...btnStyle(false), color: 'var(--sub)' }}
          title="Mover — use WASD ou arraste o token"
          onClick={() => {}}
        >🏃 Mover</button>
      </div>
    </div>
  );
}
