import { useState, useCallback } from 'react';
import { rollDice, parseDiceNotation } from '../utils/dice';
import { useRole } from '../hooks/useRole';

const EMOJI_ICONS = ['⚔','🛡','✨','🎲','🔥','💀','🌿','⚡','🌀','💫','🗡','🏹','🧙','🩹','💥','🌪','🔮','🎯','🛡','👁'];

function makeId() { return `macro-${Date.now()}-${Math.random().toString(36).slice(2,6)}`; }

export async function runMacroCommands(commands, { addLog, addChatMessage, senderName }) {
  for (const rawCmd of commands) {
    const cmd = rawCmd.trim();
    if (!cmd) continue;

    if (/^\/r(?:oll)?\s+/i.test(cmd)) {
      const notation = cmd.replace(/^\/r(?:oll)?\s+/i, '').trim();
      const p = parseDiceNotation(notation);
      if (p) {
        const r = rollDice(p.count, p.sides, p.modifier);
        const mod = p.modifier !== 0 ? (p.modifier > 0 ? `+${p.modifier}` : `${p.modifier}`) : '';
        addLog(`🎲 [${senderName}] ${notation}: [${r.rolls.join('+')}]${mod} = **${r.total}**`, 'dice');
      }
    } else if (/^\/damage\s+/i.test(cmd)) {
      const notation = cmd.replace(/^\/damage\s+/i, '').trim();
      const p = parseDiceNotation(notation);
      if (p) {
        const r = rollDice(p.count, p.sides, p.modifier);
        addLog(`💥 Dano (${notation}) = ${r.total}`, 'damage');
      }
    } else if (/^\/heal\s+/i.test(cmd)) {
      const notation = cmd.replace(/^\/heal\s+/i, '').trim();
      const p = parseDiceNotation(notation);
      if (p) {
        const r = rollDice(p.count, p.sides, p.modifier);
        addLog(`💚 Cura (${notation}) = ${r.total}`, 'heal');
      }
    } else if (/^\/say\s+/i.test(cmd)) {
      const text = cmd.replace(/^\/say\s+/i, '').trim();
      addChatMessage({ id: Date.now(), type: 'say', sender: senderName, timestamp: Date.now(), text });
    } else if (/^\/emote\s+/i.test(cmd)) {
      const text = cmd.replace(/^\/emote\s+/i, '').trim();
      addChatMessage({ id: Date.now(), type: 'emote', sender: senderName, timestamp: Date.now(), text: `*${text}*` });
    } else if (/^\/wait\s+/i.test(cmd)) {
      const ms = parseInt(cmd.replace(/^\/wait\s+/i, '').trim(), 10) || 500;
      await new Promise(resolve => setTimeout(resolve, Math.min(ms, 5000)));
    } else {
      addLog(`[Macro] ${cmd}`, 'system');
    }
  }
}

function MacroEditor({ draft, setDraft, onSave, onCancel, onTest, addLog, addChatMessage, senderName }) {
  const [showIcons, setShowIcons] = useState(false);
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
      zIndex: 300, background: 'var(--panel)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 20, width: 380, maxWidth: '90vw',
      boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 14 }}>⚡ {draft.id ? 'Editar Macro' : 'Nova Macro'}</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="vtt-label">Nome</div>
          <input className="vtt-input" value={draft.name}
            onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
            placeholder="Nome da macro" style={{ width: '100%' }} />
        </div>
        <div>
          <div className="vtt-label">Ícone</div>
          <div style={{ position: 'relative' }}>
            <button className="tbtn" style={{ fontSize: 18, width: 40, height: 28, padding: 0 }}
              onClick={() => setShowIcons(v => !v)}>
              {draft.icon}
            </button>
            {showIcons && (
              <div style={{
                position: 'absolute', bottom: 32, left: 0, zIndex: 10,
                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6,
                padding: 6, display: 'flex', flexWrap: 'wrap', gap: 3, width: 180,
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              }}>
                {EMOJI_ICONS.map(em => (
                  <button key={em} style={{
                    width: 28, height: 28, fontSize: 16, background: 'var(--card)',
                    border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: 0,
                  }}
                    onClick={() => { setDraft(p => ({ ...p, icon: em })); setShowIcons(false); }}
                  >{em}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div className="vtt-label">Comandos <span style={{ color: 'var(--sub)', fontWeight: 400 }}>(um por linha)</span></div>
        <textarea className="vtt-input"
          value={draft.commands.join('\n')}
          onChange={e => setDraft(p => ({ ...p, commands: e.target.value.split('\n') }))}
          rows={6}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
          placeholder={'/r 1d20+5\n/wait 300\n/r 1d8+3'} />
        <div style={{ fontSize: 9, color: 'var(--sub)', marginTop: 4, lineHeight: 1.6 }}>
          /r 1d20+5 · /say texto · /emote ação · /damage 2d6 · /heal 1d8 · /wait 500
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={draft.isGlobal}
          onChange={e => setDraft(p => ({ ...p, isGlobal: e.target.checked }))} />
        Disponível para todos os jogadores
      </label>

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="tbtn" onClick={onCancel} style={{ flex: 1, fontSize: 11 }}>Cancelar</button>
        <button className="tbtn" onClick={() => {
          const cmds = draft.commands.filter(c => c.trim());
          runMacroCommands(cmds, { addLog, addChatMessage, senderName });
        }} style={{ flex: 1, fontSize: 11 }}>Testar</button>
        <button className="tbtn" onClick={onSave}
          style={{ flex: 2, fontSize: 11, background: 'rgba(201,169,110,0.15)', borderColor: 'var(--gold)' }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

export default function MacroBar({ macros = [], onAdd, onUpdate, onDelete, addLog, addChatMessage, selectedToken }) {
  const { isGM, playerName } = useRole();
  const [collapsed,   setCollapsed]   = useState(false);
  const [editingId,   setEditingId]   = useState(null);
  const [draft,       setDraft]       = useState(null);
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [dragFrom,    setDragFrom]    = useState(null);
  const senderName = selectedToken?.name ?? (isGM ? 'Mestre' : (playerName ?? '?'));

  const visibleMacros = macros.filter(m =>
    (m.owner === (isGM ? 'gm' : playerName)) || (m.isGlobal && !isGM)
  );

  function startNew() {
    setDraft({ id: '', name: '', icon: '⚔', commands: [], isGlobal: false, owner: isGM ? 'gm' : playerName });
    setEditingId('new');
  }

  function startEdit(macro) {
    setDraft({ ...macro, commands: [...macro.commands] });
    setEditingId(macro.id);
    setCtxMenu(null);
  }

  function save() {
    if (!draft) return;
    const entry = { ...draft, name: draft.name.trim() || 'Macro', commands: draft.commands.filter(c => c.trim()) };
    if (editingId === 'new') onAdd?.({ ...entry, id: makeId() });
    else onUpdate?.(entry.id, entry);
    setEditingId(null); setDraft(null);
  }

  function cancel() { setEditingId(null); setDraft(null); }

  const run = useCallback((macro) => {
    const cmds = macro.commands.filter(c => c.trim());
    runMacroCommands(cmds, { addLog, addChatMessage, senderName });
  }, [addLog, addChatMessage, senderName]);

  // Drag-to-reorder (swap within user's own macros)
  const onDragStart = (e, macro) => {
    setDragFrom(macro.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragFrom || dragFrom === targetId) return;
    const fromIdx = macros.findIndex(m => m.id === dragFrom);
    const toIdx   = macros.findIndex(m => m.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...macros];
    next.splice(toIdx, 0, next.splice(fromIdx, 1)[0]);
    // onReorder isn't in the interface — just update order by re-issuing updates
    next.forEach((m, i) => { if (m.order !== i) onUpdate?.(m.id, { ...m, order: i }); });
    setDragFrom(null);
  };

  if (visibleMacros.length === 0 && !isGM) return null;

  return (
    <>
      {/* ── Backdrop for ctx menu ── */}
      {ctxMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 299 }} onClick={() => setCtxMenu(null)} />
      )}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div className="ctx-menu" style={{ left: ctxMenu.x, top: ctxMenu.y, zIndex: 300 }}
          onMouseDown={e => e.stopPropagation()}>
          <button className="ctx-btn" onClick={() => startEdit(ctxMenu.macro)}>✏ Editar</button>
          <button className="ctx-btn" onClick={() => {
            const copy = { ...ctxMenu.macro, id: makeId(), name: `${ctxMenu.macro.name} (cópia)` };
            onAdd?.(copy); setCtxMenu(null);
          }}>⧉ Duplicar</button>
          <div className="ctx-sep" />
          <button className="ctx-btn danger" onClick={() => { onDelete?.(ctxMenu.macro.id); setCtxMenu(null); }}>✕ Deletar</button>
        </div>
      )}

      {/* ── Editor modal ── */}
      {editingId !== null && draft && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 299 }}
            onClick={cancel} />
          <MacroEditor
            draft={draft} setDraft={setDraft}
            onSave={save} onCancel={cancel}
            addLog={addLog} addChatMessage={addChatMessage} senderName={senderName}
          />
        </>
      )}

      {/* ── Macro Bar ── */}
      <div style={{
        position: 'fixed', bottom: 50, left: 0,
        zIndex: 140, display: 'flex', alignItems: 'flex-end', gap: 0,
        pointerEvents: 'none',
      }}>
        {/* Collapse toggle */}
        <button
          style={{
            pointerEvents: 'all',
            width: 16, height: 32,
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: '0 4px 4px 0', borderLeft: 'none',
            color: 'var(--sub)', cursor: 'pointer', fontSize: 9, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            alignSelf: 'center', marginRight: 2,
          }}
          onClick={() => setCollapsed(v => !v)}
          title={collapsed ? 'Expandir macros' : 'Recolher macros'}
        >
          {collapsed ? '▶' : '◀'}
        </button>

        {!collapsed && (
          <div style={{
            pointerEvents: 'all',
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: '0 6px 6px 0', padding: '4px 6px',
            display: 'flex', alignItems: 'center', gap: 4,
            boxShadow: '2px 0 12px rgba(0,0,0,0.45)',
            maxWidth: 'calc(100vw - 340px)', overflowX: 'auto',
          }}>
            {visibleMacros.length === 0 && (
              <span style={{ fontSize: 10, color: 'var(--sub)', whiteSpace: 'nowrap' }}>Sem macros</span>
            )}
            {visibleMacros.map(macro => (
              <button
                key={macro.id}
                className="tbtn"
                draggable
                onDragStart={e => onDragStart(e, macro)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => onDrop(e, macro.id)}
                title={macro.name + (macro.isGlobal ? ' (global)' : '')}
                style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: 110, padding: '3px 8px', flexShrink: 0 }}
                onClick={() => run(macro)}
                onContextMenu={e => {
                  if (!isGM && macro.owner !== playerName) return;
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY - 80, macro });
                }}
              >
                <span style={{ fontSize: 14 }}>{macro.icon}</span>
                <span style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 70 }}>
                  {macro.name}
                </span>
              </button>
            ))}
            {isGM && (
              <button className="tbtn" style={{ fontSize: 14, padding: '2px 8px', flexShrink: 0 }}
                title="Nova macro" onClick={startNew}>+</button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export function useMacroShortcuts(macros, run, isGM, playerName) {
  return Object.fromEntries(
    [1,2,3,4,5].map(n => [`ctrl+${n}`, () => {
      const visible = macros.filter(m =>
        (m.owner === (isGM ? 'gm' : playerName)) || (m.isGlobal && !isGM)
      );
      const macro = visible[n - 1];
      if (macro) run(macro);
    }])
  );
}
