import { useRole } from '../hooks/useRole';

// Wraps a toolbar control and shows a disabled overlay for players
export function LockedTool({ children, locked, reason = 'Apenas o Mestre' }) {
  if (!locked) return children;
  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'not-allowed' }}
      title={`🔒 ${reason}`}
    >
      <div style={{ opacity: 0.35, pointerEvents: 'none', userSelect: 'none' }}>
        {children}
      </div>
      {/* invisible click blocker */}
      <div style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}

// Role indicator shown in the header bar
export function RoleBadge({ onSwitch }) {
  const { isGM, playerName, clearRole } = useRole();

  function handleSwitch() {
    if (isGM) {
      clearRole();
    } else {
      if (window.confirm('Trocar para modo Mestre?')) clearRole();
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: isGM ? 'var(--gold)' : 'var(--text)',
        letterSpacing: '0.04em', whiteSpace: 'nowrap',
      }}>
        {isGM ? '🎭 Mestre' : `⚔ ${playerName}`}
      </span>
      <button
        className="tbtn"
        onClick={onSwitch ?? handleSwitch}
        title={isGM ? 'Trocar modo' : 'Trocar para Mestre'}
        style={{ padding: '2px 7px', fontSize: 11 }}
      >
        Trocar
      </button>
    </div>
  );
}

// Default export: wraps content and shows a full "locked" overlay for
// entire sections that players cannot access
export default function PlayerView({ children, locked, message = 'Apenas o Mestre' }) {
  if (!locked) return children;
  return (
    <div style={{ position: 'relative', pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ opacity: 0.25, filter: 'blur(1px)' }}>{children}</div>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 4,
      }}>
        <span style={{ fontSize: 16 }}>🔒</span>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>{message}</span>
      </div>
    </div>
  );
}
