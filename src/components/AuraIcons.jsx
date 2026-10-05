import { AURA_GROUPS } from '../utils/sheetBridge';
import { auraArea } from '../utils/rpgData';

export default function AuraIcons({ activeAura, style }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', ...style }}>
      {AURA_GROUPS.map(ag => {
        // O token guarda o nome da aura (ex.: "Fogo") ou da Área; acende a Área correspondente
        const active = activeAura
          ? activeAura.toLowerCase().includes(ag.n.toLowerCase())
            || activeAura.split('/').some(n => auraArea(n.trim()) === ag.n)
          : false;
        return (
          <div
            key={ag.n}
            title={ag.n}
            style={{
              display: 'flex', alignItems: 'center', gap: 3,
              padding: '2px 6px', borderRadius: 3,
              background: active ? `${ag.c}22` : 'transparent',
              border: `1px solid ${active ? ag.c : 'var(--border)'}`,
              color: active ? ag.c : 'var(--sub)',
              fontSize: 11, transition: 'all 0.15s', cursor: 'default',
            }}
          >
            <span>{ag.i}</span>
            <span style={{ fontSize: 10 }}>{ag.n}</span>
          </div>
        );
      })}
    </div>
  );
}
