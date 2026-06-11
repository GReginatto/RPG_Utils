import { useState, useRef, useCallback } from 'react';
import { GRID } from '../utils/constants';

const CELL = GRID.cellSize;

// ── Built-in tile library ─────────────────────────────────────────────────────
export const BUILTIN_TILES = [
  { id: 'chair',   icon: '🪑', name: 'Cadeira',    w: 1, h: 1 },
  { id: 'bed',     icon: '🛏',  name: 'Cama',       w: 1, h: 2 },
  { id: 'chest',   icon: '📦',  name: 'Baú',        w: 1, h: 1 },
  { id: 'fire',    icon: '🔥',  name: 'Fogueira',   w: 1, h: 1, glow: 'rgba(255,120,30,0.35)' },
  { id: 'tree',    icon: '🌳',  name: 'Árvore',     w: 1, h: 1 },
  { id: 'potion',  icon: '⚗️',  name: 'Alquimia',   w: 1, h: 1 },
  { id: 'scroll',  icon: '📜',  name: 'Pergaminho', w: 1, h: 1 },
  { id: 'skull',   icon: '💀',  name: 'Ossos',      w: 1, h: 1 },
  { id: 'trap',    icon: '🪤',  name: 'Armadilha',  w: 1, h: 1 },
  { id: 'sword',   icon: '🗡',  name: 'Arma',       w: 1, h: 1 },
  { id: 'shield',  icon: '🛡',  name: 'Escudo',     w: 1, h: 1 },
  { id: 'barrel',  icon: '🪣',  name: 'Barril',     w: 1, h: 1 },
  { id: 'vase',    icon: '🏺',  name: 'Vaso',       w: 1, h: 1 },
  { id: 'candle',  icon: '🕯',  name: 'Vela',       w: 1, h: 1, glow: 'rgba(255,200,80,0.3)' },
  { id: 'table',   icon: '🪞',  name: 'Mesa',       w: 2, h: 1 },
  { id: 'rock',    icon: '🪨',  name: 'Pedra',      w: 1, h: 1 },
  { id: 'door2',   icon: '🚪',  name: 'Porta Deco', w: 1, h: 1 },
  { id: 'grave',   icon: '🪦',  name: 'Lápide',     w: 1, h: 1 },
];

export function makeTile(overrides = {}) {
  return {
    id: `tile-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'builtin',
    icon: '📦',
    name: '',
    x: 0, y: 0,
    width: 1, height: 1,
    rotation: 0,
    zIndex: 0,
    visible: true,
    lightRadius: 0,
    lightColor: '#ffd700',
    locked: false,
    ...overrides,
  };
}

// ── TilePanel — floating library panel ────────────────────────────────────────
export function TilePanel({
  onClose,
  onSelectTemplate,
  selectedTemplate,
  customTiles,
  onAddCustomTile,
}) {
  const fileRef = useRef(null);
  const [size, setSize] = useState('1x1');
  const [rot,  setRot]  = useState(0);

  const sizeMap = { '1x1': [1,1], '1x2': [1,2], '2x1': [2,1], '2x2': [2,2], '3x3': [3,3] };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const [tw, th] = sizeMap[size];
        const canvas = document.createElement('canvas');
        canvas.width  = tw * 64;
        canvas.height = th * 64;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onAddCustomTile?.({
          id: `custom-${Date.now()}`,
          icon: dataUrl,
          name: file.name.replace(/\.[^.]+$/, ''),
          w: tw, h: th,
        });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const select = (tpl) => {
    const [tw, th] = sizeMap[size];
    onSelectTemplate?.({ ...tpl, w: tw, h: th, rotation: rot });
  };

  return (
    <div style={{
      position: 'absolute', top: 8, left: 8, zIndex: 160,
      background: 'var(--panel)', border: '1px solid var(--border)',
      borderRadius: 6, padding: '10px 12px', width: 240,
      boxShadow: '0 4px 24px rgba(0,0,0,0.65)',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)' }}>📦 OBJETOS</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="tbtn" style={{ padding: '2px 7px', fontSize: 11 }}
            onClick={() => fileRef.current?.click()}>Upload</button>
          <button style={{ background: 'none', border: 'none', color: 'var(--sub)', cursor: 'pointer', fontSize: 14, lineHeight: 1 }}
            onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div className="vtt-label">Tamanho</div>
          <select className="vtt-select" value={size} onChange={e => setSize(e.target.value)} style={{ fontSize: 11, height: 24 }}>
            {['1x1','1x2','2x1','2x2','3x3'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <div className="vtt-label">Rotação</div>
          <select className="vtt-select" value={rot} onChange={e => setRot(+e.target.value)} style={{ fontSize: 11, height: 24 }}>
            {[0, 90, 180, 270].map(r => <option key={r} value={r}>{r}°</option>)}
          </select>
        </div>
      </div>

      <div className="vtt-label" style={{ marginBottom: 4 }}>Biblioteca</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 160, overflowY: 'auto', marginBottom: 6 }}>
        {BUILTIN_TILES.map(tpl => (
          <button
            key={tpl.id}
            title={tpl.name}
            onClick={() => select(tpl)}
            style={{
              width: 32, height: 32, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: selectedTemplate?.id === tpl.id ? 'rgba(201,169,110,0.18)' : 'var(--card)',
              border: `1px solid ${selectedTemplate?.id === tpl.id ? 'var(--gold)' : 'var(--border)'}`,
              borderRadius: 4, cursor: 'pointer', padding: 0,
            }}
          >
            {tpl.icon}
          </button>
        ))}
      </div>

      {customTiles.length > 0 && (
        <>
          <div className="vtt-label" style={{ marginBottom: 4 }}>Personalizados</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 80, overflowY: 'auto' }}>
            {customTiles.map(tpl => (
              <button
                key={tpl.id}
                title={tpl.name}
                onClick={() => select(tpl)}
                style={{
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: selectedTemplate?.id === tpl.id ? 'rgba(201,169,110,0.18)' : 'var(--card)',
                  border: `1px solid ${selectedTemplate?.id === tpl.id ? 'var(--gold)' : 'var(--border)'}`,
                  borderRadius: 4, cursor: 'pointer', padding: 0, overflow: 'hidden',
                }}
              >
                <img src={tpl.icon} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </>
      )}

      {selectedTemplate && (
        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--sub)', textAlign: 'center' }}>
          Selecionado: <strong style={{ color: 'var(--text)' }}>{selectedTemplate.name}</strong> — clique no mapa para colocar
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg" style={{ display: 'none' }} onChange={handleUpload} />
    </div>
  );
}

// ── TileLayer — renders tiles on the map ──────────────────────────────────────
export function TileLayer({
  tiles,
  isGM,
  playerView,
  selectedTileId,
  onSelect,
  onUpdate,
  onRemove,
}) {
  const [dragState, setDragState] = useState(null); // { id, startX, startY, origX, origY }
  const [ctxMenu,  setCtxMenu]   = useState(null);   // { x, y, tile }
  const rafRef = useRef(null);

  const onTileMouseDown = useCallback((e, tile) => {
    if (e.button !== 0) return;
    if (!isGM) return;
    if (tile.locked) return;
    e.stopPropagation();
    onSelect?.(tile.id);
    setDragState({ id: tile.id, startX: e.clientX, startY: e.clientY, origX: tile.x, origY: tile.y, moved: false });

    const onMove = (me) => {
      const dx = Math.round((me.clientX - e.clientX) / CELL);
      const dy = Math.round((me.clientY - e.clientY) / CELL);
      if (dx !== 0 || dy !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          onUpdate?.(tile.id, { x: tile.x + dx, y: tile.y + dy });
        });
        setDragState(prev => prev ? { ...prev, moved: true } : prev);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',  onUp);
      setDragState(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',  onUp);
  }, [isGM, onSelect, onUpdate]);

  const onTileCtx = useCallback((e, tile) => {
    if (!isGM) return;
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, tile });
  }, [isGM]);

  const closeCtx = () => setCtxMenu(null);

  if (!tiles?.length && !ctxMenu) return null;

  const sortedTiles = [...(tiles ?? [])].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <>
      {sortedTiles.map(tile => {
        if (!tile.visible && !isGM) return null;
        const px = tile.x * CELL;
        const py = tile.y * CELL;
        const pw = tile.width  * CELL;
        const ph = tile.height * CELL;
        const isSelected = tile.id === selectedTileId;
        const isCustom   = tile.type === 'custom';
        const glow       = !isCustom && BUILTIN_TILES.find(b => b.id === tile.icon.replace(/[^a-z]/g,''))?.glow;

        return (
          <div
            key={tile.id}
            title={tile.name || undefined}
            style={{
              position: 'absolute', left: px, top: py,
              width: pw, height: ph,
              zIndex: 7 + tile.zIndex,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: Math.min(pw, ph) * 0.62,
              cursor: isGM ? (tile.locked ? 'default' : 'grab') : 'default',
              opacity: !tile.visible && isGM ? 0.38 : 1,
              pointerEvents: isGM ? 'auto' : 'none',
              transform: tile.rotation ? `rotate(${tile.rotation}deg)` : undefined,
              outline: isSelected ? '2px solid var(--gold)' : undefined,
              outlineOffset: 2,
              boxShadow: glow ? `0 0 14px 4px ${glow}` : undefined,
              userSelect: 'none',
              transition: dragState?.id === tile.id ? 'none' : 'left 0.1s, top 0.1s',
            }}
            onMouseDown={e => onTileMouseDown(e, tile)}
            onContextMenu={e => onTileCtx(e, tile)}
          >
            {isCustom
              ? <img src={tile.icon} alt={tile.name} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', borderRadius: 2 }} draggable={false} />
              : tile.icon}
          </div>
        );
      })}

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onMouseDown={closeCtx} />
          <div className="ctx-menu" style={{ left: ctxMenu.x + 2, top: ctxMenu.y + 2, zIndex: 1050 }}
            onMouseDown={e => e.stopPropagation()}>
            <button className="ctx-btn" onClick={() => { onUpdate?.(ctxMenu.tile.id, { rotation: (ctxMenu.tile.rotation + 90) % 360 }); closeCtx(); }}>
              Rotacionar 90°
            </button>
            <button className="ctx-btn" onClick={() => { onUpdate?.(ctxMenu.tile.id, { visible: !ctxMenu.tile.visible }); closeCtx(); }}>
              {ctxMenu.tile.visible ? 'Ocultar dos Jogadores' : 'Tornar Visível'}
            </button>
            <button className="ctx-btn" onClick={() => { onUpdate?.(ctxMenu.tile.id, { locked: !ctxMenu.tile.locked }); closeCtx(); }}>
              {ctxMenu.tile.locked ? '🔓 Desbloquear' : '🔒 Travar'}
            </button>
            <button className="ctx-btn" onClick={() => { onUpdate?.(ctxMenu.tile.id, { zIndex: (ctxMenu.tile.zIndex ?? 0) - 1 }); closeCtx(); }}>
              Enviar para Trás
            </button>
            <button className="ctx-btn" onClick={() => { onUpdate?.(ctxMenu.tile.id, { zIndex: (ctxMenu.tile.zIndex ?? 0) + 1 }); closeCtx(); }}>
              Trazer para Frente
            </button>
            <div className="ctx-sep" />
            {/* Light radius */}
            <button className="ctx-btn" onClick={() => {
              const r = window.prompt('Raio de luz (0 = sem luz):', String(ctxMenu.tile.lightRadius ?? 0));
              if (r !== null && !isNaN(+r)) { onUpdate?.(ctxMenu.tile.id, { lightRadius: +r }); }
              closeCtx();
            }}>
              💡 Luz ({ctxMenu.tile.lightRadius > 0 ? `${ctxMenu.tile.lightRadius}m` : 'nenhuma'})
            </button>
            <div className="ctx-sep" />
            <button className="ctx-btn danger" onClick={() => { onRemove?.(ctxMenu.tile.id); closeCtx(); }}>
              Deletar
            </button>
          </div>
        </>
      )}
    </>
  );
}
