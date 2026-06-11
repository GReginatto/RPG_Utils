import { useState, useMemo } from 'react';
import { useRole } from '../hooks/useRole';

function makeEntry(overrides = {}) {
  return {
    id: `journal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'note',
    title: '',
    content: '',
    sharedWith: 'none',
    pinned: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

const TYPE_ICON = { note: '📝', handout: '📄', image: '🖼' };
const TYPE_LABEL = { note: 'Nota', handout: 'Handout', image: 'Imagem' };

export default function JournalPanel({ entries = [], onAdd, onUpdate, onDelete, addChatMessage }) {
  const { isGM, playerName, players } = useRole();
  const [filter, setFilter]   = useState('all');
  const [editing, setEditing] = useState(null);
  const [draft,   setDraft]   = useState(null);
  const [viewing, setViewing] = useState(null);

  const visible = useMemo(() => {
    return entries
      .filter(e => {
        if (isGM) return true;
        if (e.sharedWith === 'none') return false;
        if (e.sharedWith === 'all') return true;
        if (Array.isArray(e.sharedWith)) return e.sharedWith.includes(playerName);
        return false;
      })
      .filter(e => filter === 'all' || e.type === filter);
  }, [entries, isGM, playerName, filter]);

  const sorted = [...visible.filter(e => e.pinned), ...visible.filter(e => !e.pinned)];

  function startNew() {
    setDraft(makeEntry({ createdBy: isGM ? 'gm' : playerName }));
    setEditing('new');
  }

  function startEdit(e) {
    setDraft({ ...e });
    setEditing(e.id);
  }

  function save() {
    if (!draft) return;
    const entry = { ...draft, title: draft.title.trim() || 'Sem título' };
    if (editing === 'new') onAdd?.(entry);
    else onUpdate?.(entry.id, entry);
    setEditing(null); setDraft(null);
  }

  function cancel() { setEditing(null); setDraft(null); }

  function shareToChat(e) {
    const text = e.type === 'image'
      ? `📄 **${e.title}** [imagem]`
      : `📄 **${e.title}**\n${e.content.slice(0, 400)}`;
    addChatMessage?.({
      id: Date.now(), type: 'handout',
      sender: 'Mestre', timestamp: Date.now(), text,
    });
  }

  function handleImagePick() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = (ev) => {
      const file = ev.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => setDraft(p => ({ ...p, content: re.target.result }));
      reader.readAsDataURL(file);
    };
    inp.click();
  }

  const isEditing = editing !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {['all','note','handout','image'].map(f => (
            <button key={f} className={`tbtn${filter === f ? ' active' : ''}`}
              style={{ fontSize: 10, padding: '2px 6px', flex: 1 }}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'Todos' : TYPE_ICON[f]}
            </button>
          ))}
          <button className="tbtn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={startNew}>+ Nova</button>
        </div>
      </div>

      {/* ── Entry list ── */}
      {!isEditing && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {sorted.length === 0 && (
            <div style={{ color: 'var(--sub)', fontSize: 11, textAlign: 'center', padding: '24px 0' }}>
              {isGM ? 'Nenhuma entrada. Crie uma nova!' : 'Nenhum handout compartilhado com você.'}
            </div>
          )}
          {sorted.map(e => (
            <div key={e.id}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 6, marginBottom: 6, padding: '7px 10px', cursor: 'pointer',
              }}
              onClick={() => setViewing(e)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13 }}>{TYPE_ICON[e.type]}</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {e.pinned ? '📌 ' : ''}{e.title || 'Sem título'}
                </span>
                {isGM && (
                  <div style={{ display: 'flex', gap: 3 }} onClick={ev => ev.stopPropagation()}>
                    <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => startEdit(e)}>✏</button>
                    <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }} title="Enviar ao chat" onClick={() => shareToChat(e)}>📢</button>
                    <button className="tbtn danger" style={{ fontSize: 10, padding: '1px 5px' }} onClick={() => onDelete?.(e.id)}>✕</button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {e.sharedWith === 'none' ? '🔒 Privado'
                    : e.sharedWith === 'all' ? '🌐 Todos'
                    : `👥 ${Array.isArray(e.sharedWith) ? e.sharedWith.length : 0}`}
                </span>
                <span>{new Date(e.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor ── */}
      {isEditing && draft && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {editing === 'new' ? 'Nova Entrada' : 'Editar Entrada'}
          </div>

          <div>
            <div className="vtt-label">Tipo</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {['note','handout','image'].map(t => (
                <button key={t} className={`tbtn${draft.type === t ? ' active' : ''}`}
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() => setDraft(p => ({ ...p, type: t }))}>
                  {TYPE_ICON[t]} {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="vtt-label">Título</div>
            <input className="vtt-input" value={draft.title}
              onChange={e => setDraft(p => ({ ...p, title: e.target.value }))}
              placeholder="Título da entrada" style={{ width: '100%' }} />
          </div>

          {draft.type !== 'image' && (
            <div style={{ flex: 1 }}>
              <div className="vtt-label">Conteúdo</div>
              <textarea className="vtt-input" value={draft.content}
                onChange={e => setDraft(p => ({ ...p, content: e.target.value }))}
                placeholder={draft.type === 'handout' ? 'Texto para os jogadores...' : 'Anotações privadas...'}
                style={{ width: '100%', minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          )}

          {draft.type === 'image' && (
            <div>
              <div className="vtt-label">Imagem</div>
              {draft.content && (
                <img src={draft.content} alt="preview"
                  style={{ width: '100%', borderRadius: 4, marginBottom: 6, objectFit: 'contain', maxHeight: 120 }} />
              )}
              <button className="tbtn" style={{ width: '100%', fontSize: 11, marginBottom: 6 }}
                onClick={handleImagePick}>📁 Selecionar Arquivo</button>
              <div className="vtt-label">Ou URL:</div>
              <input className="vtt-input"
                value={draft.content?.startsWith('data:') ? '' : (draft.content ?? '')}
                onChange={e => setDraft(p => ({ ...p, content: e.target.value }))}
                placeholder="https://..." style={{ width: '100%' }} />
            </div>
          )}

          {isGM && (
            <div>
              <div className="vtt-label">Visibilidade</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                <button className={`tbtn${draft.sharedWith === 'none' ? ' active' : ''}`}
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() => setDraft(p => ({ ...p, sharedWith: 'none' }))}>🔒 Privado</button>
                <button className={`tbtn${draft.sharedWith === 'all' ? ' active' : ''}`}
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() => setDraft(p => ({ ...p, sharedWith: 'all' }))}>🌐 Todos</button>
                <button className={`tbtn${Array.isArray(draft.sharedWith) ? ' active' : ''}`}
                  style={{ flex: 1, fontSize: 10 }}
                  onClick={() => setDraft(p => ({ ...p, sharedWith: Array.isArray(p.sharedWith) ? 'none' : [] }))}>👥 Específico</button>
              </div>
              {Array.isArray(draft.sharedWith) && players.length > 0 && (
                <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {players.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
                      <input type="checkbox"
                        checked={draft.sharedWith.includes(p)}
                        onChange={ev => setDraft(prev => ({
                          ...prev,
                          sharedWith: ev.target.checked
                            ? [...prev.sharedWith, p]
                            : prev.sharedWith.filter(x => x !== p),
                        }))} />
                      {p}
                    </label>
                  ))}
                </div>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={draft.pinned}
                  onChange={e => setDraft(p => ({ ...p, pinned: e.target.checked }))} />
                📌 Fixar no topo
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button className="tbtn" onClick={cancel} style={{ flex: 1, fontSize: 11 }}>Cancelar</button>
            <button className="tbtn" onClick={save}
              style={{ flex: 2, fontSize: 11, background: 'rgba(201,169,110,0.15)', borderColor: 'var(--gold)' }}>
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* ── Viewer modal ── */}
      {viewing && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200 }}
            onClick={() => setViewing(null)} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 201, background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 8, padding: 20, width: 400, maxWidth: '90vw', maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>
                {TYPE_ICON[viewing.type]} {viewing.title}
              </div>
              <button onClick={() => setViewing(null)}
                style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            {viewing.type === 'image' && viewing.content && (
              <img src={viewing.content} alt={viewing.title}
                style={{ width: '100%', borderRadius: 6, marginBottom: 12, objectFit: 'contain', maxHeight: 320 }} />
            )}
            {viewing.type !== 'image' && (
              <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                {viewing.content || '(sem conteúdo)'}
              </div>
            )}
            {isGM && (
              <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
                <button className="tbtn" style={{ flex: 1, fontSize: 11 }}
                  onClick={() => { setViewing(null); startEdit(viewing); }}>✏ Editar</button>
                <button className="tbtn" style={{ flex: 1, fontSize: 11 }}
                  onClick={() => { shareToChat(viewing); setViewing(null); }}>📢 Enviar ao Chat</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
