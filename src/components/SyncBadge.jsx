import { useEffect, useState } from 'react';
import { sync } from '../sync/client';

const LABEL = {
  online: ['#4caf7a', 'Conectado'],
  offline: ['#e0a040', 'Reconectando…'],
  connecting: ['#e0a040', 'Conectando…'],
  waiting: ['#e0a040', 'Aguardando o Mestre'],
  expired: ['#e05555', 'Sessão encerrada'],
  idle: ['#7a7468', 'Local'],
};

// Indicador de conexão com o servidor da mesa e de quem está online.
export default function SyncBadge() {
  const [, force] = useState(0);
  useEffect(() => sync.subscribe(() => force(n => n + 1)), []);
  const [color, text] = LABEL[sync.status] ?? LABEL.idle;
  const names = sync.online.map(o => (o.role === 'gm' ? `${o.name} (Mestre)` : o.name));
  return (
    <span
      title={names.length ? `Na mesa: ${names.join(', ')}` : text}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--sub)',
        padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 10, whiteSpace: 'nowrap' }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {sync.status === 'online' ? `${sync.online.length} na mesa` : text}
    </span>
  );
}
