import { useState, useEffect } from 'react';
import { useRole } from '../hooks/useRole';

const CATEGORY_LABELS = { pc: 'Personagens', extra: 'Extras', npc: 'NPCs' };
const CATEGORY_COLORS = { pc: '#c9a96e', extra: '#6eaac9', npc: '#c96e6e' };

const DROP_ITEM = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', color: '#d8d0c4',
  fontSize: 13, cursor: 'pointer',
  border: 'none', background: 'none',
  width: '100%', textAlign: 'left',
  fontFamily: 'inherit',
};

const DROP_SEP = { height: 1, background: '#2a2a3a', margin: '4px 0' };

function DropItem({ children, onClick, danger }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      style={{
        ...DROP_ITEM,
        background: hov ? (danger ? 'rgba(196,48,48,0.15)' : '#2a2a3a') : 'none',
        color: hov ? (danger ? '#e05555' : '#c9a96e') : (danger ? '#c43030' : '#d8d0c4'),
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function SheetManager({ sheetState, tokens, onOpenSheet, isGM, playerName, players = [], onRemovePlayer }) {
  const { sheets, addSheet, updateSheet, deleteSheet, duplicateSheet } = sheetState;
  const { playerRecords, blockPlayer, unblockPlayer, removePlayerAuth, resetPlayerPassword } = useRole();
  const [openMenuId,   setOpenMenuId]   = useState(null);
  const [linkPickerId, setLinkPickerId] = useState(null);
  const [sharePickerId, setSharePickerId] = useState(null);
  const [showPlayerMgr, setShowPlayerMgr] = useState(false);
  const [resetTarget,   setResetTarget]   = useState(null); // player name
  const [newPassInput,  setNewPassInput]  = useState('');

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e) {
      if (!e.target.closest('.sheet-menu-container')) {
        setOpenMenuId(null);
        setLinkPickerId(null);
        setSharePickerId(null);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // ── BUG 1: Player can only create ONE sheet ────────────────────────────────
  const playerSheets   = isGM ? [] : sheets.filter(s => s.owner === playerName);
  const canCreateSheet = isGM || playerSheets.length === 0;

  // Players see own + public + shared sheets
  const visibleSheets = isGM
    ? sheets
    : sheets.filter(s =>
        s.owner === playerName ||
        s.isPublic ||
        (s.sharedWith ?? []).includes(playerName)
      );

  const grouped = {
    pc:    visibleSheets.filter(s => s.category === 'pc'),
    extra: visibleSheets.filter(s => s.category === 'extra'),
    npc:   visibleSheets.filter(s => s.category === 'npc'),
  };

  function getDisplayName(sheet) {
    if (sheet.linkedTokenId) {
      const tok = tokens.find(t => t.id === sheet.linkedTokenId);
      return tok?.name ?? sheet.name;
    }
    return sheet.name;
  }

  function getDisplayImage(sheet) {
    if (sheet.linkedTokenId) {
      const tok = tokens.find(t => t.id === sheet.linkedTokenId);
      return tok?.image ?? sheet.image;
    }
    return sheet.image;
  }

  function handleCreate(category) {
    const sheet = addSheet({ category, owner: isGM ? null : playerName });
    onOpenSheet(sheet.id);
  }

  function handleExport(sheet) {
    const blob = new Blob([JSON.stringify(sheet, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `ficha-${getDisplayName(sheet).replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setOpenMenuId(null);
  }

  function handleConvert(sheet) {
    updateSheet(sheet.id, { category: sheet.category === 'npc' ? 'pc' : 'npc' });
    setOpenMenuId(null);
  }

  function handleLinkToken(sheet, tokenId) {
    updateSheet(sheet.id, { linkedTokenId: tokenId || null });
    setLinkPickerId(null);
    setOpenMenuId(null);
  }

  function handleToggleShare(sheet, player) {
    const cur  = sheet.sharedWith ?? [];
    const next = cur.includes(player) ? cur.filter(p => p !== player) : [...cur, player];
    updateSheet(sheet.id, { sharedWith: next });
  }

  function toggleMenu(sheetId, e) {
    e.stopPropagation();
    const same = openMenuId === sheetId;
    setOpenMenuId(same ? null : sheetId);
    setLinkPickerId(null);
    setSharePickerId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Create buttons ── */}
      <div style={{
        display: 'flex', gap: 5, padding: '8px 10px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {isGM ? (
          <>
            <button className="tbtn" onClick={() => handleCreate('pc')}
              style={{ fontSize: 10, flex: 1, padding: '4px 3px' }} title="Criar ficha para jogador">
              + Jogador
            </button>
            <button className="tbtn" onClick={() => handleCreate('npc')}
              style={{ fontSize: 10, flex: 1, padding: '4px 3px' }} title="Criar ficha de NPC">
              + NPC
            </button>
            <button className="tbtn" onClick={() => handleCreate('extra')}
              style={{ fontSize: 10, flex: 1, padding: '4px 3px' }} title="Criar ficha extra">
              + Extra
            </button>
          </>
        ) : canCreateSheet ? (
          <button className="tbtn" onClick={() => handleCreate('pc')}
            style={{ fontSize: 11, flex: 1 }}>
            + Criar Meu Personagem
          </button>
        ) : null}
      </div>

      {/* ── Sheet list ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {visibleSheets.length === 0 && (
          <div style={{
            padding: '24px 16px', textAlign: 'center',
            color: 'var(--sub)', fontSize: 11, fontStyle: 'italic',
          }}>
            Nenhuma ficha criada.
          </div>
        )}

        {Object.entries(grouped).map(([cat, catSheets]) => {
          if (catSheets.length === 0) return null;
          return (
            <div key={cat}>
              {/* Category header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 10px 3px',
                fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: CATEGORY_COLORS[cat],
              }}>
                <span>{CATEGORY_LABELS[cat]}</span>
                <span style={{ color: 'var(--sub)', fontWeight: 400 }}>({catSheets.length})</span>
              </div>

              {catSheets.map(sheet => {
                const displayName = getDisplayName(sheet);
                const displayImg  = getDisplayImage(sheet);
                const linkedTok   = sheet.linkedTokenId
                  ? tokens.find(t => t.id === sheet.linkedTokenId)
                  : null;
                const isOwner    = isGM || sheet.owner === playerName;
                const isShared   = !isOwner && (sheet.sharedWith ?? []).includes(playerName);

                return (
                  <div
                    key={sheet.id}
                    className="token-row"
                    onClick={() => onOpenSheet(sheet.id)}
                    style={{ position: 'relative', userSelect: 'none' }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${sheet.color || CATEGORY_COLORS[cat]}`,
                      background: displayImg ? `url(${displayImg}) center/cover` : 'var(--card)',
                      backgroundSize: 'cover',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, color: 'var(--sub)',
                    }}>
                      {!displayImg && displayName.substring(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: 'var(--text)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {displayName}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--sub)', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {linkedTok ? <span>🔗 {linkedTok.name}</span> : <span>📄 Independente</span>}
                        {sheet.owner && <span>· {sheet.owner}</span>}
                        {sheet.isPublic && <span style={{ color: '#6eaac9' }}>· Pública</span>}
                        {isShared && <span style={{ color: '#6ec96e' }}>· Compartilhada</span>}
                      </div>
                    </div>

                    {/* ── ⋮ Menu (BUG 3: always visible, inline dropdown) ── */}
                    {(isOwner || isShared) && (
                      <div
                        className="sheet-menu-container"
                        style={{ position: 'relative', flexShrink: 0 }}
                        onClick={e => e.stopPropagation()}
                      >
                        {/* ⋮ Button */}
                        <button
                          title="Opções"
                          onClick={e => toggleMenu(sheet.id, e)}
                          style={{
                            width: 28, height: 28,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: openMenuId === sheet.id ? 'var(--border)' : 'transparent',
                            border: 'none', cursor: 'pointer', borderRadius: 4,
                            color: openMenuId === sheet.id ? 'var(--gold)' : 'var(--sub)',
                            fontSize: 18, lineHeight: 1,
                            transition: 'color 0.1s, background 0.1s',
                          }}
                          onMouseEnter={e => {
                            if (openMenuId !== sheet.id) {
                              e.currentTarget.style.color = 'var(--gold)';
                              e.currentTarget.style.background = 'var(--card)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (openMenuId !== sheet.id) {
                              e.currentTarget.style.color = 'var(--sub)';
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >⋮</button>

                        {/* Dropdown */}
                        {openMenuId === sheet.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%',
                            minWidth: 210, zIndex: 9999,
                            background: '#12121c', border: '1px solid #2a2a3a',
                            borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.55)',
                            padding: '4px 0',
                          }}>
                            {/* Abrir + Editar (everyone with access) */}
                            <DropItem onClick={() => { onOpenSheet(sheet.id); setOpenMenuId(null); }}>
                              📋 Abrir Ficha
                            </DropItem>
                            {isOwner && (
                              <DropItem onClick={() => { onOpenSheet(sheet.id); setOpenMenuId(null); }}>
                                ✏️ Editar
                              </DropItem>
                            )}
                            {isShared && !isOwner && (
                              <DropItem onClick={() => { onOpenSheet(sheet.id); setOpenMenuId(null); }}>
                                👁 Ver (leitura)
                              </DropItem>
                            )}

                            {/* GM-only options */}
                            {isGM && (
                              <>
                                <div style={DROP_SEP} />

                                <DropItem onClick={() => {
                                  const copy = duplicateSheet(sheet.id);
                                  if (copy) onOpenSheet(copy.id);
                                  setOpenMenuId(null);
                                }}>📄 Duplicar</DropItem>

                                {/* Vincular a Token */}
                                <DropItem onClick={() => {
                                  setLinkPickerId(prev => prev === sheet.id ? null : sheet.id);
                                  setSharePickerId(null);
                                }}>
                                  🔗 Vincular a Token{linkPickerId === sheet.id ? ' ▲' : ' ▼'}
                                </DropItem>
                                {linkPickerId === sheet.id && (
                                  <div style={{
                                    background: 'rgba(0,0,0,0.25)',
                                    borderTop: '1px solid #2a2a3a',
                                    borderBottom: '1px solid #2a2a3a',
                                    maxHeight: 140, overflowY: 'auto',
                                  }}>
                                    <DropItem onClick={() => handleLinkToken(sheet, null)}>
                                      ✕ Desvincular
                                    </DropItem>
                                    {tokens.map(tok => (
                                      <DropItem key={tok.id} onClick={() => handleLinkToken(sheet, tok.id)}>
                                        <span style={{
                                          width: 8, height: 8, borderRadius: '50%',
                                          background: tok.color || '#888', flexShrink: 0, display: 'inline-block',
                                        }} />
                                        {tok.name}
                                        {tok.id === sheet.linkedTokenId && ' ✓'}
                                      </DropItem>
                                    ))}
                                    {tokens.length === 0 && (
                                      <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--sub)' }}>
                                        Nenhum token no mapa.
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Compartilhar com... */}
                                {players.length > 0 && (
                                  <>
                                    <DropItem onClick={() => {
                                      setSharePickerId(prev => prev === sheet.id ? null : sheet.id);
                                      setLinkPickerId(null);
                                    }}>
                                      👥 Compartilhar com...{sharePickerId === sheet.id ? ' ▲' : ' ▼'}
                                    </DropItem>
                                    {sharePickerId === sheet.id && (
                                      <div style={{
                                        background: 'rgba(0,0,0,0.25)',
                                        borderTop: '1px solid #2a2a3a',
                                        borderBottom: '1px solid #2a2a3a',
                                        padding: '4px 8px',
                                      }}>
                                        {players.map(p => (
                                          <label key={p} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '4px 4px', fontSize: 12, cursor: 'pointer',
                                            color: 'var(--text)',
                                          }}>
                                            <input
                                              type="checkbox"
                                              checked={(sheet.sharedWith ?? []).includes(p)}
                                              onChange={() => handleToggleShare(sheet, p)}
                                              onClick={e => e.stopPropagation()}
                                              style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
                                            />
                                            {p}
                                          </label>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Tornar pública */}
                                <DropItem onClick={() => {
                                  updateSheet(sheet.id, { isPublic: !sheet.isPublic });
                                  setOpenMenuId(null);
                                }}>
                                  🌐 {sheet.isPublic ? 'Tornar privada' : 'Tornar pública'}
                                </DropItem>

                                {/* Converter tipo */}
                                <DropItem onClick={() => handleConvert(sheet)}>
                                  🔄 Converter para {sheet.category === 'npc' ? 'PC' : 'NPC'}
                                </DropItem>

                                {/* Exportar */}
                                <DropItem onClick={() => handleExport(sheet)}>
                                  📤 Exportar Ficha
                                </DropItem>

                                <div style={DROP_SEP} />

                                <DropItem danger onClick={() => {
                                  if (window.confirm(`Deletar "${displayName}"?`)) {
                                    deleteSheet(sheet.id);
                                  }
                                  setOpenMenuId(null);
                                }}>
                                  🗑️ Deletar
                                </DropItem>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── GM Player Management ── */}
      {isGM && playerRecords.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 10px', flexShrink: 0 }}>
          <button
            className="tbtn"
            onClick={() => setShowPlayerMgr(v => !v)}
            style={{ width: '100%', fontSize: 11 }}
          >
            👥 Gerenciar Jogadores
          </button>
          {showPlayerMgr && (
            <div style={{ marginTop: 8 }}>
              {playerRecords.map(r => (
                <div key={r.id} style={{
                  borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: r.isActive ? 'var(--text)' : 'var(--sub)',
                      textDecoration: r.isActive ? 'none' : 'line-through',
                    }}>
                      {r.name}
                      {!r.isActive && <span style={{ fontSize: 10, color: '#e05555', marginLeft: 6 }}>bloqueado</span>}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {r.isActive ? (
                        <button
                          className="tbtn"
                          onClick={() => blockPlayer(r.name)}
                          style={{ fontSize: 10, padding: '2px 6px', color: '#e05555', borderColor: '#e0555544' }}
                          title="Bloquear jogador"
                        >
                          🔒
                        </button>
                      ) : (
                        <button
                          className="tbtn"
                          onClick={() => unblockPlayer(r.name)}
                          style={{ fontSize: 10, padding: '2px 6px' }}
                          title="Desbloquear jogador"
                        >
                          🔓
                        </button>
                      )}
                      <button
                        className="tbtn"
                        onClick={() => setResetTarget(prev => prev === r.name ? null : r.name)}
                        style={{ fontSize: 10, padding: '2px 6px' }}
                        title="Redefinir senha"
                      >
                        🔑
                      </button>
                      <button
                        className="tbtn"
                        onClick={() => {
                          if (!window.confirm(`Remover ${r.name}? Fichas e tokens serão transferidos ao Mestre.`)) return;
                          onRemovePlayer?.(r.name);
                          removePlayerAuth(r.name);
                        }}
                        style={{ fontSize: 10, padding: '2px 6px', color: '#e05555', borderColor: '#e0555544' }}
                        title="Remover jogador"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  {r.lastLogin && (
                    <div style={{ fontSize: 10, color: 'var(--sub)' }}>
                      Último login: {new Date(r.lastLogin).toLocaleString('pt-BR')}
                    </div>
                  )}
                  {resetTarget === r.name && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                      <input
                        className="vtt-input"
                        type="password"
                        placeholder="Nova senha..."
                        value={newPassInput}
                        onChange={e => setNewPassInput(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="tbtn"
                        onClick={async () => {
                          if (!newPassInput || newPassInput.length < 4) return;
                          await resetPlayerPassword(r.name, newPassInput);
                          setResetTarget(null);
                          setNewPassInput('');
                        }}
                        style={{ fontSize: 11 }}
                      >
                        OK
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
