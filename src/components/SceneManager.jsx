import { useState, useRef } from 'react';
import { fromTemplate, makeScene } from '../hooks/useScenes';

const TEMPLATES = [
  { id: 'vazio',    icon: '⬜', label: 'Vazio',        desc: 'Grade 30×20, em branco' },
  { id: 'taverna',  icon: '🍺', label: 'Taverna',       desc: 'Pré-decorada com mesas e balcão' },
  { id: 'masmorra', icon: '☠',  label: 'Masmorra',      desc: 'Grade 40×30, névoa ativada' },
  { id: 'campo',    icon: '🌿', label: 'Campo Aberto',  desc: 'Grade 30×20, vegetação decorativa' },
  { id: 'caverna',  icon: '🗿', label: 'Caverna',        desc: 'Grade 35×25, névoa + bordas rochosas' },
  { id: 'custom',   icon: '✏',  label: 'Personalizado', desc: 'Definir nome e tamanho da grade' },
];

export default function SceneManager({
  scenes,
  activeSceneId,
  onSwitch,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  onReorder,
  onConfigGrid,
  notes,
  onUpdateNotes,
}) {
  const [ctxMenu,     setCtxMenu]     = useState(null);
  const [renamingId,  setRenamingId]  = useState(null);
  const [showPicker,  setShowPicker]  = useState(false);
  const [showNotes,   setShowNotes]   = useState(false);
  const [dragIdx,     setDragIdx]     = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const renameInputRef = useRef(null);

  function commitRename(sceneId, value) {
    onRename(sceneId, value.trim() || 'Cena sem nome');
    setRenamingId(null);
  }

  function handleDeleteClick(sceneId, sceneName) {
    if (scenes.length <= 1) { window.alert('Não é possível deletar a última cena.'); return; }
    if (window.confirm(`Deletar a cena "${sceneName}"?\nEsta ação não pode ser desfeita.`)) {
      onDelete(sceneId);
    }
    setCtxMenu(null);
  }

  function handleConfigGrid(sceneId) {
    setCtxMenu(null);
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const input = window.prompt(
      `Tamanho da grade — "${scene.name}"\nFormato: colunas×linhas  (ex: 30×20)`,
      `${scene.gridSize?.cols ?? 30}×${scene.gridSize?.rows ?? 20}`
    );
    if (input === null) return;
    const m = input.match(/^(\d+)[x×](\d+)$/i);
    if (!m) { window.alert('Formato inválido. Use: 30×20'); return; }
    const cols = Math.max(10, Math.min(80, parseInt(m[1], 10)));
    const rows = Math.max(10, Math.min(60, parseInt(m[2], 10)));
    onConfigGrid(sceneId, { cols, rows });
  }

  function handleCreateTemplate(templateId) {
    setShowPicker(false);
    if (templateId === 'custom') {
      const name = window.prompt('Nome da cena:', 'Nova Cena');
      if (name === null) return;
      const dims = window.prompt('Tamanho da grade (colunas×linhas):', '30×20');
      if (dims === null) return;
      const m = dims.match(/^(\d+)[x×](\d+)$/i);
      const cols = m ? Math.max(10, Math.min(80, parseInt(m[1], 10))) : 30;
      const rows = m ? Math.max(10, Math.min(60, parseInt(m[2], 10))) : 20;
      onCreate(makeScene({ name: name.trim() || 'Nova Cena', gridSize: { cols, rows } }));
    } else {
      onCreate(fromTemplate(templateId));
    }
  }

  // ── Drag-to-reorder ──────────────────────────────────────────────────────
  function handleDragStart(e, idx) {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  }
  function handleDragOver(e, idx) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== idx) setDragOverIdx(idx);
  }
  function handleDrop(e, idx) {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) onReorder(dragIdx, idx);
    setDragIdx(null); setDragOverIdx(null);
  }
  function handleDragEnd() { setDragIdx(null); setDragOverIdx(null); }

  return (
    <>
      {/* ── Scene tab bar ── */}
      <div style={{
        height: 32, background: 'var(--panel)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'stretch', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Scrollable tabs */}
        <div style={{
          display: 'flex', flex: 1, overflowX: 'auto', alignItems: 'stretch',
          scrollbarWidth: 'none',
        }}>
          {scenes.map((scene, idx) => {
            const isActive    = scene.id === activeSceneId;
            const isDragOver  = dragOverIdx === idx && dragIdx !== idx;
            return (
              <div
                key={scene.id}
                draggable
                onDragStart={e => handleDragStart(e, idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={e => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => { if (renamingId !== scene.id) onSwitch(scene.id); }}
                onDoubleClick={() => setRenamingId(scene.id)}
                onContextMenu={e => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, sceneId: scene.id, sceneName: scene.name });
                }}
                style={{
                  display: 'flex', alignItems: 'center', padding: '0 10px',
                  cursor: 'pointer', flexShrink: 0, userSelect: 'none',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRight: '1px solid var(--border)',
                  borderLeft: isDragOver ? '2px solid var(--gold)' : '1px solid transparent',
                  background: isActive ? 'rgba(201,169,110,0.07)' : isDragOver ? 'rgba(201,169,110,0.04)' : 'transparent',
                  color: isActive ? 'var(--gold)' : 'var(--sub)',
                  fontSize: 12, fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s, color 0.1s',
                  minWidth: 60, maxWidth: 140,
                }}
              >
                {renamingId === scene.id ? (
                  <input
                    ref={renameInputRef}
                    autoFocus
                    defaultValue={scene.name}
                    style={{
                      background: 'transparent', border: 'none',
                      outline: '1px solid var(--gold)', outlineOffset: 1,
                      color: 'var(--gold)', fontSize: 12,
                      width: 100, fontFamily: 'inherit', padding: '1px 3px',
                    }}
                    onBlur={e => commitRename(scene.id, e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename(scene.id, e.target.value);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {scene.name.length > 15 ? `${scene.name.slice(0, 14)}…` : scene.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 1, padding: '0 5px',
          flexShrink: 0, borderLeft: '1px solid var(--border)',
        }}>
          <button
            title="Notas desta cena (📝)"
            onClick={() => setShowNotes(v => !v)}
            style={{
              background: showNotes ? 'rgba(201,169,110,0.12)' : 'none',
              border: 'none', color: showNotes ? 'var(--gold)' : 'var(--sub)',
              cursor: 'pointer', fontSize: 12, padding: '2px 7px', borderRadius: 3,
              fontFamily: 'inherit',
            }}
          >📝</button>
          <button
            title="Nova cena (+)"
            onClick={() => setShowPicker(true)}
            style={{
              background: 'none', border: 'none', color: 'var(--sub)',
              cursor: 'pointer', fontSize: 18, padding: '0 7px',
              lineHeight: 1, fontFamily: 'inherit',
            }}
          >+</button>
        </div>
      </div>

      {/* ── Notes panel ── */}
      {showNotes && (
        <div style={{
          borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0,
        }}>
          <textarea
            value={notes}
            onChange={e => onUpdateNotes(e.target.value)}
            placeholder="Notas do mestre para esta cena…"
            style={{
              display: 'block', width: '100%', height: 88, resize: 'vertical',
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--sub)', fontSize: 11, fontFamily: 'monospace',
              lineHeight: 1.6, padding: '6px 10px', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {/* ── Context menu ── */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onMouseDown={() => setCtxMenu(null)} />
          <div className="ctx-menu" style={{ left: ctxMenu.x + 2, top: ctxMenu.y + 2, zIndex: 1100 }}
            onMouseDown={e => e.stopPropagation()}>
            <button className="ctx-btn" onClick={() => { setRenamingId(ctxMenu.sceneId); setCtxMenu(null); }}>
              Renomear
            </button>
            <button className="ctx-btn" onClick={() => { onDuplicate(ctxMenu.sceneId); setCtxMenu(null); }}>
              Duplicar
            </button>
            <button className="ctx-btn" onClick={() => handleConfigGrid(ctxMenu.sceneId)}>
              Configurar Grade
            </button>
            <div className="ctx-sep" />
            <button className="ctx-btn danger"
              onClick={() => handleDeleteClick(ctxMenu.sceneId, ctxMenu.sceneName)}>
              Deletar
            </button>
          </div>
        </>
      )}

      {/* ── Template picker modal ── */}
      {showPicker && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseDown={() => setShowPicker(false)}
        >
          <div
            style={{
              background: 'var(--panel)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '20px 24px', width: 420,
              boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
            }}
            onMouseDown={e => e.stopPropagation()}
          >
            <div style={{
              color: 'var(--gold)', fontSize: 14, fontWeight: 700,
              marginBottom: 16, textAlign: 'center', letterSpacing: '0.04em',
            }}>
              Nova Cena — Escolha um Modelo
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleCreateTemplate(t.id)}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 6, padding: '10px 12px', cursor: 'pointer',
                    textAlign: 'left', color: 'var(--text)', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--gold)';
                    e.currentTarget.style.background = 'rgba(201,169,110,0.07)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--card)';
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4, lineHeight: 1 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold)' }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--sub)', marginTop: 2, lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="tbtn" onClick={() => setShowPicker(false)} style={{ fontSize: 11 }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
