import { useState } from 'react';
import { rollDice, parseDiceNotation } from '../utils/dice';
import { CONDITIONS, CONDITION_META } from '../utils/constants';

export function makeEffect(overrides = {}) {
  return {
    id: `ae-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: '',
    icon: '✨',
    color: '#c9a96e',
    duration: 3,
    maxDuration: 3,
    roundApplied: 1,
    description: '',
    damagePerRound: '',
    healPerRound: '',
    isConcentration: false,
    source: 'Mestre',
    ...overrides,
  };
}

// ── EffectBadges: tiny badges for combat tracker ───────────────────────────
export function EffectBadges({ effects = [] }) {
  if (!effects.length) return null;
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0, flexWrap: 'wrap', maxWidth: 60 }}>
      {effects.slice(0, 4).map(e => (
        <span key={e.id} title={`${e.name}${e.duration !== null ? ` — ${e.duration} round${e.duration !== 1 ? 's' : ''}` : ' (perm.)'}${e.description ? '\n' + e.description : ''}`}
          style={{ fontSize: 10, cursor: 'default', userSelect: 'none' }}>
          {e.icon}{e.duration !== null && e.duration !== undefined && (
            <span style={{ fontSize: 7, color: 'var(--sub)', verticalAlign: 'super' }}>{e.duration}</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── EffectList: full list in TokenDetails ─────────────────────────────────
export function EffectList({ token, onAddEffect, onUpdateEffect, onRemoveEffect, isGM, currentRound }) {
  const [showAdd, setShowAdd] = useState(false);
  const effects = token.activeEffects ?? [];

  if (!isGM && effects.length === 0) return null;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--gold-dim)', marginBottom: 6,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>⏳ Efeitos Ativos</span>
        {isGM && (
          <button className="tbtn" style={{ fontSize: 10, padding: '1px 6px' }}
            onClick={() => setShowAdd(v => !v)}>
            {showAdd ? '–' : '+ Efeito'}
          </button>
        )}
      </div>

      {effects.length === 0 && !showAdd && (
        <div style={{ fontSize: 10, color: 'var(--sub)' }}>Nenhum efeito ativo.</div>
      )}

      {effects.map(e => (
        <div key={e.id} style={{
          background: 'var(--card)', border: `1px solid ${e.color}44`,
          borderLeft: `3px solid ${e.color}`, borderRadius: 4,
          padding: '5px 8px', marginBottom: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>{e.icon}</span>
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{e.name}</span>
            {e.duration !== null && e.duration !== undefined && (
              <span style={{ fontSize: 11, color: e.duration <= 1 ? '#c43030' : 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                {e.duration}/{e.maxDuration}
              </span>
            )}
            {e.duration === null && <span style={{ fontSize: 10, color: 'var(--sub)' }}>Perm.</span>}
            {isGM && (
              <button style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}
                onClick={() => onRemoveEffect?.(token.id, e.id)}>✕</button>
            )}
          </div>
          {e.description && (
            <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 3, paddingLeft: 20 }}>{e.description}</div>
          )}
          {(e.damagePerRound || e.healPerRound) && (
            <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 2, paddingLeft: 20 }}>
              {e.damagePerRound && `💥 ${e.damagePerRound}/round`}
              {e.healPerRound   && `💚 ${e.healPerRound}/round`}
              {e.isConcentration && ' · Concentração'}
            </div>
          )}
          {isGM && e.duration !== null && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4, paddingLeft: 20 }}>
              <button className="tbtn" style={{ fontSize: 9, padding: '1px 5px' }}
                onClick={() => onUpdateEffect?.(token.id, e.id, { duration: Math.max(0, (e.duration ?? 0) - 1) })}>–1</button>
              <button className="tbtn" style={{ fontSize: 9, padding: '1px 5px' }}
                onClick={() => onUpdateEffect?.(token.id, e.id, { duration: (e.duration ?? 0) + 1 })}>+1</button>
            </div>
          )}
        </div>
      ))}

      {showAdd && isGM && (
        <ApplyEffectForm
          token={token}
          currentRound={currentRound}
          onApply={(eff) => { onAddEffect?.(token.id, eff); setShowAdd(false); }}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

// ── ApplyEffectForm: inline form to add an effect ─────────────────────────
export function ApplyEffectForm({ token, currentRound, onApply, onCancel }) {
  const conditionIcons = { Queimando: '🔥', Envenenado: '💚', Atordoado: '💫', Paralisado: '⚡',
    Cego: '👁', Amedrontado: '😱', Congelado: '❄', Bençoado: '✨', Amaldiçoado: '🌑', Invisível: '🌫' };

  const [draft, setDraft] = useState({
    name: '', icon: '✨', color: '#c9a96e',
    duration: 3, permanent: false,
    damagePerRound: '', healPerRound: '',
    description: '', isConcentration: false,
    source: 'Mestre',
  });

  const allConditions = [...CONDITIONS.slice(0, 10), ...Object.keys(conditionIcons)].filter((v, i, a) => a.indexOf(v) === i);

  function apply() {
    const eff = makeEffect({
      ...draft,
      name: draft.name.trim() || 'Efeito',
      duration: draft.permanent ? null : draft.duration,
      maxDuration: draft.permanent ? null : draft.duration,
      roundApplied: currentRound ?? 1,
    });
    onApply(eff);
  }

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 6, padding: 10, marginTop: 8,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
        Adicionar Efeito a {token.name}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 2 }}>
          <div className="vtt-label">Condição</div>
          <select className="vtt-select" value={draft.name}
            onChange={e => {
              const n = e.target.value;
              const meta = CONDITION_META.find(m => m.name === n);
              setDraft(p => ({
                ...p, name: n,
                icon: meta?.icon ?? (conditionIcons[n] ?? '✨'),
                color: meta?.color ?? '#c9a96e',
              }));
            }}
            style={{ width: '100%', fontSize: 11 }}>
            <option value="">— Selecionar —</option>
            {allConditions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="vtt-input" value={draft.name}
            onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
            placeholder="Ou escreva um nome..." style={{ width: '100%', marginTop: 4, fontSize: 11 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="vtt-label">Ícone</div>
          <input className="vtt-input" value={draft.icon}
            onChange={e => setDraft(p => ({ ...p, icon: e.target.value }))}
            style={{ width: 40, textAlign: 'center', fontSize: 14 }} />
          <input type="color" value={draft.color}
            onChange={e => setDraft(p => ({ ...p, color: e.target.value }))}
            style={{ width: 40, height: 26, padding: 2, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <div className="vtt-label">Duração (rounds)</div>
          <input className="vtt-input" type="number" min="1" max="99" value={draft.duration}
            disabled={draft.permanent}
            onChange={e => setDraft(p => ({ ...p, duration: Math.max(1, +e.target.value) }))}
            style={{ width: '100%', fontSize: 11 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', paddingBottom: 4 }}>
          <input type="checkbox" checked={draft.permanent}
            onChange={e => setDraft(p => ({ ...p, permanent: e.target.checked }))} />
          Permanente
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div>
          <div className="vtt-label">Dano/round</div>
          <input className="vtt-input" value={draft.damagePerRound}
            onChange={e => setDraft(p => ({ ...p, damagePerRound: e.target.value }))}
            placeholder="1d4" style={{ width: '100%', fontSize: 11 }} />
        </div>
        <div>
          <div className="vtt-label">Cura/round</div>
          <input className="vtt-input" value={draft.healPerRound}
            onChange={e => setDraft(p => ({ ...p, healPerRound: e.target.value }))}
            placeholder="1d6" style={{ width: '100%', fontSize: 11 }} />
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        <div className="vtt-label">Descrição</div>
        <input className="vtt-input" value={draft.description}
          onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
          placeholder="Efeito do dano/cura por turno..." style={{ width: '100%', fontSize: 11 }} />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={draft.isConcentration}
          onChange={e => setDraft(p => ({ ...p, isConcentration: e.target.checked }))} />
        Requer Concentração
      </label>

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="tbtn" onClick={onCancel} style={{ flex: 1, fontSize: 11 }}>Cancelar</button>
        <button className="tbtn" onClick={apply}
          style={{ flex: 2, fontSize: 11, background: 'rgba(201,169,110,0.15)', borderColor: 'var(--gold)' }}>
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ── processEffectsOnTurnStart: run when a token's turn starts ─────────────
export function processEffectsOnTurnStart(token, { adjustHp, updateToken, addLog, addChatMessage, playSfx }) {
  const effects = token.activeEffects ?? [];
  if (!effects.length) return;

  const remaining = [];
  for (const eff of effects) {
    // Damage per round
    if (eff.damagePerRound?.trim()) {
      const p = parseDiceNotation(eff.damagePerRound.trim());
      if (p) {
        const r = rollDice(p.count, p.sides, p.modifier);
        adjustHp?.(token.id, -r.total);
        const msg = `${eff.icon} ${eff.name} em ${token.name}: ${eff.damagePerRound} = ${r.total} dano (HP: ${Math.max(0, token.hp - r.total)}/${token.maxHp})`;
        addLog?.(msg, 'damage');
        addChatMessage?.({ id: Date.now(), type: 'system', sender: 'Sistema', timestamp: Date.now(), text: msg });
      }
    }
    // Heal per round
    if (eff.healPerRound?.trim()) {
      const p = parseDiceNotation(eff.healPerRound.trim());
      if (p) {
        const r = rollDice(p.count, p.sides, p.modifier);
        adjustHp?.(token.id, r.total);
        const msg = `${eff.icon} ${eff.name} em ${token.name}: ${eff.healPerRound} = ${r.total} cura`;
        addLog?.(msg, 'heal');
      }
    }
    // Decrement duration
    if (eff.duration === null) {
      remaining.push(eff); // permanent
    } else if (eff.duration > 1) {
      remaining.push({ ...eff, duration: eff.duration - 1 });
    } else {
      // expired
      const msg = `⏳ ${eff.name} em ${token.name} expirou!`;
      addLog?.(msg, 'system');
      addChatMessage?.({ id: Date.now() + 1, type: 'system', sender: 'Sistema', timestamp: Date.now(), text: msg });
      playSfx?.('conditionRemove');
    }
  }

  updateToken?.(token.id, { activeEffects: remaining });
}
