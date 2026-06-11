import { useEffect, useCallback } from 'react';

export function useKeyboardShortcuts(actions) {
  const handleKeyDown = useCallback((e) => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    // '?' is Shift+/ but we handle it by the literal key value
    if (e.key === '?') {
      const action = actions['?'];
      if (action) { e.preventDefault(); action(e); }
      return;
    }

    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = e.key.toLowerCase();

    let combo = '';
    if (ctrl)  combo += 'ctrl+';
    if (shift) combo += 'shift+';
    combo += key;

    const action = actions[combo];
    if (action) {
      e.preventDefault();
      action(e);
    }
  }, [actions]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
