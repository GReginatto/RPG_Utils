import { useState, useRef } from 'react';
import { rollDice, parseDiceNotation } from '../utils/dice';

const QUICK_DICE = [4, 6, 8, 10, 12, 20, 100];


function roll(expr) {
  const parsed = parseDiceNotation(expr);
  if (!parsed) return null;
  const { count, sides, modifier } = parsed;
  const result = rollDice(count, sides, modifier);
  const isNat20 = count === 1 && sides === 20 && result.rolls[0] === 20;
  const isNat1  = count === 1 && sides === 20 && result.rolls[0] === 1;
  return { total: result.total, rolls: result.rolls, modifier, expr, isNat20, isNat1 };
}

function fmt(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildBreakdown(result) {
  const rollsPart = '[' + result.rolls.join(', ') + ']';
  if (result.modifier === 0) return `${rollsPart} = ${result.total}`;
  const sign = result.modifier > 0 ? '+' : '−';
  return `${rollsPart} ${sign} ${Math.abs(result.modifier)} = ${result.total}`;
}

export default function DiceRoller({ addLog, playSfx, quickRolls = null, onUpdateQuickRolls = null, charName = '' }) {
  const [customExpr, setCustomExpr] = useState('');
  const [lastResult, setLastResult]  = useState(null);
  const [history, setHistory]        = useState([]);
  const [rolling, setRolling]        = useState(false);
  const [qrForm, setQrForm]          = useState({ label: '', expr: '' });
  const inputRef = useRef(null);

  function addQuickRoll() {
    if (!qrForm.label.trim() || !parseDiceNotation(qrForm.expr.trim())) return;
    const newRoll = { id: `qr-${Date.now()}`, label: qrForm.label.trim(), expr: qrForm.expr.trim() };
    onUpdateQuickRolls?.([...(quickRolls ?? []), newRoll]);
    setQrForm({ label: '', expr: '' });
  }

  function deleteQuickRoll(id) {
    onUpdateQuickRolls?.((quickRolls ?? []).filter(qr => qr.id !== id));
  }

  const execute = (expr) => {
    if (rolling) return;
    const trimmed = expr.trim();
    if (!parseDiceNotation(trimmed)) return;
    setRolling(true);
    setTimeout(() => {
      const result = roll(trimmed);
      if (!result) { setRolling(false); return; }
      setLastResult(result);
      setHistory(prev => [
        { time: fmt(new Date()), expr: result.expr, total: result.total },
        ...prev.slice(0, 9),
      ]);
      const modifier = result.modifier !== 0
        ? (result.modifier > 0 ? ` +${result.modifier}` : ` ${result.modifier}`)
        : '';
      addLog?.(`🎲 ${result.expr}: [${result.rolls.join(', ')}]${modifier} = ${result.total}`, 'dice');
      playSfx?.(result.isNat20 ? 'critical' : 'dice');
      setRolling(false);
    }, 380);
  };

  const onCustomRoll = () => {
    if (customExpr.trim()) execute(customExpr);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') onCustomRoll();
  };

  const totalColor = lastResult?.isNat20
    ? '#f0c040'
    : lastResult?.isNat1
    ? '#e05555'
    : 'var(--gold)';

  const glowStyle = lastResult?.isNat20
    ? { textShadow: '0 0 20px rgba(240,192,64,0.8), 0 0 40px rgba(240,192,64,0.4)' }
    : {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px' }}>

        {/* Quick dice row */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
          {QUICK_DICE.map(sides => (
            <button
              key={sides}
              onClick={() => execute(`1d${sides}`)}
              style={{
                flex: '1 1 auto',
                minWidth: 34, height: 34,
                background: 'var(--card)', border: '1px solid var(--border)',
                color: 'var(--text)', borderRadius: 4, cursor: 'pointer',
                fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
                transition: 'border-color 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
            >
              d{sides}
            </button>
          ))}
        </div>

        {/* Custom roll input */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <input
            ref={inputRef}
            className="vtt-input"
            style={{ flex: 1 }}
            placeholder="Ex: 2d6+3"
            value={customExpr}
            onChange={e => setCustomExpr(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            className="tbtn"
            onClick={onCustomRoll}
            style={{ flexShrink: 0 }}
          >
            Rolar
          </button>
        </div>

        {/* Result display */}
        {(rolling || lastResult) && (
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '10px 14px', marginBottom: 12,
            textAlign: 'center', minHeight: 72,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            {rolling ? (
              <div style={{
                fontSize: 32, lineHeight: 1,
                animation: 'diceSpin 0.5s linear infinite',
                display: 'inline-block',
              }}>
                🎲
              </div>
            ) : lastResult && (
              <>
                <div style={{
                  fontSize: 32, fontWeight: 700, lineHeight: 1.1,
                  color: totalColor, ...glowStyle,
                  transition: 'color 0.2s',
                }}>
                  {lastResult.total}
                </div>
                {(lastResult.isNat20 || lastResult.isNat1) && (
                  <div style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                    color: totalColor, marginTop: 2,
                  }}>
                    {lastResult.isNat20 ? 'CRÍTICO!' : 'FALHA CRÍTICA!'}
                  </div>
                )}
                <div style={{
                  fontSize: 11, color: 'var(--sub)', marginTop: 4,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {buildBreakdown(lastResult)}
                </div>
              </>
            )}
          </div>
        )}

        {/* Roll history */}
        {history.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--gold-dim)',
              marginBottom: 4,
            }}>
              Histórico
            </div>
            <div style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 4, overflow: 'hidden',
            }}>
              {history.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '4px 8px', fontSize: 11,
                    borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                    color: 'var(--sub)',
                  }}
                >
                  <span style={{ flexShrink: 0, fontSize: 10, opacity: 0.7 }}>{entry.time}</span>
                  <span style={{ flex: 1, color: 'var(--text)' }}>{entry.expr}</span>
                  <span>→</span>
                  <span style={{ fontWeight: 700, color: 'var(--gold-dim)', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-character quick rolls */}
        {quickRolls !== null && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 6 }}>
              {charName ? `Rolagens de ${charName}` : 'Rolagens Rápidas'}
            </div>
            {quickRolls.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--sub)', fontStyle: 'italic', marginBottom: 6 }}>Nenhuma rolagem cadastrada.</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {quickRolls.map(qr => (
                <div key={qr.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button
                    onClick={() => execute(qr.expr)}
                    style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', padding: '5px 10px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.1s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                  >
                    <span>{qr.label}</span>
                    <span style={{ color: 'var(--sub)', fontSize: 10 }}>{qr.expr}</span>
                  </button>
                  {onUpdateQuickRolls && (
                    <button onClick={() => deleteQuickRoll(qr.id)}
                      style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 12, padding: '0 4px', flexShrink: 0 }}
                      title="Remover">✕</button>
                  )}
                </div>
              ))}
            </div>
            {onUpdateQuickRolls && (
              <div style={{ display: 'flex', gap: 5 }}>
                <input className="vtt-input" placeholder="Nome" value={qrForm.label}
                  onChange={e => setQrForm(f => ({ ...f, label: e.target.value }))}
                  style={{ flex: 1 }} />
                <input className="vtt-input" placeholder="2d6+3" value={qrForm.expr}
                  onChange={e => setQrForm(f => ({ ...f, expr: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && addQuickRoll()}
                  style={{ width: 70 }} />
                <button className="tbtn" onClick={addQuickRoll} style={{ flexShrink: 0, fontSize: 11 }}>+</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
