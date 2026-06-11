import { useMemo } from 'react';
import { GRID } from '../utils/constants';

const { cellSize: CELL } = GRID;

const WEATHER_CSS = `
  @keyframes rainFall {
    0%   { transform: translateY(-20px) rotate(15deg); opacity: 0; }
    8%   { opacity: 1; }
    92%  { opacity: 1; }
    100% { transform: translateY(110vh) rotate(15deg); opacity: 0; }
  }
  @keyframes snowFall {
    0%   { transform: translateY(-20px) translateX(0px); opacity: 0; }
    10%  { opacity: 0.9; }
    50%  { transform: translateY(50vh) translateX(18px); }
    90%  { opacity: 0.9; }
    100% { transform: translateY(110vh) translateX(-12px); opacity: 0; }
  }
  @keyframes fogDrift {
    0%, 100% { opacity: 0.18; transform: translateX(0); }
    50%       { opacity: 0.28; transform: translateX(40px); }
  }
  @keyframes lightning {
    0%, 87%, 89%, 91%, 100% { opacity: 0; }
    88%, 90% { opacity: 0.18; }
  }
`;

// Seeded pseudo-random — stable across re-renders for same seed
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0x100000000;
  };
}

const PAINT_OPACITY = 0.42;

export function CellPaintLayer({ paintedCells }) {
  const entries = useMemo(() => Object.entries(paintedCells || {}), [paintedCells]);
  if (entries.length === 0) return null;
  return (
    <>
      {entries.map(([key, color]) => {
        const [x, y] = key.split(',').map(Number);
        return (
          <div
            key={key}
            style={{
              position: 'absolute',
              left: x * CELL,
              top: y * CELL,
              width: CELL,
              height: CELL,
              background: color,
              opacity: PAINT_OPACITY,
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        );
      })}
    </>
  );
}

export function WeatherOverlay({ weather }) {
  const rainParticles = useMemo(() => {
    if (weather !== 'rain' && weather !== 'storm') return [];
    const rng = makeRng(7);
    const count = weather === 'storm' ? 110 : 55;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${rng() * 120 - 10}%`,
      delay: `${(rng() * 2).toFixed(2)}s`,
      duration: `${(0.4 + rng() * 0.5).toFixed(2)}s`,
      height: `${Math.round(10 + rng() * 14)}px`,
      opacity: (0.38 + rng() * 0.42).toFixed(2),
      width: weather === 'storm' ? '2px' : '1.5px',
      color: weather === 'storm' ? 'rgba(170,190,240,0.8)' : 'rgba(160,200,250,0.7)',
    }));
  }, [weather]);

  const snowParticles = useMemo(() => {
    if (weather !== 'snow') return [];
    const rng = makeRng(13);
    return Array.from({ length: 55 }, (_, i) => ({
      id: i,
      left: `${rng() * 115 - 5}%`,
      delay: `${(rng() * 6).toFixed(2)}s`,
      duration: `${(4 + rng() * 5).toFixed(2)}s`,
      size: `${Math.round(4 + rng() * 6)}px`,
      opacity: (0.55 + rng() * 0.35).toFixed(2),
    }));
  }, [weather]);

  if (!weather || weather === 'none') return null;

  return (
    <>
      <style>{WEATHER_CSS}</style>
      <div style={{
        position: 'absolute', inset: 0, zIndex: 40,
        pointerEvents: 'none', overflow: 'hidden',
      }}>
        {/* Fog / Storm base tint */}
        {weather === 'fog' && (
          <>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(160,175,190,0.15)',
              animation: 'fogDrift 8s ease-in-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(140,160,180,0.10)',
              animation: 'fogDrift 13s ease-in-out infinite reverse',
            }} />
          </>
        )}
        {weather === 'storm' && (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,18,30,0.32)' }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(210,220,255,1)',
              animation: 'lightning 5s ease-in-out infinite',
            }} />
          </>
        )}

        {/* Rain drops */}
        {rainParticles.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.left, top: '-20px',
            width: p.width, height: p.height,
            background: p.color,
            animation: `rainFall ${p.duration} linear ${p.delay} infinite`,
            opacity: p.opacity,
          }} />
        ))}

        {/* Snow flakes */}
        {snowParticles.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            left: p.left, top: '-20px',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: 'rgba(235,242,255,0.88)',
            animation: `snowFall ${p.duration} ease-in-out ${p.delay} infinite`,
            opacity: p.opacity,
          }} />
        ))}
      </div>
    </>
  );
}
