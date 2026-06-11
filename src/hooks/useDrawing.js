import { useState, useCallback, useRef } from 'react';

export function makeDrawing(overrides = {}) {
  return {
    id: `drw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'freehand',
    points: [],
    x1: 0, y1: 0, x2: 0, y2: 0,
    cx: 0, cy: 0, radius: 0,
    text: '',
    color: '#c9a96e',
    strokeWidth: 2,
    opacity: 1,
    fontSize: 16,
    author: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

export function useDrawing(initial = []) {
  const [drawings, setDrawings] = useState(initial);
  const undoRef = useRef([]);
  const redoRef = useRef([]);

  const snap = (prev) => {
    undoRef.current = [...undoRef.current.slice(-29), prev];
    redoRef.current = [];
  };

  const addDrawing = useCallback((d) => {
    setDrawings(prev => { snap(prev); return [...prev, d]; });
  }, []);

  const updateDrawing = useCallback((id, patch) => {
    setDrawings(prev => { snap(prev); return prev.map(d => d.id === id ? { ...d, ...patch } : d); });
  }, []);

  const removeDrawing = useCallback((id) => {
    setDrawings(prev => { snap(prev); return prev.filter(d => d.id !== id); });
  }, []);

  const removeByIds = useCallback((ids) => {
    const set = new Set(ids);
    setDrawings(prev => { snap(prev); return prev.filter(d => !set.has(d.id)); });
  }, []);

  const clearDrawings = useCallback(() => {
    setDrawings(prev => { snap(prev); return []; });
  }, []);

  const undoDrawing = useCallback(() => {
    if (!undoRef.current.length) return false;
    const prev = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    setDrawings(cur => { redoRef.current = [...redoRef.current, cur]; return prev; });
    return true;
  }, []);

  const redoDrawing = useCallback(() => {
    if (!redoRef.current.length) return false;
    const next = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    setDrawings(cur => { undoRef.current = [...undoRef.current, cur]; return next; });
    return true;
  }, []);

  return { drawings, setDrawings, addDrawing, updateDrawing, removeDrawing, removeByIds, clearDrawings, undoDrawing, redoDrawing };
}
