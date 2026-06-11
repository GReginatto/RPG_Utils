import { useState } from 'react';
import { rollDice, parseDiceNotation } from '../utils/dice';

function resolveInlineDice(text) {
  return text.replace(/\[(\d*d\d+(?:[+-]\d+)?)\]/gi, (_, notation) => {
    const p = parseDiceNotation(notation);
    if (!p) return notation;
    return String(rollDice(p.count, p.sides, p.modifier).total);
  });
}

function makeTable(overrides = {}) {
  return {
    id: `table-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: 'Nova Tabela',
    dice: '1d6',
    shareResult: false,
    entries: [
      { id: 'r1', min: 1, max: 1, result: '' },
      { id: 'r2', min: 2, max: 2, result: '' },
      { id: 'r3', min: 3, max: 3, result: '' },
      { id: 'r4', min: 4, max: 4, result: '' },
      { id: 'r5', min: 5, max: 5, result: '' },
      { id: 'r6', min: 6, max: 6, result: '' },
    ],
    ...overrides,
  };
}

export default function RollableTable({ tables = [], onAdd, onUpdate, onDelete, addLog, addChatMessage, isGM }) {
  const [expanded,   setExpanded]   = useState(null);
  const [editing,    setEditing]    = useState(null);
  const [draft,      setDraft]      = useState(null);
  const [lastResult, setLastResult] = useState({});

  function rollTable(table) {
    const parsed = parseDiceNotation(table.dice);
    const n = parsed?.count ?? 1, d = parsed?.sides ?? 6, m = parsed?.modifier ?? 0;
    const roll = rollDice(n, d, m);
    const total = roll.total;
    const entry = table.entries.find(e => total >= e.min && total <= e.max);
    const raw = entry?.result || `(sem resultado para ${total})`;
    const resolved = resolveInlineDice(raw);
    const suffix = resolved !== raw ? ` (rolado: ${raw})` : '';
    const display = `${table.dice}=${total}: ${resolved}${suffix}`;

    setLastResult(prev => ({ ...prev, [table.id]: display }));
    addLog?.(`🎲 ${table.name} [${total}]: ${resolved}${suffix}`, 'dice');
    if (table.shareResult) {
      addChatMessage?.({
        id: Date.now(), type: 'roll',
        sender: 'Mestre', timestamp: Date.now(),
        text: `🎲 ${table.name} [${total}]: ${resolved}${suffix}`,
      });
    }
  }

  function startNew() {
    setDraft(makeTable());
    setEditing('new');
    setExpanded(null);
  }

  function startEdit(table) {
    setDraft(JSON.parse(JSON.stringify(table)));
    setEditing(table.id);
    setExpanded(null);
  }

  function save() {
    if (!draft) return;
    const t = { ...draft, name: draft.name.trim() || 'Sem nome' };
    if (editing === 'new') onAdd?.(t);
    else onUpdate?.(t.id, t);
    setEditing(null); setDraft(null);
  }

  function cancel() { setEditing(null); setDraft(null); }

  function addRow() {
    const last = draft.entries[draft.entries.length - 1];
    const min = last ? last.max + 1 : 1;
    setDraft(p => ({
      ...p,
      entries: [...p.entries, { id: `r${Date.now()}`, min, max: min, result: '' }],
    }));
  }

  function updateRow(id, patch) {
    setDraft(p => ({ ...p, entries: p.entries.map(r => r.id === id ? { ...r, ...patch } : r) }));
  }

  function removeRow(id) {
    setDraft(p => ({ ...p, entries: p.entries.filter(r => r.id !== id) }));
  }

  const isEditing = editing !== null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: 'var(--gold-dim)',
        letterSpacing: '0.06em', textTransform: 'uppercase',
        marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>📋 Tabelas Aleatórias</span>
        {isGM && !isEditing && (
          <button className="tbtn" style={{ fontSize: 10, padding: '2px 8px' }} onClick={startNew}>+ Nova</button>
        )}
      </div>

      {/* ── Table list ── */}
      {!isEditing && (
        <>
          {tables.length === 0 && (
            <div style={{ color: 'var(--sub)', fontSize: 10, textAlign: 'center', padding: '8px 0' }}>
              {isGM ? 'Nenhuma tabela. Crie uma!' : 'Nenhuma tabela disponível.'}
            </div>
          )}
          {tables.map(table => (
            <div key={table.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 6, marginBottom: 6, overflow: 'hidden',
            }}>
              <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  onClick={() => setExpanded(expanded === table.id ? null : table.id)}>
                  {table.name}
                </span>
                <span style={{ fontSize: 10, color: 'var(--sub)' }}>{table.dice}</span>
                <button className="tbtn" style={{ fontSize: 10, padding: '2px 8px' }}
                  onClick={() => rollTable(table)}>🎲 Rolar</button>
                {isGM && (
                  <>
                    <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
                      onClick={() => startEdit(table)}>✏</button>
                    <button className="tbtn danger" style={{ fontSize: 10, padding: '1px 5px' }}
                      onClick={() => onDelete?.(table.id)}>✕</button>
                  </>
                )}
              </div>

              {lastResult[table.id] && (
                <div style={{
                  padding: '4px 10px', fontSize: 11, color: 'var(--gold)',
                  borderTop: '1px solid var(--border)', background: 'rgba(201,169,110,0.06)',
                }}>
                  {lastResult[table.id]}
                </div>
              )}

              {expanded === table.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '6px 10px', maxHeight: 200, overflowY: 'auto' }}>
                  {table.entries.map(row => (
                    <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0', fontSize: 11 }}>
                      <span style={{ color: 'var(--gold-dim)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.min === row.max ? row.min : `${row.min}–${row.max}`}
                      </span>
                      <span style={{ color: 'var(--text)', flex: 1 }}>{row.result || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ── Editor ── */}
      {isEditing && draft && (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 6, padding: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 8 }}>
            {editing === 'new' ? 'Nova Tabela' : 'Editar Tabela'}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <div style={{ flex: 2 }}>
              <div className="vtt-label">Nome</div>
              <input className="vtt-input" value={draft.name}
                onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
                style={{ width: '100%', fontSize: 11 }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="vtt-label">Dados</div>
              <input className="vtt-input" value={draft.dice}
                onChange={e => setDraft(p => ({ ...p, dice: e.target.value }))}
                placeholder="1d6" style={{ width: '100%', fontSize: 11 }} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginBottom: 8 }}>
            <input type="checkbox" checked={draft.shareResult}
              onChange={e => setDraft(p => ({ ...p, shareResult: e.target.checked }))} />
            Compartilhar resultado no chat
          </label>

          <div className="vtt-label">Entradas <span style={{ color: 'var(--sub)', fontWeight: 400 }}>(use [1d6] para dados inline)</span></div>
          <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 6 }}>
            {draft.entries.map(row => (
              <div key={row.id} style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <input className="vtt-input" type="number" value={row.min}
                  onChange={e => updateRow(row.id, { min: +e.target.value })}
                  style={{ width: 42, fontSize: 10 }} title="Mínimo" />
                <span style={{ fontSize: 10, color: 'var(--sub)' }}>–</span>
                <input className="vtt-input" type="number" value={row.max}
                  onChange={e => updateRow(row.id, { max: +e.target.value })}
                  style={{ width: 42, fontSize: 10 }} title="Máximo" />
                <input className="vtt-input" value={row.result}
                  onChange={e => updateRow(row.id, { result: e.target.value })}
                  placeholder="Resultado..."
                  style={{ flex: 1, fontSize: 10 }} />
                <button style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                  onClick={() => removeRow(row.id)}>✕</button>
              </div>
            ))}
          </div>
          <button className="tbtn" style={{ width: '100%', fontSize: 10, marginBottom: 8 }} onClick={addRow}>+ Linha</button>

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="tbtn" onClick={cancel} style={{ flex: 1, fontSize: 11 }}>Cancelar</button>
            <button className="tbtn" onClick={save}
              style={{ flex: 2, fontSize: 11, background: 'rgba(201,169,110,0.15)', borderColor: 'var(--gold)' }}>
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
