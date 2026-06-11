import { useState } from 'react';

function hpColor(hp, max) {
  const p = max > 0 ? hp / max : 0;
  return p > 0.5 ? '#4a9a5a' : p > 0.25 ? '#c4a030' : '#c43030';
}

export default function PartyPanel({
  partyOrder,
  tokens,
  selectedId,
  combatTurnTokenId,
  onSelectToken,
  onReorder,
  sharedGold = 0,
  setSharedGold = null,
  onDivideGold,
  onShortRest,
  onLongRest,
}) {
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  const partyTokens = partyOrder
    .map(id => tokens.find(t => t.id === id))
    .filter(Boolean);

  if (partyTokens.length === 0) return null;

  const handleDragStart = (e, id) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (id !== draggingId) setDragOverId(id);
  };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) { endDrag(); return; }
    const next = [...partyOrder];
    const from = next.indexOf(draggingId);
    const to   = next.indexOf(targetId);
    if (from === -1 || to === -1) { endDrag(); return; }
    next.splice(from, 1);
    next.splice(to, 0, draggingId);
    onReorder(next);
    endDrag();
  };
  const endDrag = () => { setDraggingId(null); setDragOverId(null); };

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '8px 12px 6px',
      background: 'rgba(201,169,110,0.025)',
      flexShrink: 0,
    }}>
      {/* Portrait row */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', overflowX: 'auto' }}>
        {partyTokens.map(token => {
          const isDead     = token.hp <= 0;
          const isCurrent  = token.id === combatTurnTokenId;
          const isSelected = token.id === selectedId;
          const hpPct      = token.maxHp > 0 ? token.hp / token.maxHp : 0;
          const mpPct      = token.maxMp > 0 ? token.mp / token.maxMp : 0;
          const isDragOver = dragOverId === token.id;
          const tooltip    = [
            token.name,
            `HP: ${token.hp}/${token.maxHp}`,
            `MP: ${token.mp}/${token.maxMp}`,
            `CA: ${token.ac}`,
            token.conditions.length > 0 ? token.conditions.join(', ') : null,
          ].filter(Boolean).join(' | ');

          return (
            <div
              key={token.id}
              draggable
              onDragStart={e => handleDragStart(e, token.id)}
              onDragOver={e => handleDragOver(e, token.id)}
              onDrop={e => handleDrop(e, token.id)}
              onDragEnd={endDrag}
              onClick={() => onSelectToken(token)}
              title={tooltip}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                cursor: 'pointer', flexShrink: 0, position: 'relative',
                opacity: draggingId === token.id ? 0.4 : 1,
                outline: isDragOver ? '2px dashed var(--gold)' : 'none',
                borderRadius: 4, padding: '2px',
              }}
            >
              {/* Portrait circle */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2px solid ${isSelected ? 'var(--gold)' : token.color}`,
                  background: token.image
                    ? `url(${token.image}) center/cover`
                    : 'radial-gradient(circle at 35% 35%, #252538, #111120)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden',
                  filter: isDead ? 'grayscale(1) brightness(0.45)' : 'none',
                  animation: isCurrent ? 'combatPulse 1.5s ease-in-out infinite' : 'none',
                  boxShadow: isCurrent
                    ? '0 0 0 2px var(--gold)'
                    : isSelected
                    ? '0 0 0 2px rgba(201,169,110,0.5)'
                    : 'none',
                  flexShrink: 0,
                }}>
                  {!token.image && (
                    <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, pointerEvents: 'none' }}>
                      {token.name.substring(0, 2).toUpperCase()}
                    </span>
                  )}
                  {isDead && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                    }}>💀</div>
                  )}
                </div>

                {/* Condition dots (corner) */}
                {token.conditions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: -1, right: -1,
                    display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: 14,
                  }}>
                    {token.conditions.slice(0, 3).map((_, i) => (
                      <div key={i} style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'rgba(201,169,110,0.9)',
                        border: '1px solid rgba(10,10,16,0.8)',
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* HP bar */}
              <div style={{ width: 32, height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${hpPct * 100}%`, height: '100%',
                  background: hpColor(token.hp, token.maxHp),
                  transition: 'width 0.25s',
                }} />
              </div>

              {/* MP bar */}
              <div style={{ width: 32, height: 2, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: `${mpPct * 100}%`, height: '100%',
                  background: '#3468c4',
                  transition: 'width 0.25s',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Controls row: rest + gold */}
      <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
        <button
          className="tbtn"
          onClick={onShortRest}
          title="Descanso Curto — recupera 50% de MP do grupo"
          style={{ fontSize: 10, padding: '2px 7px' }}
        >
          💤 Curto
        </button>
        <button
          className="tbtn"
          onClick={onLongRest}
          title="Descanso Longo — restaura HP/MP totais e reduz Exaustão"
          style={{ fontSize: 10, padding: '2px 7px' }}
        >
          🌙 Longo
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 10, color: 'var(--gold-dim)', flexShrink: 0 }}>💰</span>
        <input
          type="number"
          className="vtt-input"
          value={sharedGold}
          min={0}
          readOnly={!setSharedGold}
          onChange={e => setSharedGold && setSharedGold(parseInt(e.target.value, 10) || 0)}
          onKeyDown={e => e.stopPropagation()}
          style={{ width: 52, fontSize: 10, padding: '2px 4px', textAlign: 'center', opacity: setSharedGold ? 1 : 0.6 }}
          title="Tesouro do Grupo (CO)"
        />
        <button
          className="tbtn"
          onClick={onDivideGold}
          title="Dividir ouro igualmente entre os membros"
          style={{ fontSize: 10, padding: '2px 7px' }}
        >
          ÷
        </button>
      </div>
    </div>
  );
}
