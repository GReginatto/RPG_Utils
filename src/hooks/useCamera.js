import { useState, useRef, useCallback, useEffect } from 'react';
import { GRID, LABEL_W, LABEL_H } from '../utils/constants';

const { cellSize: CELL, cols: COLS, rows: ROWS } = GRID;

const clampZoom = (z) => {
  const rounded = Math.round(z * 10) / 10;
  return Math.min(3.0, Math.max(0.3, rounded));
};

export function useCamera(containerRef) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [mapDragging, setMapDragging] = useState(false);

  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const spaceRef = useRef(false);

  // Center map on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const init = {
      x: (width - (COLS * CELL + LABEL_W)) / 2,
      y: (height - (ROWS * CELL + LABEL_H)) / 2,
    };
    panRef.current = init;
    setPan({ ...init });
  }, [containerRef]);

  // Space key → pan mode (no containerRef needed, stable refs only)
  useEffect(() => {
    const onDown = (e) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        spaceRef.current = true;
        setSpaceDown(true);
      }
    };
    const onUp = (e) => {
      if (e.code === 'Space') {
        spaceRef.current = false;
        setSpaceDown(false);
        isPanningRef.current = false;
        setMapDragging(false);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Zoom toward an arbitrary screen point; stable (refs only)
  const applyZoom = useCallback((delta, mx, my) => {
    const oldZoom = zoomRef.current;
    const newZoom = clampZoom(oldZoom + delta);
    if (newZoom === oldZoom) return;
    const oldPan = panRef.current;
    const newPan = {
      x: mx - (mx - oldPan.x) * newZoom / oldZoom,
      y: my - (my - oldPan.y) * newZoom / oldZoom,
    };
    zoomRef.current = newZoom;
    panRef.current = newPan;
    setZoom(newZoom);
    setPan({ ...newPan });
  }, []);

  // Convert screen coords to grid cell indices
  const screenToGrid = useCallback((sx, sy) => {
    const rect = containerRef.current.getBoundingClientRect();
    const mapX = (sx - rect.left - panRef.current.x) / zoomRef.current;
    const mapY = (sy - rect.top  - panRef.current.y) / zoomRef.current;
    return {
      col: Math.floor((mapX - LABEL_W) / CELL),
      row: Math.floor((mapY - LABEL_H) / CELL),
    };
  }, [containerRef]);

  // Pan so that grid cell (col, row) appears at the viewport center
  const centerOnCell = useCallback((col, row) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const cellCenterX = LABEL_W + (col + 0.5) * CELL;
    const cellCenterY = LABEL_H + (row + 0.5) * CELL;
    const newPan = {
      x: width  / 2 - cellCenterX * zoomRef.current,
      y: height / 2 - cellCenterY * zoomRef.current,
    };
    panRef.current = newPan;
    setPan({ ...newPan });
  }, [containerRef]);

  // Pan only if the cell is near the viewport edge (used on keyboard move)
  const ensureCellVisible = useCallback((col, row) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = CELL * zoomRef.current * 2.5;
    const sx = LABEL_W * zoomRef.current + (col + 0.5) * CELL * zoomRef.current + panRef.current.x;
    const sy = LABEL_H * zoomRef.current + (row + 0.5) * CELL * zoomRef.current + panRef.current.y;
    if (sx < margin || sx > width - margin || sy < margin || sy > height - margin) {
      centerOnCell(col, row);
    }
  }, [containerRef, centerOnCell]);

  const resetZoom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const newPan = {
      x: (width  - (COLS * CELL + LABEL_W)) / 2,
      y: (height - (ROWS * CELL + LABEL_H)) / 2,
    };
    zoomRef.current = 1;
    panRef.current = newPan;
    setZoom(1);
    setPan({ ...newPan });
  }, [containerRef]);

  const zoomAtCenter = useCallback((delta) => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    applyZoom(delta, width / 2, height / 2);
  }, [applyZoom, containerRef]);

  return {
    // Render state
    zoom, pan, spaceDown, mapDragging,
    // Stable refs (safe to use inside closures without deps)
    panRef, zoomRef, isPanningRef, lastMouseRef, spaceRef,
    // Setters exposed for mouse-handler use in MapCanvas
    setPan, setMapDragging,
    // Stable callbacks
    applyZoom, screenToGrid, centerOnCell, ensureCellVisible,
    resetZoom, zoomAtCenter,
  };
}
