import { useState, useRef, useCallback, useEffect } from 'react';

export function makeScene(overrides = {}) {
  return {
    id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: 'Nova Cena',
    mapImage: null,
    tokens: [],
    walls: [],
    fog: { enabled: false, revealedCells: [] },
    markers: [],
    paintedCells: {},
    aoes: [],
    drawings: [],
    tiles: [],
    hexGrid: false,
    weather: 'none',
    gridSize: { cols: 30, rows: 20 },
    notes: '',
    partyPositions: {},
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Template factories ────────────────────────────────────────────────────────

function tavernaScene() {
  const cells = {};
  for (let x = 3; x < 27; x++)
    for (let y = 3; y < 17; y++)
      cells[`${x},${y}`] = '#6b4c2a';
  for (let x = 2; x < 28; x++) { cells[`${x},2`] = '#555566'; cells[`${x},17`] = '#555566'; }
  for (let y = 2; y < 18; y++) { cells[`2,${y}`] = '#555566'; cells[`27,${y}`] = '#555566'; }
  return makeScene({
    name: 'Taverna',
    paintedCells: cells,
    markers: [
      { id: 'mk-t1', x: 14, y: 9,  text: 'Balcão',  color: '#c9a96e' },
      { id: 'mk-t2', x: 7,  y: 6,  text: 'Mesas',   color: '#c9a96e' },
      { id: 'mk-t3', x: 14, y: 18, text: 'Porta',   color: '#c9a96e' },
      { id: 'mk-t4', x: 26, y: 2,  text: 'Escada',  color: '#c9a96e' },
    ],
  });
}

function campoScene() {
  const cells = {};
  [[5,5],[10,8],[20,12],[25,7],[8,15],[15,3],[22,17]].forEach(([px, py]) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        cells[`${px+dx},${py+dy}`] = '#3a7a3a';
  });
  return makeScene({ name: 'Campo Aberto', paintedCells: cells });
}

function cavernaScene() {
  const cols = 35, rows = 25;
  const cells = {};
  for (let x = 0; x < cols; x++)
    for (let y = 0; y < rows; y++)
      if (x < 2 || x >= cols - 2 || y < 2 || y >= rows - 2)
        cells[`${x},${y}`] = '#3a3a4e';
  return makeScene({
    name: 'Caverna',
    gridSize: { cols, rows },
    fog: { enabled: true, revealedCells: [] },
    paintedCells: cells,
  });
}

const TEMPLATE_FACTORIES = {
  vazio:    () => makeScene({ name: 'Nova Cena' }),
  taverna:  tavernaScene,
  masmorra: () => makeScene({ name: 'Masmorra', gridSize: { cols: 40, rows: 30 }, fog: { enabled: true, revealedCells: [] } }),
  campo:    campoScene,
  caverna:  cavernaScene,
};

export function fromTemplate(templateId, overrides = {}) {
  const factory = TEMPLATE_FACTORIES[templateId] ?? TEMPLATE_FACTORIES.vazio;
  return { ...factory(), ...overrides };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useScenes(initialScenes, initialActiveId) {
  const defaultScene = makeScene({ name: 'Cena Principal' });

  const [scenes, setScenes] = useState(() => {
    if (initialScenes?.length) return initialScenes;
    return [defaultScene];
  });

  const [activeSceneId, setActiveSceneId] = useState(() => {
    if (initialActiveId && initialScenes?.some(s => s.id === initialActiveId))
      return initialActiveId;
    return initialScenes?.[0]?.id ?? defaultScene.id;
  });

  const scenesRef = useRef(scenes);
  useEffect(() => { scenesRef.current = scenes; }, [scenes]);

  const activeScene = scenes.find(s => s.id === activeSceneId) ?? scenes[0] ?? null;

  const updateScene = useCallback((id, patch) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const addScene = useCallback((scene) => {
    setScenes(prev => [...prev, scene]);
  }, []);

  const deleteScene = useCallback((id) => {
    setScenes(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(s => s.id !== id);
    });
  }, []);

  const duplicateScene = useCallback((id) => {
    let copy = null;
    setScenes(prev => {
      const src = prev.find(s => s.id === id);
      if (!src) return prev;
      copy = {
        ...src,
        id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: `${src.name} (cópia)`,
        createdAt: Date.now(),
      };
      const idx = prev.indexOf(src);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    return copy;
  }, []);

  const reorderScenes = useCallback((fromIdx, toIdx) => {
    setScenes(prev => {
      if (fromIdx === toIdx) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
  }, []);

  const renameScene = useCallback((id, name) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, name } : s));
  }, []);

  return {
    scenes, setScenes,
    scenesRef,
    activeSceneId, setActiveSceneId,
    activeScene,
    updateScene, addScene, deleteScene, duplicateScene, reorderScenes, renameScene,
  };
}
