import { useState, useCallback, useRef } from 'react';

const RATE_MS = 2000;
const LIFETIME_MS = 3200;

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePing() {
  const [pings, setPings] = useState([]);
  const lastRef = useRef(0);

  const addPing = useCallback((x, y, color, author) => {
    const now = Date.now();
    if (now - lastRef.current < RATE_MS) return;
    lastRef.current = now;
    const id = `ping-${now}`;
    setPings(prev => [...prev, { id, x, y, color: color ?? '#c9a96e', author: author ?? '?', timestamp: now }]);
    setTimeout(() => setPings(prev => prev.filter(p => p.id !== id)), LIFETIME_MS);
  }, []);

  return { pings, addPing };
}

// ── PingRipple ────────────────────────────────────────────────────────────────
function PingRipple({ ping }) {
  return (
    <div style={{
      position: 'absolute',
      left: ping.x,
      top: ping.y,
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 45,
    }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            border: `3px solid ${ping.color}`,
            width: 0,
            height: 0,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            animationName: 'pingRipple',
            animationDuration: '1s',
            animationDelay: `${i * 0.22}s`,
            animationTimingFunction: 'ease-out',
            animationFillMode: 'forwards',
          }}
        />
      ))}
      {/* Author label */}
      <div style={{
        position: 'absolute',
        left: 38,
        top: -8,
        whiteSpace: 'nowrap',
        fontSize: 11,
        color: ping.color,
        fontWeight: 700,
        textShadow: '0 1px 4px rgba(0,0,0,0.9)',
        fontFamily: 'system-ui, sans-serif',
        pointerEvents: 'none',
      }}>
        ← {ping.author}
      </div>
    </div>
  );
}

// ── PingLayer — rendered inside MapCanvas transform div ───────────────────────
export function PingLayer({ pings, pointerPos, pointerColor }) {
  if (!pings?.length && !pointerPos) return null;
  return (
    <>
      {pings?.map(p => <PingRipple key={p.id} ping={p} />)}
      {pointerPos && (
        <div style={{
          position: 'absolute',
          left: pointerPos.x,
          top: pointerPos.y,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 50,
        }}>
          <div style={{
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: pointerColor ?? '#c9a96e',
            boxShadow: `0 0 0 3px rgba(0,0,0,0.5), 0 0 12px ${pointerColor ?? '#c9a96e'}`,
          }} />
          {/* Trailing dot */}
          <div style={{
            position: 'absolute',
            left: -5, top: -5,
            width: 24, height: 24,
            borderRadius: '50%',
            background: `${pointerColor ?? '#c9a96e'}22`,
            border: `1px solid ${pointerColor ?? '#c9a96e'}55`,
          }} />
        </div>
      )}
    </>
  );
}
