import { useState, useRef } from 'react';

function hpColor(hp, max) {
  const p = max > 0 ? hp / max : 0;
  return p > 0.5 ? '#4a9a5a' : p > 0.25 ? '#c4a030' : '#c43030';
}

export default function PartyStatsOverlay({ partyOrder, tokens, selectedId, onSelectToken, onClose }) {
  const [pos, setPos] = useState({ x: 60, y: 80 });
  const dragRef = useRef(null);

  const partyTokens = partyOrder
    .map(id => tokens.find(t => t.id === id))
    .filter(Boolean);

  const onHeaderMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX - pos.x;
    const startY = e.clientY - pos.y;
    dragRef.current = { startX, startY };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      setPos({ x: ev.clientX - dragRef.current.startX, y: ev.clientY - dragRef.current.startY });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const COLS = '1fr 96px 72px 36px 88px';

  return (
    <div style={{
      position: 'fixed',
      left: pos.x, top: pos.y,
      zIndex: 300,
      background: 'rgba(10,10,16,0.97)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
      minWidth: 360,
      userSelect: 'none',
    }}>
      {/* Header / drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex', alignItems: 'center', padding: '7px 12px',
          borderBottom: '1px solid var(--border)', cursor: 'move',
        }}
      >
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--gold-dim)', flex: 1,
        }}>
          ⚔ Grupo de Aventureiros
        </span>
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--sub)',
            cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: COLS, gap: 4,
        padding: '4px 12px 5px',
        borderBottom: '1px solid var(--border)',
        fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--gold-dim)',
      }}>
        <span>Nome</span>
        <span>HP</span>
        <span>MP</span>
        <span style={{ textAlign: 'center' }}>CA</span>
        <span>Condições</span>
      </div>

      {/* Rows */}
      <div style={{ padding: '4px 0' }}>
        {partyTokens.length === 0 ? (
          <div style={{ padding: '12px', fontSize: 11, color: 'var(--sub)', textAlign: 'center' }}>
            Nenhum membro no grupo. Marque tokens como membros em Detalhes.
          </div>
        ) : partyTokens.map(token => {
          const isSelected = token.id === selectedId;
          const isDead     = token.hp <= 0;
          const hpPct      = token.maxHp > 0 ? token.hp / token.maxHp : 0;
          const mpPct      = token.maxMp > 0 ? token.mp / token.maxMp : 0;
          const hpCol      = hpColor(token.hp, token.maxHp);

          return (
            <div
              key={token.id}
              onClick={() => onSelectToken(token)}
              style={{
                display: 'grid', gridTemplateColumns: COLS, gap: 4,
                padding: '5px 12px',
                cursor: 'pointer',
                background: isSelected ? 'rgba(201,169,110,0.07)' : 'transparent',
                borderLeft: `2px solid ${isSelected ? 'var(--gold)' : 'transparent'}`,
                alignItems: 'center',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {/* Name */}
              <span style={{
                fontSize: 11,
                color: isDead ? '#e05555' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {isDead ? '💀 ' : ''}{token.name}
              </span>

              {/* HP */}
              <div>
                <div style={{
                  fontSize: 10, color: hpCol,
                  fontVariantNumeric: 'tabular-nums', marginBottom: 2,
                }}>
                  {token.hp}/{token.maxHp}
                </div>
                <div style={{ height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${hpPct * 100}%`, height: '100%',
                    background: hpCol, borderRadius: 2,
                    transition: 'width 0.25s',
                  }} />
                </div>
              </div>

              {/* MP */}
              <div>
                <div style={{
                  fontSize: 10, color: '#3468c4',
                  fontVariantNumeric: 'tabular-nums', marginBottom: 2,
                }}>
                  {token.mp}/{token.maxMp}
                </div>
                <div style={{ height: 3, background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    width: `${mpPct * 100}%`, height: '100%',
                    background: '#3468c4', borderRadius: 2,
                    transition: 'width 0.25s',
                  }} />
                </div>
              </div>

              {/* AC */}
              <span style={{ fontSize: 11, color: 'var(--sub)', textAlign: 'center' }}>
                {token.ac}
              </span>

              {/* Conditions */}
              <span style={{
                fontSize: 10, color: 'var(--sub)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {token.conditions.length > 0 ? token.conditions.join(', ') : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: '4px 12px 7px',
        fontSize: 9, color: 'var(--sub)',
        borderTop: partyTokens.length > 0 ? '1px solid var(--border)' : 'none',
      }}>
        P · Esc — fechar &nbsp;|&nbsp; Clique na linha para selecionar
      </div>
    </div>
  );
}
