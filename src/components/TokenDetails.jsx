import { useRef, useState } from 'react';
import { RACES, PROFESSIONS, CONDITIONS, CONDITION_META, COLORS } from '../utils/constants';
import { useRole } from '../hooks/useRole';
import { resizeImage } from '../utils/imageUtils';
import { EffectList } from './ActiveEffects';

const ATTRS = ['FOR', 'DEX', 'CON', 'INT', 'SAB', 'CAR', 'DOM'];

function modifier(value) {
  const m = Math.floor((value - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label className="vtt-label">{label}</label>
      {children}
    </div>
  );
}

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(1, value / max) * 100 : 0;
  return (
    <div style={{
      height: 4, background: 'var(--border)',
      borderRadius: 2, overflow: 'hidden', marginTop: 4,
    }}>
      <div style={{
        width: `${pct}%`, height: '100%',
        background: color, borderRadius: 2,
        transition: 'width 0.2s',
      }} />
    </div>
  );
}

export default function TokenDetails({ token, onUpdate, isMember, partyFull, onToggleParty, readOnly, onOpenSheet, customConditions = [], combatActive, addLog, playSfx, onAddEffect, onUpdateEffect, onRemoveEffect, currentRound }) {
  const imgInputRef = useRef(null);
  const [showCondPicker, setShowCondPicker] = useState(false);
  const { isGM, players } = useRole();

  const set = (field) => (e) => onUpdate(token.id, { [field]: e.target.value });
  const setNum = (field, min = 0, max = 9999) => (e) => {
    const v = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || 0));
    onUpdate(token.id, { [field]: v });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 128);
    onUpdate(token.id, { image: dataUrl });
    e.target.value = '';
  };

  const removeCondition = (cond) => {
    onUpdate(token.id, { conditions: token.conditions.filter(c => c !== cond) });
  };

  const addCondition = (cond) => {
    if (!token.conditions.includes(cond))
      onUpdate(token.id, { conditions: [...token.conditions, cond] });
    setShowCondPicker(false);
  };

  const allCondMeta = [
    ...CONDITION_META,
    ...customConditions.map(c => ({ ...c })),
  ];
  const allCondNames = [...CONDITIONS, ...customConditions.map(c => c.name)];
  const available = allCondNames.filter(c => !token.conditions.includes(c));
  const getMeta = (name) => allCondMeta.find(m => m.name === name);

  return (
    <div style={{ padding: '10px 12px 16px', pointerEvents: readOnly ? 'none' : undefined, opacity: readOnly ? 0.75 : undefined }}>

      {readOnly && (
        <div style={{
          marginBottom: 8, padding: '4px 8px', borderRadius: 4,
          background: 'rgba(201,169,110,0.08)', border: '1px solid var(--border)',
          fontSize: 10, color: 'var(--sub)', textAlign: 'center',
        }}>
          🔒 Apenas leitura
        </div>
      )}

      {/* Token image + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
        <div
          onClick={() => imgInputRef.current?.click()}
          style={{
            width: 64, height: 64, borderRadius: '50%',
            border: `3px solid ${token.color}`,
            background: token.image
              ? `url(${token.image}) center/cover`
              : 'radial-gradient(circle at 35% 35%, #252538, #111120)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
            boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
          title="Clique para alterar imagem"
        >
          {!token.image && (
            <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>
              {token.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
        <button
          className="tbtn"
          style={{ marginTop: 6, fontSize: 10, padding: '3px 10px' }}
          onClick={() => imgInputRef.current?.click()}
        >
          {token.image ? 'Trocar Imagem' : 'Adicionar Imagem'}
        </button>
        {token.image && (
          <button
            className="tbtn"
            style={{ marginTop: 3, fontSize: 10, padding: '3px 10px' }}
            onClick={() => onUpdate(token.id, { image: null })}
          >
            Remover Imagem
          </button>
        )}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
      </div>

      {/* Name */}
      <Field label="Nome">
        <input
          className="vtt-input"
          value={token.name}
          onChange={set('name')}
        />
      </Field>

      {/* Type / Race / Profession in a row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div>
          <label className="vtt-label">Tipo</label>
          <select className="vtt-select" value={token.type} onChange={set('type')}>
            <option value="player">Jogador</option>
            <option value="npc">NPC</option>
            <option value="ally">Aliado</option>
          </select>
        </div>
        <div>
          <label className="vtt-label">Raça</label>
          <select className="vtt-select" value={token.race} onChange={set('race')}>
            {RACES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="vtt-label">Nível</label>
          <input
            className="vtt-input"
            type="number" min={1} max={15}
            value={token.level}
            onChange={setNum('level', 1, 15)}
          />
        </div>
      </div>

      <Field label="Profissão">
        <select className="vtt-select" value={token.profession} onChange={set('profession')}>
          {PROFESSIONS.map(p => <option key={p}>{p}</option>)}
        </select>
      </Field>

      {/* HP */}
      <div style={{ marginBottom: 10 }}>
        <label className="vtt-label">Pontos de Vida (HP)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, alignItems: 'center' }}>
          <input className="vtt-input" type="number" min={0} max={token.maxHp}
            value={token.hp} onChange={setNum('hp', 0, token.maxHp)} />
          <span style={{ color: 'var(--sub)', fontSize: 11, textAlign: 'center' }}>/</span>
          <input className="vtt-input" type="number" min={1}
            value={token.maxHp} onChange={setNum('maxHp', 1)} />
        </div>
        <ProgressBar value={token.hp} max={token.maxHp} color={COLORS.hp} />
      </div>

      {/* MP */}
      <div style={{ marginBottom: 10 }}>
        <label className="vtt-label">Pontos de Mana (MP)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 4, alignItems: 'center' }}>
          <input className="vtt-input" type="number" min={0} max={token.maxMp}
            value={token.mp} onChange={setNum('mp', 0, token.maxMp)} />
          <span style={{ color: 'var(--sub)', fontSize: 11, textAlign: 'center' }}>/</span>
          <input className="vtt-input" type="number" min={0}
            value={token.maxMp} onChange={setNum('maxMp', 0)} />
        </div>
        <ProgressBar value={token.mp} max={token.maxMp} color={COLORS.mp} />
      </div>

      {/* Rest buttons — own token or GM, not during combat */}
      {!readOnly && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            className="tbtn"
            disabled={!!combatActive}
            title={combatActive ? 'Não é possível descansar durante combate' : 'Recupera 50% do MP máximo'}
            onClick={() => {
              if (!window.confirm('Descanso Curto: Recupera 50% do MP máximo. Confirmar?')) return;
              const recovered = Math.ceil(token.maxMp * 0.5);
              const newMp = Math.min(token.maxMp, (token.mp ?? 0) + recovered);
              const gain = newMp - (token.mp ?? 0);
              onUpdate(token.id, { mp: newMp });
              addLog?.(`☕ ${token.name} fez um descanso curto. MP: ${token.mp} → ${newMp}${gain > 0 ? ` (+${gain})` : ''}`, 'heal');
              playSfx?.('heal');
            }}
            style={{ flex: 1, fontSize: 11, opacity: combatActive ? 0.4 : 1 }}
          >☕ Curto</button>
          <button
            className="tbtn"
            disabled={!!combatActive}
            title={combatActive ? 'Não é possível descansar durante combate' : 'Recupera HP e MP totalmente'}
            onClick={() => {
              if (!window.confirm('Descanso Longo: Recupera todo HP e MP, remove 1 nível de exaustão. Confirmar?')) return;
              const exLevels = ['Exaustão 1','Exaustão 2','Exaustão 3','Exaustão 4','Exaustão 5'];
              const exIdx = exLevels.findIndex(c => (token.conditions ?? []).includes(c));
              const newConds = (token.conditions ?? []).filter(c => !exLevels.includes(c));
              if (exIdx > 0) newConds.push(exLevels[exIdx - 1]);
              onUpdate(token.id, { hp: token.maxHp, mp: token.maxMp, conditions: newConds });
              addLog?.(`🛏 ${token.name} fez um descanso longo. HP e MP totalmente recuperados.`, 'heal');
              playSfx?.('heal');
            }}
            style={{ flex: 1, fontSize: 11, opacity: combatActive ? 0.4 : 1 }}
          >🛏 Longo</button>
        </div>
      )}

      {/* CA + Movement */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <div>
          <label className="vtt-label">Classe de Armadura</label>
          <input className="vtt-input" type="number" min={1}
            value={token.ac} onChange={setNum('ac', 1)} />
        </div>
        <div>
          <label className="vtt-label">Movimento (m)</label>
          <input className="vtt-input" type="number" min={0} step={1.5}
            value={token.movement} onChange={setNum('movement', 0)} />
        </div>
      </div>

      {/* Attributes */}
      <div style={{ marginBottom: 10 }}>
        <label className="vtt-label" style={{ marginBottom: 6 }}>Atributos</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {ATTRS.slice(0, 4).map(attr => (
            <AttrCell key={attr} attr={attr} value={token.attributes[attr]}
              onChange={v => onUpdate(token.id, { attributes: { ...token.attributes, [attr]: v } })} />
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginTop: 4 }}>
          {ATTRS.slice(4).map(attr => (
            <AttrCell key={attr} attr={attr} value={token.attributes[attr]}
              onChange={v => onUpdate(token.id, { attributes: { ...token.attributes, [attr]: v } })} />
          ))}
        </div>
      </div>

      {/* Aura */}
      <Field label="Aura">
        <input className="vtt-input" value={token.aura} onChange={set('aura')}
          placeholder="Ex: Fogo, Gravitacional…" />
      </Field>

      {/* Conditions */}
      <div style={{ marginBottom: 10 }}>
        <label className="vtt-label">Condições</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
          {token.conditions.map(cond => {
            const meta = getMeta(cond);
            return (
              <button
                key={cond}
                className="cond-chip"
                onClick={() => removeCondition(cond)}
                title={meta?.description ?? 'Clique para remover'}
                style={meta ? { borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}18` } : undefined}
              >
                {meta?.icon ? `${meta.icon} ` : ''}{cond} ✕
              </button>
            );
          })}
          <div style={{ position: 'relative' }}>
            <button
              className="tbtn"
              style={{ fontSize: 10, padding: '2px 8px' }}
              onClick={() => setShowCondPicker(p => !p)}
            >
              + Condição
            </button>
            {showCondPicker && available.length > 0 && (() => {
              const defaultAvail = CONDITIONS.filter(c => !token.conditions.includes(c));
              const customAvail = customConditions.filter(c => !token.conditions.includes(c.name));
              return (
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, zIndex: 50,
                  background: 'var(--panel)', border: '1px solid var(--border)',
                  borderRadius: 4, padding: '4px 0', minWidth: 160,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                  maxHeight: 200, overflowY: 'auto',
                }}>
                  {defaultAvail.map(c => {
                    const meta = getMeta(c);
                    return (
                      <button
                        key={c}
                        onClick={() => addCondition(c)}
                        style={{
                          display: 'block', width: '100%', background: 'none',
                          border: 'none', color: meta?.color ?? 'var(--text)', padding: '5px 12px',
                          textAlign: 'left', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                      >
                        {meta?.icon ? `${meta.icon} ` : ''}{c}
                      </button>
                    );
                  })}
                  {customAvail.length > 0 && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      {customAvail.map(c => (
                        <button
                          key={c.name}
                          onClick={() => addCondition(c.name)}
                          style={{
                            display: 'block', width: '100%', background: 'none',
                            border: 'none', color: c.color, padding: '5px 12px',
                            textAlign: 'left', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                        >
                          {c.icon ? `${c.icon} ` : ''}{c.name}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Ownership — GM only */}
      {isGM && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 6 }}>
            🔑 Controle
          </div>
          <Field label="Controlado por:">
            <select
              className="vtt-select"
              value={token.owner ?? 'gm'}
              onChange={e => {
                onUpdate(token.id, { owner: e.target.value });
                if (e.target.value !== 'gm') {
                  // auto-make visible when assigned to a player
                  onUpdate(token.id, { visibleToAll: true, hidden: false });
                }
              }}
            >
              <option value="gm">Mestre</option>
              {players.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={token.visibleToAll !== false}
                onChange={e => onUpdate(token.id, { visibleToAll: e.target.checked })}
                style={{ cursor: 'pointer', accentColor: 'var(--gold)' }}
              />
              <span style={{ color: token.visibleToAll !== false ? 'var(--text)' : 'var(--sub)' }}>
                Visível para todos
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!token.hidden}
                onChange={e => onUpdate(token.id, {
                  hidden: e.target.checked,
                  visibleToAll: e.target.checked ? false : token.visibleToAll,
                })}
                style={{ cursor: 'pointer', accentColor: '#e05555' }}
              />
              <span style={{ color: token.hidden ? '#e05555' : 'var(--sub)' }}>
                Oculto (só Mestre vê)
              </span>
            </label>
          </div>
          {isGM && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', marginTop: 4,
              background: token.canPhaseWalls ? 'rgba(168,85,247,0.1)' : 'transparent',
              border: token.canPhaseWalls ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
              borderRadius: 4,
            }}>
              <input
                type="checkbox"
                checked={!!token.canPhaseWalls}
                onChange={e => onUpdate(token.id, { canPhaseWalls: e.target.checked })}
                style={{ accentColor: '#a855f7' }}
              />
              <label style={{ fontSize: 11, color: token.canPhaseWalls ? '#a855f7' : 'var(--sub)', cursor: 'pointer' }}>
                👻 Atravessa Paredes
              </label>
            </div>
          )}
        </div>
      )}

      {/* Lighting */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 6 }}>
          💡 Iluminação
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="vtt-label" style={{ marginBottom: 0 }}>Luz brilhante (m)</span>
            <input type="number" className="vtt-input" min="0" max="60" step="1.5"
              value={token.lightBright ?? 0}
              onChange={e => onUpdate(token.id, { lightBright: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="vtt-label" style={{ marginBottom: 0 }}>Luz fraca (m)</span>
            <input type="number" className="vtt-input" min="0" max="60" step="1.5"
              value={token.lightDim ?? 0}
              onChange={e => onUpdate(token.id, { lightDim: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="vtt-label" style={{ marginBottom: 0 }}>Alcance de visão (m)</span>
            <input type="number" className="vtt-input" min="0" max="90" step="1.5"
              value={token.visionRange ?? 18}
              onChange={e => onUpdate(token.id, { visionRange: Math.max(0, parseFloat(e.target.value) || 0) })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="vtt-label" style={{ marginBottom: 0 }}>Cor da luz</span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {['#ffd700','#ff9944','#ffffff','#88ddff','#ff4466'].map(c => (
                <button key={c} onClick={() => onUpdate(token.id, { lightColor: c })}
                  style={{
                    width: 20, height: 20, borderRadius: 3, background: c, border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                    outline: (token.lightColor ?? '#ffd700') === c ? '2px solid white' : '2px solid transparent', outlineOffset: 1,
                  }} />
              ))}
              <input type="color" value={token.lightColor ?? '#ffd700'}
                onChange={e => onUpdate(token.id, { lightColor: e.target.value })}
                style={{ width: 22, height: 22, cursor: 'pointer', padding: 0, border: 'none', background: 'none', flexShrink: 0 }} />
            </div>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" id={`dv-${token.id}`}
            checked={!!token.darkvision}
            onChange={e => onUpdate(token.id, { darkvision: e.target.checked })}
            style={{ cursor: 'pointer', accentColor: 'var(--gold)' }} />
          <label htmlFor={`dv-${token.id}`} style={{ fontSize: 11, cursor: 'pointer', color: token.darkvision ? 'var(--gold)' : 'var(--text)' }}>
            Visão no escuro
          </label>
        </div>

        {/* Angular vision */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 5 }}>
            👁 Visão Angular
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="vtt-label" style={{ marginBottom: 0 }}>Ângulo (°)</span>
              <input type="number" className="vtt-input" min="10" max="360" step="10"
                value={token.visionAngle ?? 360}
                onChange={e => onUpdate(token.id, { visionAngle: Math.min(360, Math.max(10, +e.target.value || 360)) })} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="vtt-label" style={{ marginBottom: 0 }}>Direção (°)</span>
              <input type="number" className="vtt-input" min="0" max="359" step="5"
                value={Math.round(token.facingAngle ?? 0)}
                onChange={e => onUpdate(token.id, { facingAngle: ((+e.target.value % 360) + 360) % 360 })} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {[['Normal',360],['Humana',120],['Estreita',60],['Lateral',180]].map(([label, angle]) => (
              <button key={angle} className={`tbtn${(token.visionAngle ?? 360) === angle ? ' active' : ''}`}
                style={{ fontSize: 9, padding: '2px 6px' }}
                onClick={() => onUpdate(token.id, { visionAngle: angle })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Effects */}
      <EffectList
        token={token}
        onAddEffect={onAddEffect}
        onUpdateEffect={onUpdateEffect}
        onRemoveEffect={onRemoveEffect}
        isGM={isGM}
        currentRound={currentRound}
      />

      {/* Notes */}
      <Field label="Notas">
        <textarea
          className="vtt-input"
          rows={3}
          style={{ resize: 'vertical', lineHeight: 1.5 }}
          value={token.notes}
          onChange={set('notes')}
          placeholder="Anotações sobre o personagem…"
        />
      </Field>

      {/* Open character sheet */}
      {onOpenSheet && (
        <button
          className="tbtn"
          onClick={onOpenSheet}
          style={{ width: '100%', marginBottom: 8, fontSize: 11 }}
        >
          📋 Abrir Ficha
        </button>
      )}

      {/* Party membership */}
      {onToggleParty && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 8px', marginTop: 2,
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 4,
        }}>
          <input
            type="checkbox"
            id={`party-${token.id}`}
            checked={!!isMember}
            disabled={!isMember && partyFull}
            onChange={e => onToggleParty(token.id, e.target.checked)}
            style={{ cursor: !isMember && partyFull ? 'not-allowed' : 'pointer', accentColor: 'var(--gold)' }}
          />
          <label
            htmlFor={`party-${token.id}`}
            style={{
              fontSize: 11, color: isMember ? 'var(--gold)' : 'var(--text)',
              cursor: !isMember && partyFull ? 'not-allowed' : 'pointer', flex: 1,
            }}
          >
            ☑ Membro do Grupo
          </label>
          {!isMember && partyFull && (
            <span style={{ fontSize: 10, color: 'var(--sub)' }}>máx. 6</span>
          )}
        </div>
      )}
    </div>
  );
}

function AttrCell({ attr, value, onChange }) {
  const mod = modifier(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {attr}
      </span>
      <input
        className="vtt-input"
        type="number"
        min={1} max={30}
        value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 10)))}
        style={{ width: '100%', textAlign: 'center', padding: '3px 2px' }}
      />
      <span style={{ fontSize: 9, color: 'var(--gold-dim)' }}>{mod}</span>
    </div>
  );
}
