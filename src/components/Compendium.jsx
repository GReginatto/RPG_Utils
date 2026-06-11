import { useState, useMemo, useRef } from 'react';
import { resizeImage } from '../utils/imageUtils';

const CATEGORIES = [
  { id: 'criatura', label: '👾 Criaturas' },
  { id: 'item',     label: '⚔ Itens'     },
  { id: 'tecnica',  label: '✨ Técnicas'  },
  { id: 'aura',     label: '🌀 Auras'     },
];

const STARTER = [
  { id: '_goblin',   category: 'criatura', name: 'Goblin',         description: 'Criatura pequena e ardilosa, comum em florestas e masmorras.',         stats: { hp: 7,   ac: 15, atk: '+4',  dmg: '1d6+2',  mov: 6, tier: 1 } },
  { id: '_orc',      category: 'criatura', name: 'Orc',            description: 'Guerreiro brutal com força sobre-humana.',                              stats: { hp: 15,  ac: 13, atk: '+5',  dmg: '2d6+3',  mov: 5, tier: 2 } },
  { id: '_esqueleto',category: 'criatura', name: 'Esqueleto',      description: 'Morto-vivo animado por magia sombria. Imune a veneno.',                 stats: { hp: 13,  ac: 13, atk: '+4',  dmg: '1d8+2',  mov: 6, tier: 1 } },
  { id: '_zumbi',    category: 'criatura', name: 'Zumbi',          description: 'Morto-vivo lento mas resistente. Regenera 1 HP por turno.',             stats: { hp: 22,  ac: 8,  atk: '+3',  dmg: '1d8+1',  mov: 3, tier: 1 } },
  { id: '_lobo',     category: 'criatura', name: 'Lobo',           description: 'Predador ágil que caça em matilha. Derruba alvos (CD 11).',             stats: { hp: 11,  ac: 13, atk: '+4',  dmg: '2d4+2',  mov: 8, tier: 1 } },
  { id: '_troll',    category: 'criatura', name: 'Troll',          description: 'Gigante regenerador. Regenera 10 HP/turno (fogo cancela).',             stats: { hp: 84,  ac: 15, atk: '+7',  dmg: '2d8+5',  mov: 6, tier: 4 } },
  { id: '_vampiro',  category: 'criatura', name: 'Vampiro',        description: 'Nobre das trevas. Drena vida e controla mentes frágeis.',               stats: { hp: 144, ac: 16, atk: '+9',  dmg: '3d8+4',  mov: 6, tier: 6 } },
  { id: '_golem',    category: 'criatura', name: 'Golem de Pedra', description: 'Construto imune à magia e altamente resistente.',                       stats: { hp: 178, ac: 17, atk: '+10', dmg: '3d10+6', mov: 4, tier: 5 } },
  { id: '_dragao',   category: 'criatura', name: 'Dragão Jovem',   description: 'Réptil majestoso com sopro de fogo. Voa e aterroriza.',                 stats: { hp: 110, ac: 18, atk: '+10', dmg: '4d8+6',  mov: 8, tier: 5 } },
  { id: '_lich',     category: 'criatura', name: 'Lich',           description: 'Arquimago morto-vivo de poder imensurável. Possui phylactere.',         stats: { hp: 135, ac: 17, atk: '+12', dmg: '4d6+7',  mov: 6, tier: 7 } },
];

const STARTER_IDS = new Set(STARTER.map(s => s.id));

function makeEntry(overrides = {}) {
  return {
    id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    category: 'criatura',
    name: '',
    description: '',
    stats: {},
    image: null,
    ...overrides,
  };
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'var(--card)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
      <div style={{ fontSize: 9, color: 'var(--sub)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
    </div>
  );
}

export default function Compendium({ entries = [], onAdd, onUpdate, onDelete, onCreateToken }) {
  const [category, setCategory] = useState('criatura');
  const [search,   setSearch]   = useState('');
  const [editing,  setEditing]  = useState(null);
  const [draft,    setDraft]    = useState(null);
  const [viewing,  setViewing]  = useState(null);
  const imgInputRef = useRef(null);

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 128);
    setDraft(p => ({ ...p, image: dataUrl }));
    e.target.value = '';
  }

  const allEntries = useMemo(() => {
    const custom = entries.filter(e => !STARTER_IDS.has(e.id));
    return [...STARTER, ...custom];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allEntries.filter(e =>
      e.category === category &&
      (q === '' || e.name.toLowerCase().includes(q) || (e.description ?? '').toLowerCase().includes(q))
    );
  }, [allEntries, category, search]);

  function startNew() {
    setDraft(makeEntry({ category }));
    setEditing('new');
  }

  function startEdit(e) {
    setDraft({ ...e, stats: { ...e.stats } });
    setEditing(e.id);
  }

  function save() {
    if (!draft) return;
    const entry = { ...draft, name: draft.name.trim() || 'Sem nome' };
    if (editing === 'new') onAdd?.(entry);
    else onUpdate?.(entry.id, entry);
    setEditing(null); setDraft(null);
  }

  function cancel() { setEditing(null); setDraft(null); }

  const isEditing = editing !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} className={`tbtn${category === c.id ? ' active' : ''}`}
              style={{ fontSize: 10, padding: '2px 6px', flex: 1 }}
              onClick={() => setCategory(c.id)}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="vtt-input" placeholder="🔍 Buscar..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ flex: 1, fontSize: 11 }} />
          {!isEditing && (
            <button className="tbtn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={startNew}>+ Novo</button>
          )}
        </div>
      </div>

      {/* ── List ── */}
      {!isEditing && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filtered.length === 0 && (
            <div style={{ color: 'var(--sub)', fontSize: 11, textAlign: 'center', padding: '24px 0' }}>
              Nenhum resultado.
            </div>
          )}
          {filtered.map(e => (
            <div key={e.id}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 6, marginBottom: 6, padding: '7px 10px', cursor: 'pointer',
              }}
              onClick={() => setViewing(e)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {e.image && (
                  <div style={{ width: 24, height: 24, borderRadius: 3, flexShrink: 0, background: `url(${e.image}) center/cover`, border: '1px solid var(--border)' }} />
                )}
                <span style={{ flex: 1, fontWeight: 600, fontSize: 12 }}>{e.name}</span>
                {e.stats?.tier !== undefined && (
                  <span style={{ fontSize: 10, color: 'var(--gold)', background: 'rgba(201,169,110,0.12)', padding: '1px 6px', borderRadius: 8 }}>
                    T{e.stats.tier}
                  </span>
                )}
                <div style={{ display: 'flex', gap: 3 }} onClick={ev => ev.stopPropagation()}>
                  {onCreateToken && (
                    <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
                      title="Criar token no mapa" onClick={() => onCreateToken(e)}>+🎭</button>
                  )}
                  {!STARTER_IDS.has(e.id) && (
                    <>
                      <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
                        onClick={() => startEdit(e)}>✏</button>
                      <button className="tbtn danger" style={{ fontSize: 10, padding: '1px 5px' }}
                        onClick={() => onDelete?.(e.id)}>✕</button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 3 }}>
                {(e.description ?? '').slice(0, 72)}{(e.description?.length ?? 0) > 72 ? '…' : ''}
              </div>
              {e.category === 'criatura' && e.stats && (
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: 'var(--sub)' }}>
                  {e.stats.hp  !== undefined && <span>❤ {e.stats.hp}</span>}
                  {e.stats.ac  !== undefined && <span>🛡 {e.stats.ac}</span>}
                  {e.stats.atk && <span>⚔ {e.stats.atk}</span>}
                  {e.stats.dmg && <span>💥 {e.stats.dmg}</span>}
                </div>
              )}
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
            <div className="vtt-label">Categoria</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {CATEGORIES.map(c => (
                <button key={c.id} className={`tbtn${draft.category === c.id ? ' active' : ''}`}
                  style={{ fontSize: 10 }}
                  onClick={() => setDraft(p => ({ ...p, category: c.id }))}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="vtt-label">Nome</div>
            <input className="vtt-input" value={draft.name}
              onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
              placeholder="Nome" style={{ width: '100%' }} />
          </div>

          <div>
            <div className="vtt-label">Imagem</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {draft.image && (
                <div style={{ width: 40, height: 40, borderRadius: 4, flexShrink: 0, background: `url(${draft.image}) center/cover`, border: '1px solid var(--border)' }} />
              )}
              <button className="tbtn" style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => imgInputRef.current?.click()}>
                {draft.image ? '↺ Trocar' : '+ Imagem'}
              </button>
              {draft.image && (
                <button className="tbtn" style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={() => setDraft(p => ({ ...p, image: null }))}>✕ Remover</button>
              )}
              <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleImageUpload} />
            </div>
          </div>

          <div>
            <div className="vtt-label">Descrição</div>
            <textarea className="vtt-input" value={draft.description ?? ''}
              onChange={e => setDraft(p => ({ ...p, description: e.target.value }))}
              placeholder="Descrição..." style={{ width: '100%', minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {draft.category === 'criatura' && (
            <>
              <div className="vtt-label">Estatísticas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[['hp','HP','number'],['ac','CA','number'],['atk','Ataque','text'],['dmg','Dano','text'],['mov','MOV','number'],['tier','Tier','number']].map(([key, label, type]) => (
                  <div key={key}>
                    <div className="vtt-label" style={{ fontSize: 9 }}>{label}</div>
                    <input className="vtt-input" type={type} value={draft.stats?.[key] ?? ''}
                      onChange={e => setDraft(p => ({
                        ...p,
                        stats: { ...p.stats, [key]: type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value },
                      }))}
                      style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
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
            borderRadius: 8, padding: 20, width: 420, maxWidth: '90vw', maxHeight: '80vh',
            overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {viewing.image && (
                  <div style={{ width: 48, height: 48, borderRadius: 6, background: `url(${viewing.image}) center/cover`, border: '1px solid var(--border)', flexShrink: 0 }} />
                )}
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)' }}>{viewing.name}</div>
              </div>
              <button onClick={() => setViewing(null)}
                style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 10, textTransform: 'uppercase' }}>
              {CATEGORIES.find(c => c.id === viewing.category)?.label ?? viewing.category}
              {viewing.stats?.tier !== undefined ? ` · Tier ${viewing.stats.tier}` : ''}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, marginBottom: 14 }}>
              {viewing.description || '(sem descrição)'}
            </div>
            {viewing.stats && Object.keys(viewing.stats).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
                {viewing.stats.hp  !== undefined && <StatBox label="HP"     value={viewing.stats.hp}  color="#e05555" />}
                {viewing.stats.ac  !== undefined && <StatBox label="CA"     value={viewing.stats.ac}  color="var(--gold)" />}
                {viewing.stats.atk           && <StatBox label="Ataque" value={viewing.stats.atk} />}
                {viewing.stats.dmg           && <StatBox label="Dano"   value={viewing.stats.dmg} />}
                {viewing.stats.mov !== undefined && <StatBox label="MOV"    value={viewing.stats.mov} />}
                {viewing.stats.tier !== undefined && <StatBox label="Tier"   value={viewing.stats.tier} color="var(--gold)" />}
              </div>
            )}
            {onCreateToken && (
              <button className="tbtn" style={{ width: '100%', fontSize: 11 }}
                onClick={() => { onCreateToken(viewing); setViewing(null); }}>
                + Criar Token no Mapa
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
