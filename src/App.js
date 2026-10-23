import { useEffect, useState } from 'react';
import { RoleProvider, useRole } from './hooks/useRole';
import RoleSelector from './components/RoleSelector';
import TabletopMap from './TabletopMap';
import { sync } from './sync/client';

function Waiting({ text }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a10', color: '#8a8478', fontFamily: 'system-ui, sans-serif', fontSize: 14, textAlign: 'center', padding: 24 }}>
      {text}
    </div>
  );
}

// Conecta à mesa e só mostra o mapa depois de receber o estado do servidor.
function SyncGate() {
  const [, force] = useState(0);
  useEffect(() => {
    const off = sync.subscribe(() => force(n => n + 1));
    sync.connect();
    return () => { off(); };
  }, []);
  if (sync.initial) return <TabletopMap />;
  if (sync.status === 'waiting') return <Waiting text="Aguardando o Mestre abrir a mesa…" />;
  return <Waiting text="Conectando à mesa…" />;
}

function AppInner() {
  const { role, loading } = useRole();
  if (loading) return <Waiting text="Conectando…" />;
  if (role === null) return <RoleSelector />;
  return <SyncGate />;
}

function App() {
  return (
    <RoleProvider>
      <AppInner />
    </RoleProvider>
  );
}

export default App;
