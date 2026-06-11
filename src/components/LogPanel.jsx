import { useEffect, useRef } from 'react';

const CAT_BORDER = {
  dice:      '#c9a96e',
  damage:    '#e05555',
  heal:      '#4a9a5a',
  condition: '#8a4abd',
  system:    '#3a3a4e',
};

export default function LogPanel({ log = [], onClear }) {
  const topRef = useRef(null);

  // Scroll to top when a new entry arrives
  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [log.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Entry list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Invisible anchor at the top for auto-scroll */}
        <div ref={topRef} />

        {log.length === 0 ? (
          <div style={{
            padding: 20, textAlign: 'center',
            color: 'var(--sub)', fontSize: 12,
          }}>
            Nenhum evento registrado ainda.
          </div>
        ) : log.map(entry => (
          <div
            key={entry.id}
            style={{
              display: 'flex', gap: 0, alignItems: 'stretch',
              borderBottom: '1px solid rgba(42,42,58,0.4)',
            }}
          >
            {/* Colored category bar */}
            <div style={{
              width: 3, flexShrink: 0,
              background: CAT_BORDER[entry.category] ?? CAT_BORDER.system,
            }} />

            <div style={{
              display: 'flex', gap: 7, alignItems: 'flex-start',
              padding: '5px 10px 5px 8px', flex: 1,
            }}>
              <span style={{
                flexShrink: 0, fontSize: 10,
                color: 'var(--sub)', opacity: 0.65,
                marginTop: 1, fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}>
                {entry.time}
              </span>
              <span style={{
                fontSize: 11, lineHeight: 1.5,
                color: 'var(--text)',
                wordBreak: 'break-word',
              }}>
                {entry.text}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer: legend + clear button */}
      <div style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        padding: '8px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Color legend */}
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          {Object.entries(CAT_BORDER).map(([cat, color]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <div style={{
                width: 6, height: 6, borderRadius: 1,
                background: color, flexShrink: 0,
              }} />
              <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'capitalize' }}>
                {cat === 'dice' ? 'dados' :
                 cat === 'damage' ? 'dano' :
                 cat === 'heal' ? 'cura' :
                 cat === 'condition' ? 'cond.' : 'sistema'}
              </span>
            </div>
          ))}
        </div>

        <button
          className="tbtn"
          onClick={onClear}
          style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
        >
          Limpar Log
        </button>
      </div>
    </div>
  );
}
