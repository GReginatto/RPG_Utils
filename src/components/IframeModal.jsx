import { useState } from 'react';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export default function IframeModal({ src, title, titleExtra, onClose, zIndex = 99998, onFocus, iframeRef, onIframeLoad }) {
  const isMobile = window.innerWidth < 768;

  const [pos, setPos] = useState(() => {
    const w = Math.min(800, window.innerWidth * 0.9);
    const h = Math.min(window.innerHeight * 0.85, window.innerHeight - 40);
    return { x: Math.round((window.innerWidth - w) / 2), y: Math.round((window.innerHeight - h) / 2) };
  });
  const [size, setSize] = useState(() => ({
    w: Math.min(800, window.innerWidth * 0.9),
    h: Math.min(window.innerHeight * 0.85, window.innerHeight - 40),
  }));

  function startDrag(e) {
    if (e.button !== 0 || isMobile) return;
    e.preventDefault();
    onFocus?.();
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;
    const snap = () => {
      const w = size.w;
      const onMove = (ev) => setPos({
        x: clamp(ev.clientX - ox, 0, window.innerWidth - w),
        y: clamp(ev.clientY - oy, 0, window.innerHeight - 60),
      });
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    snap();
  }

  function startResize(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, sw = size.w, sh = size.h;
    const onMove = (ev) => setSize({
      w: Math.max(400, sw + ev.clientX - sx),
      h: Math.max(300, sh + ev.clientY - sy),
    });
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  const boxStyle = isMobile
    ? { top: 0, left: 0, width: '100%', height: '100%', borderRadius: 0 }
    : { top: pos.y, left: pos.x, width: size.w, height: size.h, borderRadius: 8 };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(8,8,16,0.8)',
        zIndex,
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          position: 'absolute',
          ...boxStyle,
          background: '#0a0a10',
          border: '1px solid #333345',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
        onMouseDown={onFocus}
      >
        {/* Header / drag bar */}
        <div
          onMouseDown={startDrag}
          style={{
            padding: '8px 16px',
            background: '#12121c',
            borderBottom: '1px solid #333345',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: isMobile ? 'default' : 'move',
            userSelect: 'none',
            fontFamily: "'Cinzel', serif",
            fontSize: 13,
            color: '#c9a96e',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>{title}{titleExtra}</span>
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={onClose}
            style={{
              background: 'none', border: 'none',
              color: '#7a7468', fontSize: 18,
              cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#c9a96e'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#7a7468'; }}
          >✕</button>
        </div>

        {/* Embedded page */}
        <iframe
          ref={iframeRef}
          onLoad={onIframeLoad}
          src={src}
          style={{ flex: 1, width: '100%', border: 'none', background: '#080810' }}
          title={title}
        />

        {/* Resize handle — desktop only */}
        {!isMobile && (
          <div
            onMouseDown={startResize}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 20, height: 20, cursor: 'se-resize',
              background: 'linear-gradient(135deg, transparent 50%, rgba(201,169,110,0.3) 50%)',
            }}
          />
        )}
      </div>
    </div>
  );
}
