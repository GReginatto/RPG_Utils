import { useState, useRef } from 'react';
import { resizeImage } from '../utils/imageUtils';

function hpColor(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct > 0.5) return '#4a9a5a';
  if (pct > 0.25) return '#c4a030';
  return '#c43030';
}

function TokenRow({ token, isSelected, onSelect, onDelete, showDelete }) {
  return (
    <div
      className={`token-row${isSelected ? ' selected' : ''}`}
      onClick={() => onSelect(token)}
      style={{ position: 'relative' }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
        border: `2px solid ${token.color}`,
        background: token.image ? `url(${token.image}) center/cover` : token.color,
        overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!token.image && (
          <span style={{ color: '#fff', fontSize: 8, fontWeight: 700 }}>
            {token.name.substring(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {token.name}
        </div>
        <div style={{ fontSize: 10, color: hpColor(token.hp, token.maxHp) }}>
          HP {token.hp}/{token.maxHp}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--sub)', flexShrink: 0 }}>Nv {token.level}</div>
      {showDelete && (
        <button
          className="token-row-delete"
          title="Remover token"
          onClick={(e) => { e.stopPropagation(); if (window.confirm(`Remover "${token.name}"?`)) onDelete(token.id); }}
          style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px', flexShrink: 0, opacity: 0 }}
          onMouseEnter={e => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = '#e05555'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = 0; e.currentTarget.style.color = 'var(--sub)'; }}
        >✕</button>
      )}
    </div>
  );
}

function GroupSection({ group, tokens, selectedId, onSelect, onDelete, isGM,
  onUpdateGroup, onDeleteGroup, onBulkCreate }) {
  const groupTokens = tokens.filter(t => group.tokenIds.includes(t.id));
  const [showMenu,  setShowMenu]  = useState(false);
  const [showBulk,  setShowBulk]  = useState(false);
  const [bulkName,  setBulkName]  = useState('');
  const [bulkCount, setBulkCount] = useState(3);
  const [bulkHp,    setBulkHp]    = useState(10);
  const [bulkAc,    setBulkAc]    = useState(10);
  const [bulkLevel, setBulkLevel] = useState(1);
  const [bulkImage, setBulkImage] = useState(null);
  const bulkImgRef = useRef(null);

  async function handleBulkImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file, 128);
    setBulkImage(dataUrl);
    e.target.value = '';
  }

  function doRenameGroup() {
    const name = window.prompt('Novo nome do grupo:', group.name);
    if (name && name.trim()) onUpdateGroup(group.id, { name: name.trim() });
    setShowMenu(false);
  }

  function doDeleteGroup(withTokens) {
    if (!window.confirm(withTokens
      ? `Deletar grupo "${group.name}" e todos os tokens?`
      : `Dissolver grupo "${group.name}"? Os tokens permanecem no mapa.`)) return;
    onDeleteGroup(group.id, withTokens);
    setShowMenu(false);
  }

  return (
    <div>
      {/* Group header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px 4px',
        borderTop: '1px solid var(--border)',
      }}>
        <button
          onClick={() => onUpdateGroup(group.id, { isCollapsed: !group.isCollapsed })}
          style={{ background: 'none', border: 'none', color: 'var(--gold-dim)', cursor: 'pointer', fontSize: 10, padding: 0, flexShrink: 0 }}
        >
          {group.isCollapsed ? '▶' : '▼'}
        </button>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: 'var(--gold-dim)', flex: 1, minWidth: 0,
        }}>
          {group.name} ({groupTokens.length})
        </span>
        {isGM && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
            >⋮</button>
            {showMenu && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShowMenu(false)} />
                <div style={{
                  position: 'absolute', right: 0, top: '100%', zIndex: 200,
                  background: 'var(--panel)', border: '1px solid var(--border)',
                  borderRadius: 5, minWidth: 190, padding: '3px 0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                }}>
                  {[
                    { label: '✏ Renomear Grupo', action: doRenameGroup },
                    { label: '+ Adicionar Tokens em Massa', action: () => { setShowBulk(v => !v); setShowMenu(false); } },
                    { label: '💨 Dissolver Grupo', action: () => doDeleteGroup(false) },
                    { label: '🗑 Deletar Grupo e Tokens', action: () => doDeleteGroup(true), danger: true },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      style={{
                        display: 'block', width: '100%', background: 'none',
                        border: 'none', padding: '7px 12px', textAlign: 'left',
                        fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        color: item.danger ? '#e05555' : 'var(--text)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                    >{item.label}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk create form */}
      {showBulk && isGM && (
        <div style={{ margin: '4px 10px 8px', padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 5 }}>
          <div style={{ fontSize: 10, color: 'var(--sub)', marginBottom: 6 }}>
            Adicionar ao grupo: <strong style={{ color: group.color }}>{group.name}</strong>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px', gap: 5, marginBottom: 5 }}>
            <input className="vtt-input" placeholder="Nome base (ex: Goblin)" value={bulkName}
              onChange={e => setBulkName(e.target.value)} style={{ fontSize: 11 }} autoFocus />
            <input className="vtt-input" type="number" min={1} max={20} value={bulkCount}
              onChange={e => setBulkCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              style={{ textAlign: 'center', fontSize: 11 }} title="Quantidade" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 5, marginBottom: 8 }}>
            {[
              { label: 'HP', val: bulkHp,    set: setBulkHp },
              { label: 'CA', val: bulkAc,    set: setBulkAc },
              { label: 'Nv', val: bulkLevel, set: setBulkLevel },
            ].map(({ label, val, set }) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 2 }}>{label}</div>
                <input className="vtt-input" type="number" min={1} value={val}
                  onChange={e => set(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ textAlign: 'center', fontSize: 11 }} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--sub)', marginBottom: 4 }}>Imagem (opcional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {bulkImage && (
                <div style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0, border: '1px solid var(--border)', background: `url(${bulkImage}) center/cover` }} />
              )}
              <button className="tbtn" style={{ fontSize: 10, padding: '2px 6px' }}
                onClick={() => bulkImgRef.current?.click()}>
                {bulkImage ? '↺ Trocar' : '+ Imagem'}
              </button>
              {bulkImage && (
                <button className="tbtn" style={{ fontSize: 10, padding: '2px 6px' }}
                  onClick={() => setBulkImage(null)}>✕</button>
              )}
              <input ref={bulkImgRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleBulkImageUpload} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="tbtn" style={{ flex: 1, fontSize: 11 }}
              onClick={() => {
                if (!bulkName.trim()) return;
                onBulkCreate(group.id, bulkName.trim(), bulkCount, bulkHp, bulkAc, bulkLevel, bulkImage);
                setShowBulk(false); setBulkName(''); setBulkImage(null);
              }}
            >Criar {bulkCount} Tokens</button>
            <button onClick={() => { setShowBulk(false); setBulkImage(null); }}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--sub)', cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: 'inherit' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tokens in group */}
      {!group.isCollapsed && groupTokens.map(token => (
        <TokenRow key={token.id} token={token} isSelected={selectedId === token.id}
          onSelect={onSelect} onDelete={onDelete} showDelete={isGM} />
      ))}
    </div>
  );
}

export default function TokenList({
  tokens, selectedId, onSelect, onDelete, isGM,
  tokenGroups = [], onCreateGroup, onUpdateGroup, onDeleteGroup, onBulkCreateTokens,
}) {
  const [showNewGroup,  setShowNewGroup]  = useState(false);
  const [newGroupName,  setNewGroupName]  = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#c43030');

  const groupedTokenIds = new Set(tokenGroups.flatMap(g => g.tokenIds));
  const playerTokens    = tokens.filter(t => t.type === 'player');
  const ungroupedOthers = tokens.filter(t => t.type !== 'player' && !groupedTokenIds.has(t.id));

  if (tokens.length === 0) {
    return (
      <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--sub)', fontSize: 12 }}>
        Nenhum token no mapa.<br />
        <span style={{ fontSize: 10 }}>Use as ferramentas de adição na barra inferior.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Players */}
      {playerTokens.length > 0 && (
        <div>
          <div style={{ padding: '8px 10px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--gold-dim)' }}>
            Jogadores ({playerTokens.length})
          </div>
          {playerTokens.map(token => (
            <TokenRow key={token.id} token={token} isSelected={selectedId === token.id}
              onSelect={onSelect} onDelete={onDelete} showDelete={isGM} />
          ))}
        </div>
      )}

      {/* Custom groups */}
      {tokenGroups.map(group => (
        <GroupSection
          key={group.id}
          group={group}
          tokens={tokens}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          isGM={isGM}
          onUpdateGroup={onUpdateGroup}
          onDeleteGroup={onDeleteGroup}
          onBulkCreate={onBulkCreateTokens}
        />
      ))}

      {/* Ungrouped non-players */}
      {ungroupedOthers.length > 0 && (
        <div>
          <div style={{
            padding: '8px 10px 4px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--gold-dim)',
            borderTop: tokenGroups.length > 0 ? '1px solid var(--border)' : 'none',
          }}>
            Sem Grupo ({ungroupedOthers.length})
          </div>
          {ungroupedOthers.map(token => (
            <TokenRow key={token.id} token={token} isSelected={selectedId === token.id}
              onSelect={onSelect} onDelete={onDelete} showDelete={isGM} />
          ))}
        </div>
      )}

      {/* GM: New group button */}
      {isGM && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)' }}>
          {!showNewGroup ? (
            <button className="tbtn" onClick={() => setShowNewGroup(true)} style={{ fontSize: 11, width: '100%' }}>
              + Novo Grupo
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ display: 'flex', gap: 5 }}>
                <input className="vtt-input" placeholder="Nome do grupo" value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newGroupName.trim()) {
                      onCreateGroup(newGroupName.trim(), newGroupColor);
                      setShowNewGroup(false); setNewGroupName('');
                    }
                  }}
                  style={{ flex: 1, fontSize: 11 }} autoFocus />
                <input type="color" value={newGroupColor} onChange={e => setNewGroupColor(e.target.value)}
                  style={{ width: 32, height: 28, padding: 2, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}
                  title="Cor do grupo" />
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="tbtn" style={{ flex: 1, fontSize: 11 }}
                  onClick={() => {
                    if (!newGroupName.trim()) return;
                    onCreateGroup(newGroupName.trim(), newGroupColor);
                    setShowNewGroup(false); setNewGroupName('');
                  }}
                >Criar Grupo</button>
                <button onClick={() => { setShowNewGroup(false); setNewGroupName(''); }}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--sub)', cursor: 'pointer', fontSize: 11, padding: '3px 8px', fontFamily: 'inherit' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
