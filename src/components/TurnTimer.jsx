import { useState, useEffect, useRef } from 'react';

function fmt(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function timerColor(pct) {
  if (pct > 0.5) return '#4a9a5a';
  if (pct > 0.25) return '#c4a030';
  return '#c43030';
}

// ── TurnTimer component ──────────────────────────────────────────────────────
export default function TurnTimer({
  duration,        // seconds per turn
  isActive,        // combat is active
  currentTurnIndex,// resets timer when this changes
  isGM,
  playSfx,
  timerSoundEnabled,
  onExpire,        // optional callback when timer hits 0
}) {
  const [timeLeft,  setTimeLeft]  = useState(duration);
  const [isPaused,  setIsPaused]  = useState(false);
  const intervalRef = useRef(null);

  // Reset when turn changes or duration changes
  useEffect(() => {
    setTimeLeft(duration);
    setIsPaused(false);
  }, [currentTurnIndex, duration]);

  // Countdown interval
  useEffect(() => {
    if (!isActive || isPaused || timeLeft <= 0) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (timerSoundEnabled) playSfx?.('turnStart');
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isActive, isPaused, timeLeft, timerSoundEnabled, playSfx, onExpire]);

  const pct = duration > 0 ? timeLeft / duration : 0;
  const isExpired = timeLeft === 0;
  const isLow = pct < 0.25 && !isExpired;
  const color = timerColor(pct);

  const addTime = () => setTimeLeft(t => t + 30);
  const reset   = () => { setTimeLeft(duration); setIsPaused(false); };
  const toggle  = () => setIsPaused(v => !v);

  if (!isActive) return null;

  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${isExpired ? '#c43030' : 'var(--border)'}`,
      borderRadius: 6, padding: '6px 10px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>⏱</span>
        <span style={{
          fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: isExpired ? '#c43030' : color,
          animation: isLow ? 'timerPulse 0.8s ease-in-out infinite' : 'none',
          minWidth: 36,
        }}>
          {isExpired ? 'Tempo!' : fmt(timeLeft)}
        </span>

        {/* Progress bar */}
        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${pct * 100}%`, height: '100%',
            background: color, borderRadius: 2,
            transition: 'width 0.9s linear, background 0.5s',
          }} />
        </div>

        {/* GM controls */}
        {isGM && (
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
              onClick={toggle}>{isPaused ? '▶' : '⏸'}</button>
            <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
              onClick={addTime} title="+30s">+30s</button>
            <button className="tbtn" style={{ fontSize: 10, padding: '1px 5px' }}
              onClick={reset} title="Resetar">↺</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── TurnTimerSettings component ──────────────────────────────────────────────
export function TurnTimerSettings({ timerEnabled, setTimerEnabled, timerDuration, setTimerDuration, timerSoundEnabled, setTimerSoundEnabled, isGM }) {
  if (!isGM) return null;
  return (
    <div style={{
      padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0,
      background: 'var(--card)', borderRadius: '0 0 4px 4px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'pointer' }}>
          <input type="checkbox" checked={timerEnabled}
            onChange={e => setTimerEnabled(e.target.checked)}
            style={{ accentColor: 'var(--gold)' }} />
          <span style={{ color: timerEnabled ? 'var(--gold)' : 'var(--sub)' }}>⏱ Timer de Turno</span>
        </label>
        {timerEnabled && (
          <>
            <select className="vtt-select" value={timerDuration}
              onChange={e => setTimerDuration(+e.target.value)}
              style={{ fontSize: 10, height: 22, padding: '1px 4px' }}>
              {[30,45,60,90,120].map(s => (
                <option key={s} value={s}>{s}s</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={timerSoundEnabled}
                onChange={e => setTimerSoundEnabled(e.target.checked)}
                style={{ accentColor: 'var(--gold)' }} />
              Som
            </label>
          </>
        )}
      </div>
    </div>
  );
}
