import { useState } from 'react';
import { rollDice } from '../utils/dice';
import { CONDITIONS } from '../utils/constants';
import TurnTimer, { TurnTimerSettings } from './TurnTimer';
import { EffectBadges } from './ActiveEffects';

function hpColor(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct > 0.5) return '#4a9a5a';
  if (pct > 0.25) return '#c4a030';
  return '#c43030';
}

function rollInitiative(token) {
  const dex = token.attributes?.DEX ?? 10;
  const mod = Math.floor((dex - 10) / 2);
  return rollDice(3, 8, mod).total;
}

export default function CombatTracker({
  tokenState,
  combatActive, setCombatActive,
  currentRound, setCurrentRound,
  currentTurnIndex, setCurrentTurnIndex,
  initiativeOrder, setInitiativeOrder,
  advanceTurn,
  addLog,
  playSfx,
  isGM = true,
  timerEnabled, setTimerEnabled,
  timerDuration, setTimerDuration,
  timerSoundEnabled, setTimerSoundEnabled,
}) {
  const { tokens, selectedId, setSelectedId, adjustHp, updateToken } = tokenState;
  const [damageVal, setDamageVal] = useState('');
  const [healVal,   setHealVal]   = useState('');
  const [condPick,  setCondPick]  = useState(CONDITIONS[0]);

  const selectedToken = tokens.find(t => t.id === selectedId) ?? null;

  // Build display rows: keep original order but attach live token data
  const displayRows = initiativeOrder
    .map((item, origIdx) => ({ ...item, origIdx, token: tokens.find(t => t.id === item.tokenId) }))
    .filter(row => row.token != null);

  // ── Combat control ────────────────────────────────────────────────────────

  function startCombat() {
    if (tokens.length === 0) return;
    const order = tokens
      .map(t => ({ tokenId: t.id, initiative: rollInitiative(t) }))
      .sort((a, b) => b.initiative - a.initiative);
    setInitiativeOrder(order);
    setCombatActive(true);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
    addLog('⚔ Combate iniciado! Round 1');
    addLog(order.map(({ tokenId, initiative }) => {
      const t = tokens.find(tk => tk.id === tokenId);
      return `${t?.name ?? '?'}: ${initiative}`;
    }).join(' | '));
    playSfx?.('combatStart');
  }

  function endCombat() {
    if (!window.confirm('Encerrar o combate?')) return;
    addLog(`⚔ Combate encerrado. ${currentRound} round${currentRound !== 1 ? 's' : ''}.`);
    setCombatActive(false);
    setInitiativeOrder([]);
    setCurrentRound(1);
    setCurrentTurnIndex(0);
  }

  // ── Quick actions ─────────────────────────────────────────────────────────

  function applyDamage() {
    const val = parseInt(damageVal, 10);
    if (isNaN(val) || val <= 0 || !selectedToken) return;
    const newHp = Math.max(0, selectedToken.hp - val);
    adjustHp(selectedToken.id, -val);
    addLog(`${selectedToken.name} sofreu ${val} de dano. (HP: ${newHp}/${selectedToken.maxHp})`, 'damage');
    if (newHp === 0) { addLog(`💀 ${selectedToken.name} caiu!`, 'damage'); playSfx?.('death'); }
    else playSfx?.('hit');
    setDamageVal('');
  }

  function applyHeal() {
    const val = parseInt(healVal, 10);
    if (isNaN(val) || val <= 0 || !selectedToken) return;
    const newHp = Math.min(selectedToken.maxHp, selectedToken.hp + val);
    adjustHp(selectedToken.id, val);
    addLog(`${selectedToken.name} recebeu ${val} de cura. (HP: ${newHp}/${selectedToken.maxHp})`, 'heal');
    playSfx?.('heal');
    setHealVal('');
  }

  function addCondition() {
    if (!selectedToken || !condPick) return;
    if (selectedToken.conditions.includes(condPick)) return;
    updateToken(selectedToken.id, { conditions: [...selectedToken.conditions, condPick] });
    addLog(`${selectedToken.name}: condição "${condPick}" adicionada.`, 'condition');
  }

  function removeCondition(cond) {
    if (!selectedToken) return;
    updateToken(selectedToken.id, {
      conditions: selectedToken.conditions.filter(c => c !== cond),
    });
  }

  const onDamageKey = (e) => { if (e.key === 'Enter') applyDamage(); };
  const onHealKey   = (e) => { if (e.key === 'Enter') applyHeal(); };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>

        {/* ── Combat state header ── */}
        {combatActive ? (
          <>
            {/* Round counter + controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 10,
            }}>
              <div style={{
                fontSize: 20, fontWeight: 700, color: 'var(--gold)',
                letterSpacing: '0.04em', flex: 1,
              }}>
                Round {currentRound}
              </div>
              {isGM && <button className="tbtn" onClick={advanceTurn}>Próximo Turno</button>}
              {isGM && (
                <button
                  className="tbtn"
                  onClick={endCombat}
                  style={{ color: '#e05555' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#e05555'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = '#e05555'; }}
                >
                  Encerrar
                </button>
              )}
            </div>

            {/* Turn timer */}
            {timerEnabled && (
              <TurnTimer
                duration={timerDuration ?? 60}
                isActive={combatActive}
                currentTurnIndex={currentTurnIndex}
                isGM={isGM}
                playSfx={playSfx}
                timerSoundEnabled={timerSoundEnabled}
              />
            )}

            {/* Initiative order list */}
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 5, overflow: 'hidden', marginBottom: 14,
            }}>
              {displayRows.length === 0 ? (
                <div style={{ padding: '10px 12px', color: 'var(--sub)', fontSize: 11 }}>
                  Todos os tokens foram removidos.
                </div>
              ) : displayRows.map((row) => {
                const isCurrent = row.origIdx === currentTurnIndex;
                const token = row.token;
                const hp = token.hp;
                const maxHp = token.maxHp;
                const hpPct = maxHp > 0 ? hp / maxHp : 0;

                return (
                  <div
                    key={row.tokenId}
                    onClick={() => setSelectedId(token.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '6px 10px',
                      borderLeft: isCurrent ? '3px solid var(--gold)' : '3px solid transparent',
                      background: isCurrent ? 'rgba(201,169,110,0.08)' : 'transparent',
                      borderTop: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                  >
                    {/* Turn arrow */}
                    <span style={{
                      width: 10, flexShrink: 0,
                      color: 'var(--gold)', fontSize: 10, fontWeight: 700,
                    }}>
                      {isCurrent ? '▸' : ''}
                    </span>

                    {/* Initiative */}
                    <span style={{
                      width: 22, flexShrink: 0, textAlign: 'right',
                      fontSize: 12, fontWeight: 700,
                      color: isCurrent ? 'var(--gold)' : 'var(--text)',
                    }}>
                      {row.initiative}
                    </span>

                    {/* Color dot */}
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background: token.color,
                    }} />

                    {/* Name */}
                    <span style={{
                      flex: 1, minWidth: 0,
                      fontSize: 12, color: 'var(--text)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {token.name}
                      {token.hp <= 0 && ' 💀'}
                    </span>

                    {/* HP bar + text */}
                    <div style={{ flexShrink: 0, textAlign: 'right' }}>
                      <div style={{
                        fontSize: 10, color: hpColor(hp, maxHp),
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {hp}/{maxHp}
                      </div>
                      <div style={{
                        width: 40, height: 3, marginTop: 2,
                        background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${hpPct * 100}%`, height: '100%',
                          background: hpColor(hp, maxHp), borderRadius: 2,
                          transition: 'width 0.25s',
                        }} />
                      </div>
                    </div>

                    {/* Condition dots + effect badges */}
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                      {token.conditions.slice(0, 3).map((_, ci) => (
                        <div key={ci} style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: 'rgba(201,169,110,0.75)',
                        }} />
                      ))}
                      <EffectBadges effects={token.activeEffects ?? []} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          /* ── Not in combat ── */
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, color: 'var(--sub)', marginBottom: 10,
              padding: '8px 10px',
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 5, lineHeight: 1.5,
            }}>
              Nenhum combate ativo.<br />
              <span style={{ fontSize: 10 }}>
                A iniciativa será rolada automaticamente para todos os tokens.
              </span>
            </div>
            {isGM && (
              <button
                className="tbtn"
                onClick={startCombat}
                disabled={tokens.length === 0}
                style={{
                  width: '100%', padding: '8px',
                  borderColor: tokens.length > 0 ? 'var(--gold)' : undefined,
                  color: tokens.length > 0 ? 'var(--gold)' : undefined,
                  opacity: tokens.length === 0 ? 0.4 : 1,
                }}
              >
                ⚔ Iniciar Combate
              </button>
            )}
          </div>
        )}

        {/* ── Quick Actions ── */}
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--gold-dim)',
          marginBottom: 8,
        }}>
          Ações Rápidas
          {selectedToken && (
            <span style={{
              fontSize: 10, fontWeight: 400, textTransform: 'none',
              letterSpacing: 0, marginLeft: 6, color: 'var(--sub)',
            }}>
              — {selectedToken.name}
            </span>
          )}
        </div>

        {!selectedToken ? (
          <div style={{
            fontSize: 11, color: 'var(--sub)', padding: '8px 0',
          }}>
            Selecione um token no mapa ou na lista.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Dano */}
            <div>
              <label className="vtt-label">Dano</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="vtt-input"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={damageVal}
                  onChange={e => setDamageVal(e.target.value)}
                  onKeyDown={onDamageKey}
                  style={{ width: 70 }}
                />
                <button className="tbtn" onClick={applyDamage}>Aplicar</button>
              </div>
            </div>

            {/* Cura */}
            <div>
              <label className="vtt-label">Cura</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="vtt-input"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={healVal}
                  onChange={e => setHealVal(e.target.value)}
                  onKeyDown={onHealKey}
                  style={{ width: 70 }}
                />
                <button className="tbtn" onClick={applyHeal}>Aplicar</button>
              </div>
            </div>

            {/* Condições */}
            <div>
              <label className="vtt-label">Condições</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <select
                  className="vtt-select"
                  value={condPick}
                  onChange={e => setCondPick(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button className="tbtn" onClick={addCondition}>Adicionar</button>
              </div>

              {/* Active condition chips */}
              {selectedToken.conditions.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedToken.conditions.map(cond => (
                    <button
                      key={cond}
                      className="cond-chip"
                      onClick={() => removeCondition(cond)}
                      title="Clique para remover"
                    >
                      {cond} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Timer settings (GM only) ── */}
      <TurnTimerSettings
        timerEnabled={timerEnabled}
        setTimerEnabled={setTimerEnabled}
        timerDuration={timerDuration}
        setTimerDuration={setTimerDuration}
        timerSoundEnabled={timerSoundEnabled}
        setTimerSoundEnabled={setTimerSoundEnabled}
        isGM={isGM}
      />
    </div>
  );
}
