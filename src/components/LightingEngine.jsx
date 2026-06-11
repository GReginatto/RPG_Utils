import { useRef, useEffect, useCallback } from 'react';
import { calculateVisibility } from '../utils/raycasting';

const M_PER_CELL = 1.5;
const DARKNESS = 'rgba(6,6,14,';
const WARM_RE  = /^#(ff|fe|fd|fc|fb|fa|f9|f8)/i; // rough warm-color detection

function isWarmColor(hex) {
  return WARM_RE.test(hex ?? '');
}

function hexToRgb(hex) {
  const h = hex?.replace('#', '') ?? 'ffd700';
  const r = parseInt(h.slice(0, 2), 16) || 255;
  const g = parseInt(h.slice(2, 4), 16) || 215;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return [r, g, b];
}

export default function LightingEngine({
  tokens,
  walls,
  COLS,
  ROWS,
  CELL,
  lightingEnabled,
  playerView,
}) {
  const canvasRef  = useRef(null);
  const flickerRef = useRef({});  // tokenId → offset (0.95–1.05)
  const rafRef     = useRef(null);
  const lastTickRef = useRef(0);

  const draw = useCallback((fOffsets) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = COLS * CELL, H = ROWS * CELL;

    ctx.clearRect(0, 0, W, H);
    if (!lightingEnabled) return;

    const lightsTokens = tokens.filter(t =>
      (t.lightBright ?? 0) > 0 || (t.lightDim ?? 0) > 0 || (t.darkvision && (t.visionRange ?? 0) > 0)
    );

    const darknessAlpha = playerView ? 0.85 : (lightsTokens.length > 0 ? 0.75 : 0.3);

    // ── 1. Fill darkness ──────────────────────────────────────────────────────
    ctx.fillStyle = `${DARKNESS}${darknessAlpha})`;
    ctx.fillRect(0, 0, W, H);

    if (lightsTokens.length === 0) return;

    // ── 2. Cut light holes (destination-out) ─────────────────────────────────
    ctx.globalCompositeOperation = 'destination-out';

    for (const token of lightsTokens) {
      const flicker = fOffsets[token.id] ?? 1.0;
      const brightM = (token.lightBright ?? 0) * flicker;
      const dimM    = Math.max(brightM, (token.lightDim ?? 0) * flicker);
      const visionM = token.darkvision ? (token.visionRange ?? 18) : 0;
      const maxM    = Math.max(dimM, visionM);
      if (maxM <= 0) continue;

      const cx  = (token.x + 0.5) * CELL;
      const cy  = (token.y + 0.5) * CELL;
      const maxR  = maxM / M_PER_CELL; // intersection units
      const maxPx = maxR * CELL;       // pixels

      // Visibility polygon — open doors are transparent to light
      const origin = { x: token.x + 0.5, y: token.y + 0.5 };
      const solidWalls = (walls ?? []).filter(w => !(w.type === 'door' && w.state === 'open'));
      const vis = calculateVisibility(origin, solidWalls, maxR);

      // Angular vision clipping (if visionAngle < 360)
      const visionAngle = token.visionAngle ?? 360;
      const hasAngularVision = visionAngle < 360;
      if (hasAngularVision) {
        ctx.save();
        const halfRad   = (visionAngle / 2) * Math.PI / 180;
        const facingRad = ((token.facingAngle ?? 0) * Math.PI / 180) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxPx * 3, facingRad - halfRad, facingRad + halfRad);
        ctx.closePath();
        ctx.clip();
      }

      // Build polygon path
      ctx.beginPath();
      for (let i = 0; i < vis.length; i++) {
        const px = vis[i].x * CELL, py = vis[i].y * CELL;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();

      // Radial gradient: full bright → dim → darkness
      const brightPx = (brightM / M_PER_CELL) * CELL;
      const dimPx    = (dimM   / M_PER_CELL) * CELL;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxPx);

      if (token.darkvision && visionM > 0 && brightM === 0) {
        // Darkvision: gray-ish partial erase (see through darkness but dimly)
        grad.addColorStop(0, 'rgba(0,0,0,0.55)');
        grad.addColorStop(0.8, 'rgba(0,0,0,0.35)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
      } else {
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        if (brightPx > 0 && dimPx > brightPx) {
          grad.addColorStop(Math.min(0.99, brightPx / maxPx), 'rgba(0,0,0,1)');
          grad.addColorStop(Math.min(1.0,  dimPx   / maxPx), 'rgba(0,0,0,0.38)');
        } else if (brightPx > 0) {
          grad.addColorStop(0.75, 'rgba(0,0,0,0.7)');
        } else {
          grad.addColorStop(0.7, 'rgba(0,0,0,0.38)');
        }
        grad.addColorStop(1, 'rgba(0,0,0,0)');
      }

      ctx.fillStyle = grad;
      ctx.fill();
      if (hasAngularVision) ctx.restore();
    }

    // ── 3. Reset + color tint (source-over) ──────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';

    for (const token of lightsTokens) {
      const flicker  = fOffsets[token.id] ?? 1.0;
      const brightM  = (token.lightBright ?? 0) * flicker;
      const dimM     = Math.max(brightM, (token.lightDim ?? 0) * flicker);
      if (dimM <= 0) continue;

      const cx   = (token.x + 0.5) * CELL;
      const cy   = (token.y + 0.5) * CELL;
      const maxPx = (dimM / M_PER_CELL) * CELL;
      const [r, g, b] = hexToRgb(token.lightColor ?? '#ffd700');

      const tint = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxPx);
      tint.addColorStop(0,   `rgba(${r},${g},${b},0.12)`);
      tint.addColorStop(0.5, `rgba(${r},${g},${b},0.05)`);
      tint.addColorStop(1,   `rgba(${r},${g},${b},0)`);

      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(cx, cy, maxPx, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [tokens, walls, COLS, ROWS, CELL, lightingEnabled, playerView]);

  // ── Animation loop (flicker for warm lights) ──────────────────────────────
  useEffect(() => {
    let running = true;

    const loop = (ts) => {
      if (!running) return;
      const warmTokens = tokens.filter(t =>
        ((t.lightBright ?? 0) > 0 || (t.lightDim ?? 0) > 0) && isWarmColor(t.lightColor)
      );

      if (warmTokens.length > 0 && ts - lastTickRef.current > 140) {
        lastTickRef.current = ts;
        const next = { ...flickerRef.current };
        for (const t of warmTokens) {
          next[t.id] = 0.95 + Math.random() * 0.10;
        }
        flickerRef.current = next;
        draw(next);
      } else if (warmTokens.length === 0) {
        // No flicker needed — draw once (handled by the static effect below)
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // Draw once immediately with current offsets
    draw(flickerRef.current);

    const warmExists = tokens.some(t =>
      ((t.lightBright ?? 0) > 0 || (t.lightDim ?? 0) > 0) && isWarmColor(t.lightColor)
    );
    if (warmExists) {
      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tokens, walls, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={COLS * CELL}
      height={ROWS * CELL}
      style={{
        position: 'absolute', inset: 0, zIndex: 24,
        pointerEvents: 'none',
        opacity: lightingEnabled ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}
    />
  );
}
